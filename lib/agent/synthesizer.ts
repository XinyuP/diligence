import { streamText } from "ai";
import { basetenModel } from "@/lib/llm/baseten";
import { MEMO_SECTIONS } from "@/lib/memo/template";
import type { MemoSection, Source } from "@/lib/types";

const SYSTEM = `You are a senior investor writing a tightly sourced diligence memo for a lower-middle-market PE associate or search fund principal.

Hard requirements:
- Write in plain, declarative prose. No marketing language, no "transformative", no "cutting-edge".
- Every factual claim MUST end with one or more bracketed source tags like [S3] or [S3][S7]. No exceptions.
- If a fact is not in the provided sources, do not write it. Say "not disclosed in public sources" instead.
- Use numbers when sources give them. Do not invent numbers. If a number is an estimate, label it ("est.") and cite the source.
- Short paragraphs (2-4 sentences). No filler sentences. No restating the section title.
- Do not use emoji, headers, or markdown beyond bold and bullet lists. The enclosing renderer adds section titles.
- Do not address the reader. Do not say "as you can see" or "in this section".
- When a source contradicts another, note both and pick the more recent / more credible one — and say why.`;

function formatSources(sources: Source[]): string {
  return sources
    .map(
      (s) =>
        `[${s.id}] ${s.title} — ${s.url}\n    ${s.snippet.replace(/\s+/g, " ").slice(0, 500)}`,
    )
    .join("\n");
}

export async function* streamSection(opts: {
  company: string;
  sectionKey: string;
  sources: Source[];
  previousSections: MemoSection[];
  context?: string;
}): AsyncGenerator<string, string, void> {
  const def = MEMO_SECTIONS.find((s) => s.key === opts.sectionKey);
  if (!def) throw new Error(`Unknown section: ${opts.sectionKey}`);

  const prior = opts.previousSections
    .map((s) => `## ${s.title}\n${s.body}`)
    .join("\n\n");

  const sourceBlock = opts.sources.length
    ? formatSources(opts.sources)
    : "(no directly relevant sources were gathered for this section — say what you honestly can and call out the gap)";

  const userPrompt = `Target company: ${opts.company}${opts.context ? `\nContext: ${opts.context}` : ""}

Write the **${def.title}** section of the diligence memo.

Purpose: ${def.purpose}

Target length: ${def.wordTarget[0]}-${def.wordTarget[1]} words.

Available sources (use the bracketed IDs exactly as shown):
${sourceBlock}

${prior ? `Sections already written (do not repeat — build on them):\n${prior}\n` : ""}
Output the section body only. Do not include the section title or any preamble.`;

  const { textStream } = streamText({
    model: basetenModel(),
    system: SYSTEM,
    prompt: userPrompt,
    temperature: 0.25,
  });

  let full = "";
  for await (const delta of textStream) {
    full += delta;
    yield delta;
  }
  return full.trim();
}
