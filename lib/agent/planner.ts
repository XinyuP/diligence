import { generateObject } from "ai";
import { z } from "zod";
import { basetenModel } from "@/lib/llm/baseten";
import type { Dimension, PlannedQuery } from "@/lib/types";

const PlanSchema = z.object({
  queries: z
    .array(
      z.object({
        dimension: z.enum([
          "business",
          "market",
          "competition",
          "financials",
          "team",
          "sentiment",
          "risks",
          "news",
        ]),
        query: z.string().min(4).max(220),
        mode: z.enum(["search", "research"]),
        rationale: z.string().max(160),
      }),
    )
    .min(12)
    .max(24),
});

const SYSTEM = `You are a diligence research lead building the search plan for an investment memo.

Your job: given a target company, produce 16 to 22 *high-signal* web search queries grouped across these dimensions:
- business: product, ICP, revenue model, contract structure, notable customers
- market: TAM, SAM, growth rate, tailwinds, adjacent spaces, analyst sizing
- competition: direct competitors (named), adjacent threats, category leaders
- financials: funding rounds, investors, revenue estimates, ARR, growth, margins, burn
- team: founders, key execs, prior ventures, notable hires, departures
- sentiment: customer reviews, G2, Reddit, Hacker News threads, praise and complaints
- risks: lawsuits, regulatory exposure, customer concentration, churn, technical debt signals
- news: last 12 months of notable press, pivots, launches, layoffs

Rules:
- Each query should be something a skilled analyst would actually type into a search engine.
- Prefer *specific* queries ("Ramp vs Brex customer switching 2025") over generic ones ("Ramp competitors").
- Cover every dimension with 2-3 queries each.
- Mark "research" mode for at most 3 queries where a deep, multi-source synthesis matters most (usually financials and competition). Mark everything else "search".
- Never suggest a query that only returns the company's own website.
- Include the company name explicitly in every query.`;

export async function planResearch(opts: {
  company: string;
  context?: string;
}): Promise<PlannedQuery[]> {
  const prompt = opts.context
    ? `Target company: ${opts.company}\nExtra context from the user:\n${opts.context}`
    : `Target company: ${opts.company}`;

  const { object } = await generateObject({
    model: basetenModel(),
    schema: PlanSchema,
    system: SYSTEM,
    prompt,
    temperature: 0.3,
  });

  const seen = new Set<string>();
  const queries: PlannedQuery[] = [];
  for (const q of object.queries) {
    const key = q.query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push({
      dimension: q.dimension as Dimension,
      query: q.query,
      mode: q.mode,
    });
  }
  return queries;
}
