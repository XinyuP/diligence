import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Memo, Source } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontSize: 11,
    lineHeight: 1.55,
    color: "#18181b",
    fontFamily: "Times-Roman",
  },
  header: {
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#71717a",
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 24,
    marginTop: 4,
    fontFamily: "Times-Bold",
  },
  meta: {
    marginTop: 6,
    fontSize: 9,
    color: "#52525b",
    fontFamily: "Helvetica",
  },
  score: {
    marginTop: 8,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 6,
    textAlign: "justify",
  },
  citation: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#52525b",
    verticalAlign: "super",
  },
  bullet: {
    marginLeft: 12,
    marginBottom: 3,
    flexDirection: "row",
  },
  bulletDot: {
    width: 10,
  },
  bulletBody: {
    flex: 1,
  },
  sourcesTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#3f3f46",
  },
  sourceRow: {
    flexDirection: "row",
    marginBottom: 4,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  sourceId: {
    width: 28,
    fontFamily: "Helvetica-Bold",
    color: "#3f3f46",
  },
  sourceBody: {
    flex: 1,
  },
  sourceLink: {
    color: "#2563eb",
    textDecoration: "none",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 8,
    color: "#a1a1aa",
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica",
  },
});

const CITATION_RE = /\[S(\d+)\]/g;

function renderInline(text: string) {
  const parts: Array<string | { tag: string }> = [];
  let last = 0;
  CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ tag: `S${m[1]}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function stripBold(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1");
}

function renderParagraph(p: string, key: string) {
  const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const isList = lines.length > 1 && lines.every((l) => /^(-|\*|•)\s+/.test(l));
  if (isList) {
    return (
      <View key={key}>
        {lines.map((l, i) => {
          const clean = stripBold(l.replace(/^(-|\*|•)\s+/, ""));
          return (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletBody}>
                {renderInline(clean).map((part, j) =>
                  typeof part === "string" ? (
                    part
                  ) : (
                    <Text key={j} style={styles.citation}>
                      [{part.tag}]
                    </Text>
                  ),
                )}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
  const clean = stripBold(p);
  return (
    <Text key={key} style={styles.paragraph}>
      {renderInline(clean).map((part, j) =>
        typeof part === "string" ? (
          part
        ) : (
          <Text key={j} style={styles.citation}>
            [{part.tag}]
          </Text>
        ),
      )}
    </Text>
  );
}

export function MemoPdf({ memo }: { memo: Memo }) {
  const generated = new Date(memo.generatedAt);
  const dateStr = generated.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <Document
      title={`Diligence Memo — ${memo.company}`}
      author="Diligence Analyst"
      creator="Diligence Analyst"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Diligence Memo</Text>
          <Text style={styles.title}>{memo.company}</Text>
          <Text style={styles.meta}>
            Generated {dateStr} · {memo.sources.length} sources cited
          </Text>
          {memo.verifier ? (
            <Text style={styles.score}>
              Groundedness score: {memo.verifier.score}/100 — {memo.verifier.summary}
            </Text>
          ) : null}
        </View>

        {memo.sections.map((s) => {
          const paragraphs = s.body
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean);
          return (
            <View key={s.key} style={styles.section} wrap>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              {paragraphs.map((p, i) => renderParagraph(p, `${s.key}-${i}`))}
            </View>
          );
        })}

        <Text style={styles.sourcesTitle}>Sources</Text>
        {memo.sources.map((s: Source) => (
          <View key={s.id} style={styles.sourceRow} wrap={false}>
            <Text style={styles.sourceId}>{s.id}</Text>
            <View style={styles.sourceBody}>
              <Text>{s.title}</Text>
              <Link src={s.url} style={styles.sourceLink}>
                {s.url}
              </Link>
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Diligence Analyst · confidential working draft</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
