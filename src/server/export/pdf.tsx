import "server-only";

import path from "node:path";

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import type { CvBlock, CvDocument, CvTemplate } from "@/lib/cv/document";

const font = (file: string) => path.join(process.cwd(), "assets", "fonts", file);

// Bundled because the fonts built into PDF readers have no Greek letters.
for (const family of ["Sans", "Serif"]) {
  Font.register({
    family,
    fonts: [
      { src: font(`Noto${family}_400Regular.ttf`) },
      { src: font(`Noto${family}_700Bold.ttf`), fontWeight: 700 },
      { src: font(`Noto${family}_400Regular_Italic.ttf`), fontStyle: "italic" },
    ],
  });
}

// Names and technical terms should never be split across lines.
Font.registerHyphenationCallback((word) => [word]);

type Theme = {
  family: string;
  size: number;
  nameSize: number;
  headingSize: number;
  gap: number;
  margin: number;
  centredHeader: boolean;
  accent: string;
  ruled: boolean;
};

const INK = "#1f2937";
const MUTED = "#4b5563";

const themes: Record<CvTemplate, Theme> = {
  classic: {
    family: "Serif",
    size: 10.5,
    nameSize: 20,
    headingSize: 11.5,
    gap: 12,
    margin: 48,
    centredHeader: true,
    accent: INK,
    ruled: true,
  },
  modern: {
    family: "Sans",
    size: 10,
    nameSize: 22,
    headingSize: 11,
    gap: 12,
    margin: 44,
    centredHeader: false,
    accent: "#0f766e",
    ruled: false,
  },
  compact: {
    family: "Sans",
    size: 9,
    nameSize: 16,
    headingSize: 9.5,
    gap: 7,
    margin: 34,
    centredHeader: false,
    accent: INK,
    ruled: true,
  },
};

const stylesFor = (theme: Theme) =>
  StyleSheet.create({
    page: {
      fontFamily: theme.family,
      fontSize: theme.size,
      lineHeight: 1.4,
      color: INK,
      padding: theme.margin,
    },
    header: { marginBottom: theme.gap, textAlign: theme.centredHeader ? "center" : "left" },
    name: { fontSize: theme.nameSize, fontWeight: 700, color: theme.accent, lineHeight: 1.2 },
    contact: { color: MUTED, marginTop: 3 },
    section: { marginBottom: theme.gap },
    heading: {
      fontSize: theme.headingSize,
      fontWeight: 700,
      color: theme.accent,
      marginBottom: 4,
      paddingBottom: theme.ruled ? 2 : 0,
      borderBottomWidth: theme.ruled ? 0.75 : 0,
      borderBottomColor: "#9ca3af",
    },
    block: { marginBottom: theme.gap / 2 },
    blockHead: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    title: { fontWeight: 700, flexShrink: 1 },
    dates: { color: MUTED, flexShrink: 0 },
    subtitle: { fontStyle: "italic", color: MUTED },
  });

type Styles = ReturnType<typeof stylesFor>;

function Block({ block, styles }: { block: CvBlock; styles: Styles }) {
  return (
    <View style={styles.block}>
      {(block.title || block.dates) && (
        <View style={styles.blockHead} wrap={false}>
          <Text style={styles.title}>{block.title}</Text>
          {block.dates && <Text style={styles.dates}>{block.dates}</Text>}
        </View>
      )}
      {block.subtitle && <Text style={styles.subtitle}>{block.subtitle}</Text>}
      {block.lines.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))}
    </View>
  );
}

export async function renderCvPdf(
  cv: CvDocument,
  template: CvTemplate,
  title: string,
): Promise<Buffer> {
  const styles = stylesFor(themes[template]);
  return renderToBuffer(
    <Document title={title} author={cv.name} creator="JOB HUNT" producer="JOB HUNT">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{cv.name}</Text>
          {cv.contact.length > 0 && <Text style={styles.contact}>{cv.contact.join(" | ")}</Text>}
        </View>
        {cv.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            {/* Stops a heading being left alone at the bottom of a page. */}
            <Text style={styles.heading} minPresenceAhead={40}>
              {section.heading}
            </Text>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} styles={styles} />
            ))}
          </View>
        ))}
      </Page>
    </Document>,
  );
}

type LetterDocument = {
  name: string;
  contact: string[];
  date: string;
  subject: string;
  paragraphs: string[];
};

export async function renderLetterPdf(letter: LetterDocument, title: string): Promise<Buffer> {
  const theme = themes.modern;
  const styles = stylesFor({ ...theme, accent: INK, size: 10.5, nameSize: 16 });
  return renderToBuffer(
    <Document title={title} author={letter.name} creator="JOB HUNT" producer="JOB HUNT">
      <Page size="A4" style={{ ...styles.page, padding: 56 }}>
        <View style={styles.header}>
          {letter.name && <Text style={styles.name}>{letter.name}</Text>}
          {letter.contact.length > 0 && (
            <Text style={styles.contact}>{letter.contact.join(" | ")}</Text>
          )}
        </View>
        <Text style={{ marginBottom: 12, color: MUTED }}>{letter.date}</Text>
        <Text style={{ marginBottom: 12, fontWeight: 700 }}>{letter.subject}</Text>
        {letter.paragraphs.map((paragraph, index) => (
          <Text key={index} style={{ marginBottom: 10 }}>
            {paragraph}
          </Text>
        ))}
      </Page>
    </Document>,
  );
}

/** The private headers every exported document is sent with. */
export function pdfResponseHeaders(fileName: string, size: number) {
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(size),
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
