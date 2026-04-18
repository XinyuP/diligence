import { NextRequest } from "next/server";
import { SCENARIOS, findScenario } from "@/lib/eval/scenarios";
import { judgeMemo } from "@/lib/eval/judge";
import { getCachedMemo } from "@/lib/cache";
import { runAgent } from "@/lib/agent/pipeline";
import type { Memo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return Response.json({ scenarios: SCENARIOS });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    scenarioId?: string;
    useCache?: boolean;
  };
  const id = body.scenarioId;
  if (!id) {
    return Response.json({ error: "scenarioId required" }, { status: 400 });
  }
  const scenario = findScenario(id);
  if (!scenario) {
    return Response.json({ error: `unknown scenario: ${id}` }, { status: 404 });
  }

  const started = Date.now();

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
