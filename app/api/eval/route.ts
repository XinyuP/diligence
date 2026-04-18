import { NextRequest } from "next/server";
import { SCENARIOS, findScenario } from "@/lib/eval/scenarios";
import { judgeMemo, judgeCachedMemo } from "@/lib/eval/judge";
import { getCachedMemo, listCachedMemos } from "@/lib/cache";
import { runAgent } from "@/lib/agent/pipeline";
import type { Memo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const scenarioCompanies = new Set(
    SCENARIOS.map((s) => s.company.toLowerCase()),
  );
  const cached = (await listCachedMemos())
    .filter((m) => !scenarioCompanies.has(m.company.toLowerCase()))
    .map((m) => ({
      company: m.company,
      generatedAt: m.generatedAt,
      sources: m.sources.length,
      groundedness: m.verifier?.score,
      recommendation: m.recommendation,
    }))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  return Response.json({ scenarios: SCENARIOS, cached });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    scenarioId?: string;
    company?: string;
    mode?: "scenario" | "cached";
    useCache?: boolean;
  };

  const started = Date.now();

  if (body.mode === "cached") {
    const company = body.company?.trim();
    if (!company) {
      return Response.json(
        { error: "company required for cached mode" },
        { status: 400 },
      );
    }
    const memo = await getCachedMemo(company);
    if (!memo) {
      return Response.json(
        { error: `no cached memo for ${company}` },
        { status: 404 },
      );
    }
    const report = await judgeCachedMemo({ memo });
    return Response.json({
      report,
      memo: {
        company: memo.company,
        generatedAt: memo.generatedAt,
        sources: memo.sources.length,
        groundedness: memo.verifier?.score,
      },
      elapsedMs: Date.now() - started,
    });
  }

  const id = body.scenarioId;
  if (!id) {
    return Response.json({ error: "scenarioId required" }, { status: 400 });
  }
  const scenario = findScenario(id);
  if (!scenario) {
    return Response.json({ error: `unknown scenario: ${id}` }, { status: 404 });
  }

  let memo: Memo | null = await getCachedMemo(scenario.company);
  if (!memo) {
    if (body.useCache === false) {
      return Response.json(
        { error: `no cached memo for ${scenario.company} — run it first` },
        { status: 409 },
      );
    }
    // Generate on-demand (no SSE; judges can wait a minute).
    memo = await runAgent({
      company: scenario.company,
      useCache: false,
      emit: () => {},
    });
  }

  const report = await judgeMemo({ memo, scenario });
  return Response.json({
    report,
    memo: {
      company: memo.company,
      generatedAt: memo.generatedAt,
      sources: memo.sources.length,
      groundedness: memo.verifier?.score,
    },
    elapsedMs: Date.now() - started,
  });
}
