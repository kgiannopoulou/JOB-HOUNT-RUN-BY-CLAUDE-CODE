import { strToU8, zipSync } from "fflate";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

const contentTypes = (type = DOCX_TYPE) =>
  `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="${type}"/></Types>`;

const escapeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const paragraph = (text: string) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;

const body = (lines: string[]) =>
  `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${lines.map(paragraph).join("")}</w:body></w:document>`;

type DocxOptions = { header?: string; contentType?: string; rawDocument?: string };

/** A real, minimal DOCX package. */
export function makeDocx(lines: string[], options: DocxOptions = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes(options.contentType)),
    "word/document.xml": strToU8(options.rawDocument ?? body(lines)),
  };
  if (options.header) {
    files["word/header1.xml"] = strToU8(
      `<w:hdr xmlns:w="w">${paragraph(options.header)}</w:hdr>`,
    );
  }
  return zipSync(files);
}

/** A real, minimal PDF with one page of text. With no lines it has no text at all. */
export function makePdf(lines: string[]): Uint8Array {
  const text = lines
    .map((line) => `(${line.replace(/[\\()]/g, "\\$&")}) Tj 0 -16 Td`)
    .join("\n");
  const stream = `BT /F1 11 Tf 50 780 Td\n${text}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

/** The text of the sample CV used across tests. Everyone in it is invented. */
export const sampleCvLines = [
  "Alex Example",
  "alex@example.com | +30 210 000 0000 | Athens, Greece",
  "Summary",
  "Data analyst who builds reporting for product teams.",
  "Experience",
  "Data Analyst, Example Analytics, January 2021 to Present",
  "Built weekly SQL reports for the sales team.",
  "Education",
  "BSc Statistics, University of Examples, 2017 to 2020",
  "Skills: SQL, Python, Excel, Power BI, Tableau",
  "Languages: Greek (native), English (C1)",
];
