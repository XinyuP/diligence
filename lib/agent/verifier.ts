import { generateObject } from "ai";
import { z } from "zod";
import { basetenModel } from "@/lib/llm/baseten";
import type { MemoSection, Source, VerifierReport } from "@/lib/types";

const FindingSchema = z.object({
  sectionKey: z.string(),
  claim: z.string().min(10).max(400),
  citedSources: z.array(z.string()),
  supported: z.boolean(),
  note: z.string().max(260).optional(),
});

const VerifierSchema = z.object({
  findings: z.array(FindingSchema).max(40),
  overallScore: z.number().min(0).max(100),
  summary: z.string().min(20).max(400),
});

const SYSTEM = `You are a strict diligence fact-checker. You audit claims in an investment memo against the specific sources the writer cited.

For each meaningful factual claim (numbers, named people, dates, competitor names, funding events, market sizes), decide:
- supported = true if the cited sources' snippets actually say (or clearly imply) the claim.
- supported = false if the snippets don't say it, contradict it, or are too vague.

Be strict. "The market is growing" with no number is not supported by a source about "the market is growing fast". A paraphrase is fine. An invented number is not.

Output at most 3 findings per section. Cover the most load-bearing claims.

overallScore (0-100): 100 = every claim supported. Subtract ~15 per unsupported load-bearing claim. Score below 60 means the memo has material hallucinations.
summary: one plain sentence on the memo's overall groundedness and any red flags.`;

function formatSections(sections: MemoSection[]): string {
  return sections
    .map((s) => `## ${s.key} — ${s.title}\n${s.body}`)
    .join("\n\n");
}

function formatSources(sources: Source[]): string {
  return sources
    .map(
      (s) =>
        `[${s.id}] ${s.title} — ${s.url}\n    ${s.snippet.replace(/\s+/g, " ").slice(0, 500)}`,
    )
    .join("\n");
}

export async function verifyMemo(opts: {
  company: string;
  sections: MemoSection[];
  sources: Source[];
}): Promise<VerifierReport> {
  const prompt = `Target company: ${opts.company}

Sources (authoritative — these are the ONLY evidence the memo had):
${formatSources(opts.sources)}

Memo to audit:
${formatSections(opts.sections)}`;

  const { object } = await generateObject({
    model: basetenModel(),
    schema: VerifierSchema,
    system: SYSTEM,
    prompt,
    temperature: 0.1,
  });

  return {
    score: Math.round(object.overallScore),
    summary: object.summary,
    findings: object.findings.map((f) => ({
      sectionKey: f.sectionKey,
      claim: f.claim,
      supportedBy: f.citedSources,
      supported: f.supported,
      note: f.note,
    })),
  };
}
