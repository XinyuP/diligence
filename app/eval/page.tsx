"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Play, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Scenario } from "@/lib/eval/scenarios";
import type { EvalReport } from "@/lib/eval/judge";

type RunState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; report: EvalReport; elapsedMs: number }
  | { state: "error"; message: string };

export default function EvalPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [runningAll, setRunningAll] = useState(false);

  useEffect(() => {
    fetch("/api/eval")
      .then((r) => r.json())
      .then((d) => setScenarios(d.scenarios ?? []))
      .catch(() => {});
  }, []);

  const runOne = useCallback(async (scenarioId: string) => {
    setRuns((r) => ({ ...r, [scenarioId]: { state: "running" } }));
    try {
      const res = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, useCache: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "judge failed");
      setRuns((r) => ({
        ...r,
        [scenarioId]: {
          state: "done",
          report: data.report,
          elapsedMs: data.elapsedMs,
        },
      }));
    } catch (err) {
      setRuns((r) => ({
        ...r,
        [scenarioId]: { state: "error", message: (err as Error).message },
      }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    for (const s of scenarios) {
      // eslint-disable-next-line no-await-in-loop
      await runOne(s.id);
    }
    setRunningAll(false);
  }, [scenarios, runOne]);

  const done = scenarios
    .map((s) => runs[s.id])
    .filter((r): r is Extract<RunState, { state: "done" }> => r?.state === "done");
  const passed = done.filter((r) => r.report.verdict === "pass").length;
  const warned = done.filter((r) => r.report.verdict === "warn").length;
  const failed = done.filter((r) => r.report.verdict === "fail").length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Evaluation Harness
              </div>
              <div className="text-[11px] text-muted-foreground">
                Veris-style scenarios · completeness + hallucination grading
              </div>
            </div>
          </div>
          <Button onClick={runAll} disabled={runningAll || !scenarios.length}>
            {runningAll ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-2 h-3.5 w-3.5" />
            )}
            Run all scenarios
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {done.length ? (
          <div className="mb-6 grid grid-cols-4 gap-3 text-center">
            <ScoreCard label="Total" value={String(done.length)} />
            <ScoreCard label="Pass" value={String(passed)} tone="good" />
            <ScoreCard label="Warn" value={String(warned)} tone="warn" />
            <ScoreCard label="Fail" value={String(failed)} tone="bad" />
          </div>
        ) : null}

        <div className="space-y-4">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              state={runs[s.id] ?? { state: "idle" }}
              onRun={() => runOne(s.id)}
            />
          ))}
          {!scenarios.length ? (
            <div className="rounded border border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              Loading scenarios…
            </div>
          ) : null}
        </div>

        <div className="mt-10 rounded-lg border border-border/70 bg-muted/30 px-5 py-4 text-[13px] leading-relaxed text-muted-foreground">
          <div className="text-[11px] font-medium uppercase tracking-wider text-foreground">
            How this works
          </div>
          <p className="mt-2">
            Each scenario defines a curated set of <em>known truths</em> we
            expect any serious diligence memo to surface, plus a list of red
            flags. The judge grades the memo for <strong>completeness</strong>{" "}
            (how many known truths are covered), <strong>hallucination</strong>{" "}
            (any red flags asserted as fact), and re-uses the groundedness
            score from the agent&rsquo;s verifier pass. Structured so a Veris
            scenario feed can drop in without changing the harness.
          </p>
        </div>
      </main>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : tone === "bad"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded border border-border/70 bg-card px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  state,
  onRun,
}: {
  scenario: Scenario;
  state: RunState;
  onRun: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">
              {scenario.company}
            </h3>
            {state.state === "done" ? <Verdict verdict={state.report.verdict} /> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {scenario.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state.state === "done" ? (
            <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <span>
                Cov <span className="text-foreground">{state.report.completenessScore}</span>
              </span>
              <span>
                Ground{" "}
                <span className="text-foreground">
                  {state.report.groundedness ?? "—"}
                </span>
              </span>
              <span>
                Halluc{" "}
                <span
                  className={
                    state.report.hallucinationCount
                      ? "text-destructive"
                      : "text-foreground"
                  }
                >
                  {state.report.hallucinationCount}
                </span>
              </span>
            </div>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={onRun}
            disabled={state.state === "running"}
          >
            {state.state === "running" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Judge
          </Button>
        </div>
      </div>

      {state.state === "done" ? (
        <>
          <Separator />
          <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Coverage
              </div>
              <ul className="mt-2 space-y-2">
                {state.report.coverage.map((c) => (
                  <li key={c.factId} className="flex items-start gap-2 text-[13px]">
                    <CoverageIcon state={c.coverage} />
                    <div className="min-w-0">
                      <div className="text-foreground">{c.fact}</div>
                      {c.supportQuote ? (
                        <div className="mt-0.5 truncate text-xs italic text-muted-foreground">
                          “{c.supportQuote}”
                        </div>
                      ) : null}
                      {c.note ? (
                        <div className="mt-0.5 text-xs text-muted-foreground/80">
                          {c.note}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Hallucinations
              </div>
              {state.report.hallucinations.length ? (
                <ul className="mt-2 space-y-2">
                  {state.report.hallucinations.map((h, i) => (
                    <li
                      key={i}
                      className="rounded border border-destructive/40 bg-destructive/5 p-2.5 text-[13px]"
                    >
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        <div>
                          <div className="font-medium">“{h.claim}”</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Red flag: {h.redFlag}
                          </div>
                          {h.note ? (
                            <div className="mt-0.5 text-xs text-muted-foreground/80">
                              {h.note}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  None detected.
                </div>
              )}

              <div className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Judge summary
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed">
                {state.report.summary}
              </p>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Judged in {(state.elapsedMs / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        </>
      ) : null}

      {state.state === "error" ? (
        <>
          <Separator />
          <div className="px-5 py-3 text-sm text-destructive">
            {state.message}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Verdict({ verdict }: { verdict: EvalReport["verdict"] }) {
  if (verdict === "pass")
    return (
      <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
        pass
      </Badge>
    );
  if (verdict === "warn")
    return (
      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
        warn
      </Badge>
    );
  return (
    <Badge className="border-destructive/40 bg-destructive/10 text-destructive">
      fail
    </Badge>
  );
}

function CoverageIcon({ state }: { state: "covered" | "partial" | "missing" }) {
  if (state === "covered")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  if (state === "partial")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />;
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
}
