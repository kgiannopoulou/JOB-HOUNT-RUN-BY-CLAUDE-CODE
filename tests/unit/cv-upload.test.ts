// @vitest-environment node
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  cvTitle,
  detectFileType,
  fileTypeFromName,
  safeFileName,
} from "@/lib/cv/upload";
import {
  DocumentError,
  extractCvText,
  extractDocxText,
  tidyText,
  wordXmlToText,
} from "@/server/cv/extract-text";

import { makeDocx, makePdf, sampleCvLines } from "../fixtures/documents";

describe("file type checks", () => {
  it("accepts only PDF and DOCX names", () => {
    expect(fileTypeFromName("cv.PDF")).toBe("pdf");
    expect(fileTypeFromName("my.cv.docx")).toBe("docx");
    expect(fileTypeFromName("cv.doc")).toBeNull();
    expect(fileTypeFromName("cv.pdf.exe")).toBeNull();
    expect(fileTypeFromName("cv")).toBeNull();
  });

  it("reads the real type from the file's first bytes", () => {
    expect(detectFileType(makePdf(["x"]))).toBe("pdf");
    expect(detectFileType(makeDocx(["x"]))).toBe("docx");
    expect(detectFileType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(detectFileType(new Uint8Array())).toBeNull();
  });
});

describe("safeFileName", () => {
  it("removes paths and unsafe characters", () => {
    expect(safeFileName("../../etc/pass wd.pdf", "pdf")).toBe("pass-wd.pdf");
    expect(safeFileName("C:\\Users\\me\\cv (final).docx", "docx")).toBe("cv-final.docx");
  });

  it("falls back when nothing usable is left", () => {
    expect(safeFileName("βιογραφικό.pdf", "pdf")).toBe("cv.pdf");
    expect(safeFileName(".pdf", "pdf")).toBe("cv.pdf");
  });

  it("limits the length", () => {
    expect(safeFileName(`${"a".repeat(300)}.pdf`, "pdf").length).toBeLessThanOrEqual(84);
  });
});

describe("cvTitle", () => {
  it("uses the file name, keeping non-Latin text", () => {
    expect(cvTitle("βιογραφικό 2026.pdf")).toBe("βιογραφικό 2026");
    expect(cvTitle(".pdf")).toBe("My CV");
  });
});

describe("wordXmlToText", () => {
  it("decodes entities once, without expanding anything else", () => {
    const xml = `<w:p><w:t>R&amp;D &lt;team&gt; &#233; &#x3b1; &amp;amp; &unknown;</w:t></w:p>`;
    expect(wordXmlToText(xml).trim()).toBe("R&D <team> é α &amp; &unknown;");
  });

  it("does not repeat text stored twice for old readers", () => {
    const xml = `<mc:AlternateContent><mc:Choice><w:t>Once</w:t></mc:Choice><mc:Fallback><w:t>Once</w:t></mc:Fallback></mc:AlternateContent>`;
    expect(wordXmlToText(xml)).toBe("Once");
  });

  it("separates paragraphs and table cells", () => {
    const xml = `<w:tc><w:p><w:t>A</w:t></w:p></w:tc><w:tc><w:p><w:t>B</w:t></w:p></w:tc>`;
    expect(tidyText(wordXmlToText(xml))).toBe("A\nB");
  });

  it("does not process a document type declaration", () => {
    const xml = `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><w:t>&e;</w:t>`;
    expect(wordXmlToText(xml)).toContain("&e;");
  });
});

describe("extractCvText", () => {
  it("reads a DOCX", async () => {
    const text = await extractCvText(makeDocx(sampleCvLines), "docx");
    expect(text).toContain("Alex Example");
    expect(text).toContain("Skills: SQL, Python");
  });

  it("reads contact details kept in a DOCX page header", async () => {
    const text = await extractCvText(
      makeDocx(sampleCvLines.slice(2), { header: "Header Name, header@example.com" }),
      "docx",
    );
    expect(text.startsWith("Header Name")).toBe(true);
  });

  it("reads a PDF", async () => {
    const text = await extractCvText(makePdf(sampleCvLines), "pdf");
    expect(text).toContain("Alex Example");
    expect(text).toContain("Built weekly SQL reports");
  });

  const fails = async (bytes: Uint8Array, type: "pdf" | "docx", message: RegExp) => {
    const result = extractCvText(bytes, type);
    await expect(result).rejects.toBeInstanceOf(DocumentError);
    await expect(result).rejects.toThrow(message);
  };

  it("explains that a PDF without text may be scanned", async () => {
    await fails(makePdf([]), "pdf", /scanned/);
  });

  it("rejects a damaged PDF", async () => {
    await fails(new TextEncoder().encode("%PDF-1.4 not really a pdf"), "pdf", /damaged/);
  });

  it("rejects a cut-off PDF", async () => {
    await fails(makePdf(sampleCvLines).slice(0, 40), "pdf", /damaged/);
  });

  it("rejects a damaged DOCX", async () => {
    await fails(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]), "docx", /damaged/);
  });

  it("rejects a ZIP that is not a Word document", async () => {
    await fails(zipSync({ "photo.txt": strToU8("hello") }), "docx", /not a valid DOCX/);
  });

  it("rejects a macro-enabled document", async () => {
    const macro = "application/vnd.ms-word.document.macroEnabled.main+xml";
    await fails(makeDocx(sampleCvLines, { contentType: macro }), "docx", /not a valid DOCX/);
  });

  it("rejects a document that unpacks to a huge size", async () => {
    const huge = `<w:t>${"a".repeat(60 * 1024 * 1024)}</w:t>`;
    const bomb = makeDocx([], { rawDocument: huge });
    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(() => extractDocxText(bomb)).toThrow(/too large/);
  });

  it("rejects a document with almost no text", async () => {
    await fails(makeDocx(["Hi"]), "docx", /almost no text/);
  });

  it("rejects text too long to be a CV instead of cutting it", async () => {
    await fails(makeDocx(["word ".repeat(20_000)]), "docx", /too much text/);
  });
});

describe("tidyText", () => {
  it("removes control characters and extra blank lines", () => {
    expect(tidyText("a\u0000b\r\n\r\n\r\n\r\n  c   d")).toBe("ab\n\nc d");
  });
});
