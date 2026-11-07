export const MAX_CV_BYTES = 4 * 1024 * 1024;
export const MAX_CVS_PER_USER = 10;
export const MAX_CV_TEXT_LENGTH = 60_000;
export const MIN_CV_TEXT_LENGTH = 50;

export const cvMimeTypes = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type CvFileType = keyof typeof cvMimeTypes;

export const CV_ACCEPT = `.pdf,.docx,${cvMimeTypes.pdf},${cvMimeTypes.docx}`;

export function fileTypeFromName(name: string): CvFileType | null {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "pdf" || extension === "docx" ? extension : null;
}

/** The first bytes decide what a file really is. Its name and type are only claims. */
export function detectFileType(bytes: Uint8Array): CvFileType | null {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf";
  if (startsWith(0x50, 0x4b, 0x03, 0x04)) return "docx";
  return null;
}

/** Keeps the name usable as a storage key, which rejects many characters. */
export function safeFileName(name: string, type: CvFileType): string {
  const base = name
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^\w -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 80);
  return `${base || "cv"}.${type}`;
}

export function cvTitle(name: string): string {
  const title = name
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 200);
  return title || "My CV";
}
