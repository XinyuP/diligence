import { generateObject } from "ai";
import { z } from "zod";
import { basetenModel } from "@/lib/llm/baseten";
import type { Memo } from "@/lib/types";
import type { KnownFact, Scenario } from "@/lib/eval/scenarios";

export type CoverageFinding = {
  factId: string;
  fact: string;
  category: KnownFact["category"];
  coverage: "covered" | "partial" | "missing";
  supportQuote?: string;
  note?: string;
};

export type HallucinationFinding = {
  claim: string;
  redFlag: string;
  note?: string;
};

export type EvalReport = {
  scenarioId: string;
  company: string;
  completenessScore: number; // 0-100
  hallucinationCount: number;
  groundedness?: number; // pulled from memo.verifier
  coverage: CoverageFinding[];
  hallucinations: HallucinationFinding[];
  verdict: "pass" | "warn" | "fail";
  summary: string;
  judgedAt: string;
};

export type ConsistencyFinding = {
  claim1: string;
  claim2: string;
  note?: string;
};

export type CachedEvalReport = {
  company: string;
  groundedness?: number;
  consistencyScore: number; // 0-100
  contradictions: ConsistencyFinding[];
  verdict: "pass" | "warn" | "fail";
  summary: string;
  judgedAt: string;
};

const JudgeSchema = z.object({
  coverage: z.array(
    z.object({
      factId: z.string(),
      coverage: z.enum(["covered", "partial", "missing"]),
      supportQuote: z.string().max(400).optional(),
      note: z.string().max(280).optional(),
    }),
  ),
  hallucinations: z.array(
    z.object({
      claim: z.string().min(5).max(400),
      redFlag: z.string().max(200),
      note: z.string().max(280).optional(),
    }),
  ),
  summary: z.string().min(20).max(400),
});

const SYSTEM = `You are an evaluator grading a diligence memo against a scenario of known truths.

For each known fact in mustCover:
- "covered" if the memo clearly states the fact (paraphrase OK).
- "partial" if the memo touches the topic but misses a key specific (name, number, year).
- "missing" if the memo doesn't mention it at all.
Provide a short supportQuote (directly from the memo) when "covered".

For hallucinations: examine the redFlags list. If the memo asserts anything equivalent to a red flag (or makes any factual claim that contradicts the memo's own cited evidence), list it.

Be strict but fair. Do not penalize the memo for facts that are outside the mustCover list.`;

function flattenMemo(memo: Memo): string {
  return memo.sections.map((s) => `## ${s.title}\n${s.body}`).join("\n\n");
}

function computeCompleteness(
  scenario: Scenario,
  coverage: CoverageFinding[],
): number {
  const total = scenario.mustCover.length;
  if (!total) return 100;
  const points = coverage.reduce((acc, c) => {
    if (c.coverage === "covered") return acc + 1;
    if (c.coverage === "partial") return acc + 0.5;
    return acc;
  }, 0);
  return Math.round((points / total) * 100);
}

export async function judgeMemo(opts: {
  memo: Memo;
  scenario: Scenario;
}): Promise<EvalReport> {
  const { memo, scenario } = opts;

  const factsList = scenario.mustCover
    .map(
      (f) =>
        `- id=${f.id} · category=${f.category}\n  fact: ${f.fact}\n  keywords: ${f.keywords.join(", ")}`,
    )
    .join("\n");
  const redFlagsList = scenario.redFlags.map((r) => `- ${r}`).join("\n");

  const prompt = `Scenario: ${scenario.description}

Known truths (mustCover) for ${scenario.company}:
${factsList}

Red flags (treat any equivalent claim in the memo as a hallucination):
${redFlagsList}

Memo to grade:
${flattenMemo(memo)}`;

  const { object } = await generateObject({
    model: basetenModel(),
    schema: JudgeSchema,
    system: SYSTEM,
    prompt,
    temperature: 0.1,
  });

  const coverage: CoverageFinding[] = scenario.mustCover.map((f) => {
    const match = object.coverage.find((c) => c.factId === f.id);
    return {
      factId: f.id,
      fact: f.fact,
      category: f.category,
      coverage: match?.coverage ?? "missing",
      supportQuote: match?.supportQuote,
      note: match?.note,
    };
  });

  const completenessScore = computeCompleteness(scenario, coverage);
  const hallucinationCount = object.hallucinations.length;
  const groundedness = memo.verifier?.score;

  const failed =
    hallucinationCount > 0 ||
    completenessScore < 60 ||
    (groundedness !== undefined && groundedness < 60);
  const warned =
    !failed &&
    (completenessScore < 80 || (groundedness !== undefined && groundedness < 80));

  return {
    scenarioId: scenario.id,
    company: scenario.company,
    completenessScore,
    hallucinationCount,
    groundedness,
    coverage,
    hallucinations: object.hallucinations,
    verdict: failed ? "fail" : warned ? "warn" : "pass",
    summary: object.summary,
    judgedAt: new Date().toISOString(),
  };
}

const CachedJudgeSchema = z.object({
  contradictions: z.array(
    z.object({
      claim1: z.string().min(5).max(400),
      claim2: z.string().min(5).max(400),
      note: z.string().max(280).optional(),
    }),
  ),
  summary: z.string().min(20).max(400),
});

const CACHED_SYSTEM = `You are an evaluator checking a diligence memo for internal consistency.

No curated ground truth is provided. Your job is narrow: scan the memo and flag any pair of statements that directly contradict each other (e.g., different founding years for the same company, conflicting funding totals, stating a company is both public and private, contradictory revenue or headcount numbers).

Be strict about actual contradictions — do not flag statements that are merely imprecise or complementary. Quote each conflicting claim verbatim from the memo.`;

export async function judgeCachedMemo(opts: {
  memo: Memo;
}): Promise<CachedEvalReport> {
  const { memo } = opts;

  const prompt = `Company: ${memo.company}

Memo:
${flattenMemo(memo)}`;

  const { object } = await generateObject({
    model: basetenModel(),
    schema: CachedJudgeSchema,
    system: CACHED_SYSTEM,
    prompt,
    temperature: 0.1,
  });

  const contradictions = object.contradictions;
  const consistencyScore = Math.max(0, 100 - contradictions.length * 25);
  const groundedness = memo.verifier?.score;

  const failed =
    contradictions.length > 0 ||
    (groundedness !== undefined && groundedness < 60);
  const warned =
    !failed && groundedness !== undefined && groundedness < 80;

  return {
    company: memo.company,
    groundedness,
    consistencyScore,
    contradictions,
    verdict: failed ? "fail" : warned ? "warn" : "pass",
    summary: object.summary,
    judgedAt: new Date().toISOString(),
  };
}
