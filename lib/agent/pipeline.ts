import { planResearch } from "@/lib/agent/planner";
import { streamSection } from "@/lib/agent/synthesizer";
import { verifyMemo } from "@/lib/agent/verifier";
import { MEMO_SECTIONS } from "@/lib/memo/template";
import { youResearch, youSearch } from "@/lib/sources/you";
import { getCachedMemo, setCachedMemo } from "@/lib/cache";
import type {
  AgentEvent,
  Memo,
  MemoSection,
  PlannedQuery,
  Source,
} from "@/lib/types";

type Emit = (ev: AgentEvent) => void;

const MAX_QUERIES = 22;
const PER_QUERY_TIMEOUT_MS = 15_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function runAgent(opts: {
  company: string;
  context?: string;
  useCache: boolean;
  emit: Emit;
}): Promise<Memo> {
  const started = Date.now();
  const { company, context, useCache, emit } = opts;

  if (useCache) {
    const cached = await getCachedMemo(company);
    if (cached) {
      emit({
        type: "status",
        phase: "cache",
        message: `Replaying cached research run for ${company}…`,
      });
      await replayCached(cached, emit);
      return cached;
    }
  }

  emit({
    type: "status",
    phase: "plan",
    message: `Planning research outline for ${company}…`,
  });

  let planned: PlannedQuery[];
  try {
    planned = await planResearch({ company, context });
  } catch (err) {
    emit({
      type: "error",
      message: `Planner failed: ${(err as Error).message}`,
    });
    throw err;
  }
  planned = planned.slice(0, MAX_QUERIES);
  emit({ type: "plan", queries: planned });

  emit({
    type: "status",
    phase: "research",
    message: `Running ${planned.length} searches across 8 dimensions…`,
  });

  const sources: Source[] = [];
  let nextId = 1;
  const assignId = () => `S${nextId++}`;

  // Fan out in parallel but cap concurrency with chunks to avoid rate limits.
  const chunkSize = 5;
  for (let i = 0; i < planned.length; i += chunkSize) {
    const chunk = planned.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (q, j) => {
        const id = `q${i + j}`;
        emit({
          type: "query.start",
          id,
          dimension: q.dimension,
          query: q.query,
        });
        try {
          let results: Source[] = [];
          if (q.mode === "research") {
            const r = await withTimeout(
              youResearch({ query: q.query, dimension: q.dimension, effort: "standard" }),
              PER_QUERY_TIMEOUT_MS + 10_000,
              "you.com research",
            );
            results = r.sources;
          } else {
            results = await withTimeout(
              youSearch({ query: q.query, dimension: q.dimension, count: 6 }),
              PER_QUERY_TIMEOUT_MS,
              "you.com search",
            );
          }
          for (const s of results.slice(0, 6)) {
            if (!s.url) continue;
            if (sources.find((x) => x.url === s.url)) continue;
            const withId = { ...s, id: assignId() };
            sources.push(withId);
            emit({ type: "source", source: withId });
          }
          emit({ type: "query.done", id, results: results.length });
        } catch (err) {
          emit({
            type: "query.done",
            id,
            results: 0,
          });
          emit({
            type: "status",
            phase: "warn",
            message: `Query "${q.query.slice(0, 60)}" failed: ${(err as Error).message}`,
          });
        }
      }),
    );
  }

  emit({
    type: "status",
    phase: "synth",
    message: `Synthesizing memo from ${sources.length} sources…`,
  });

  const sections: MemoSection[] = [];
  for (const def of MEMO_SECTIONS) {
    const relevant = sources.filter((s) => def.dimensions.includes(s.dimension));
    const pool = relevant.length ? relevant : sources;
    const trimmed = pool.slice(0, 14);

    emit({ type: "synth.section.start", key: def.key, title: def.title });

    let body = "";
    try {
      const gen = streamSection({
        company,
        sectionKey: def.key,
        sources: trimmed,
        previousSections: sections,
        context,
      });
      while (true) {
        const { value, done } = await gen.next();
        if (done) {
          body = (value as string) || body;
          break;
        }
        body += value;
        emit({ type: "synth.section.delta", key: def.key, delta: value });
      }
    } catch (err) {
      body = `_Section failed: ${(err as Error).message}_`;
    }

    const section: MemoSection = { key: def.key, title: def.title, body: body.trim() };
    sections.push(section);
    emit({ type: "synth.section.done", key: def.key, body: section.body });
  }

  emit({
    type: "status",
    phase: "verify",
    message: "Running groundedness verifier on the memo…",
  });

  let verifier;
  try {
    verifier = await verifyMemo({ company, sections, sources });
    emit({ type: "verifier", report: verifier });
  } catch (err) {
    emit({
      type: "status",
      phase: "warn",
      message: `Verifier failed: ${(err as Error).message}`,
    });
  }

  const memo: Memo = {
    company,
    context,
    generatedAt: new Date().toISOString(),
    sections,
    sources,
    verifier,
    elapsedMs: Date.now() - started,
  };

  try {
    await setCachedMemo(memo);
  } catch {
    // best-effort
  }

  emit({ type: "done", memo });
  return memo;
}

async function replayCached(memo: Memo, emit: Emit): Promise<void> {
  emit({
    type: "plan",
    queries: [],
  });
  for (const s of memo.sources) {
    emit({ type: "source", source: s });
  }
  for (const section of memo.sections) {
    emit({ type: "synth.section.start", key: section.key, title: section.title });
    // Replay in small chunks for the live-reasoning feel.
    const chunks = section.body.match(/[\s\S]{1,24}/g) ?? [section.body];
    for (const c of chunks) {
      emit({ type: "synth.section.delta", key: section.key, delta: c });
      await new Promise((r) => setTimeout(r, 6));
    }
    emit({ type: "synth.section.done", key: section.key, body: section.body });
  }
  if (memo.verifier) {
    emit({ type: "verifier", report: memo.verifier });
  }
  emit({ type: "done", memo });
}
