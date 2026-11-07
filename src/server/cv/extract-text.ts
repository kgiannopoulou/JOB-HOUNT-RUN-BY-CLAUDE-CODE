import "server-only";

import { unzipSync } from "fflate";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

import {
  MAX_CV_TEXT_LENGTH,
  MIN_CV_TEXT_LENGTH,
  type CvFileType,
} from "@/lib/cv/upload";

/** A message that is safe to show to the user. */
export class DocumentError extends Error {}

const MAX_PDF_PAGES = 30;
const MAX_DOCX_UNPACKED_BYTES = 50 * 1024 * 1024;

const WORD_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;
const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1].toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

/**
 * Reads text with a pattern rather than an XML parser, so document type
 * declarations and external entities are never processed.
 */
export function wordXmlToText(xml: string): string {
  return decodeEntities(
    xml
      // Word stores a copy of some shapes for old readers. Reading both repeats text.
      .replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, "")
      .replace(/<w:(tab|ptab)\b[^>]*\/>/g, "\t")
      .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<[^>]+>/g, (_, text?: string) => text ?? ""),
  );
}

export function extractDocxText(bytes: Uint8Array): string {
  let unpackedSize = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // The sizes come from the file's own index, so also check the real result below.
      filter: ({ name, originalSize }) => {
        if (name !== "[Content_Types].xml" && !WORD_PARTS.test(name)) return false;
        unpackedSize += originalSize;
        if (unpackedSize > MAX_DOCX_UNPACKED_BYTES) {
          throw new DocumentError("This document is too large to read.");
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    throw new DocumentError("This file is damaged or is not a real Word document.");
  }

  const realSize = Object.values(files).reduce((sum, file) => sum + file.length, 0);
  if (realSize > MAX_DOCX_UNPACKED_BYTES) {
    throw new DocumentError("This document is too large to read.");
  }

  const decoder = new TextDecoder();
  const contentTypes = files["[Content_Types].xml"];
  if (
    !files["word/document.xml"] ||
    !contentTypes ||
    !decoder.decode(contentTypes).includes(DOCX_CONTENT_TYPE)
  ) {
    throw new DocumentError("This file is not a valid DOCX document.");
  }

  // Many CVs keep the name and contact details in the page header.
  return Object.keys(files)
    .filter((name) => WORD_PARTS.test(name))
    .sort((a, b) => partOrder(a) - partOrder(b) || a.localeCompare(b))
    .map((name) => wordXmlToText(decoder.decode(files[name])))
    .join("\n");
}

const partOrder = (name: string) =>
  name.includes("header") ? 0 : name.includes("document") ? 1 : 2;

export async function extractPdf(bytes: Uint8Array): Promise<string> {
  try {
    // pdf.js takes ownership of the buffer it is given, so it gets a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new DocumentError(`This PDF has more than ${MAX_PDF_PAGES} pages.`);
    }
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    if (error instanceof DocumentError) throw error;
    if (error instanceof Error && error.name === "PasswordException") {
      throw new DocumentError("This PDF is password protected. Remove the password and try again.");
    }
    throw new DocumentError("This file is damaged or is not a real PDF.");
  }
}

export function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Throws DocumentError, with a message for the user, if no usable text comes out. */
export async function extractCvText(bytes: Uint8Array, type: CvFileType): Promise<string> {
  const raw = type === "pdf" ? await extractPdf(bytes) : extractDocxText(bytes);
  const text = tidyText(raw);

  if (text.length < MIN_CV_TEXT_LENGTH) {
    throw new DocumentError(
      type === "pdf"
        ? "No text could be read. This looks like a scanned PDF, so please upload a version with selectable text or a DOCX."
        : "This document has almost no text in it.",
    );
  }
  if (text.length > MAX_CV_TEXT_LENGTH) {
    throw new DocumentError("This document has too much text to be a CV. Please shorten it.");
  }
  return text;
}
