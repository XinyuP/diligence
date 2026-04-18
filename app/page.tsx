"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, Gauge, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { streamAgentEvents } from "@/lib/sse-client";
import {
  RunPanel,
  buildInitialQueries,
  type QueryItem,
} from "@/components/app/RunPanel";
import { MemoBody } from "@/components/memo/MemoBody";
import type {
  AgentEvent,
  Memo,
  MemoSection,
  Source,
  VerifierReport,
} from "@/lib/types";

type SectionState = { title: string; body: string; done: boolean };

export default function Home() {
  const [company, setCompany] = useState("");
  const [context, setContext] = useState("");
  const [useCache, setUseCache] = useState(false);
  const [running, setRunning] = useState(false);
  const [abort, setAbort] = useState<AbortController | null>(null);

  const [phase, setPhase] = useState<string>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [verifier, setVerifier] = useState<VerifierReport | undefined>();
  const [memo, setMemo] = useState<Memo | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [warnings, setWarnings] = useState<string[]>([]);

  const reset = useCallback(() => {
    setPhase("idle");
    setPhaseMessage("");
    setQueries([]);
    setSources([]);
    setSections({});
    setSectionOrder([]);
    setVerifier(undefined);
    setMemo(undefined);
    setError(undefined);
    setWarnings([]);
  }, []);

  const handleEvent = useCallback((ev: AgentEvent) => {
    switch (ev.type) {
      case "status": {
        setPhase(ev.phase);
        if (ev.phase === "warn") {
          setWarnings((w) => [...w, ev.message]);
        } else {
          setPhaseMessage(ev.message);
        }
        break;
      }
      case "plan": {
        setQueries(buildInitialQueries(ev.queries));
        break;
      }
      case "query.start": {
        setQueries((qs) =>
          qs.map((q) => (q.id === ev.id ? { ...q, state: "running" } : q)),
        );
        break;
      }
      case "query.done": {
        setQueries((qs) =>
          qs.map((q) =>
            q.id === ev.id
              ? {
                  ...q,
                  state: ev.results > 0 ? "done" : "failed",
                  results: ev.results,
                }
              : q,
          ),
        );
        break;
      }
      case "source": {
        setSources((s) => (s.find((x) => x.id === ev.source.id) ? s : [...s, ev.source]));
        break;
      }
      case "synth.section.start": {
        setSectionOrder((o) => (o.includes(ev.key) ? o : [...o, ev.key]));
        setSections((s) => ({
          ...s,
          [ev.key]: { title: ev.title, body: "", done: false },
        }));
        setPhase("synth");
        setPhaseMessage(`Writing ${ev.title}…`);
        break;
      }
      case "synth.section.delta": {
        setSections((s) => {
          const cur = s[ev.key] ?? { title: ev.key, body: "", done: false };
          return { ...s, [ev.key]: { ...cur, body: cur.body + ev.delta } };
        });
        break;
      }
      case "synth.section.done": {
        setSections((s) => {
          const cur = s[ev.key] ?? { title: ev.key, body: ev.body, done: false };
          return { ...s, [ev.key]: { ...cur, body: ev.body, done: true } };
        });
        break;
      }
      case "verifier": {
        setVerifier(ev.report);
        break;
      }
      case "done": {
        setMemo(ev.memo);
        setPhase("done");
        setPhaseMessage(
          `Memo complete in ${Math.round((ev.memo.elapsedMs ?? 0) / 1000)}s · ${
            ev.memo.sources.length
          } sources`,
        );
        setRunning(false);
        setAbort(null);
        break;
      }
      case "error": {
        setError(ev.message);
        setPhase("error");
        setRunning(false);
        setAbort(null);
        break;
      }
    }
  }, []);

  const run = useCallback(async () => {
    const c = company.trim();
    if (!c) return;
    reset();
    setRunning(true);
    setPhase("plan");
    setPhaseMessage(`Planning research for ${c}…`);

    const ac = new AbortController();
    setAbort(ac);
    try {
      for await (const ev of streamAgentEvents(
        { company: c, context: context.trim() || undefined, useCache },
        ac.signal,
      )) {
        handleEvent(ev);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
        setPhase("error");
      }
      setRunning(false);
      setAbort(null);
    }
  }, [company, context, useCache, handleEvent, reset]);

  const cancel = useCallback(() => {
    if (abort) abort.abort();
    setRunning(false);
    setAbort(null);
  }, [abort]);

  const orderedSections: (MemoSection & { done: boolean })[] = useMemo(
    () =>
      sectionOrder
        .map((k) => {
          const s = sections[k];
          if (!s) return null;
          return { key: k, title: s.title, body: s.body, done: s.done };
        })
        .filter((x): x is MemoSection & { done: boolean } => x !== null),
    [sectionOrder, sections],
  );

  const exportPdf = useCallback(async () => {
    if (!memo) return;
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo }),
    });
    if (!res.ok) {
      alert("PDF export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${memo.company.replace(/\s+/g, "_")}-memo.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [memo]);

  const showWorkspace = running || orderedSections.length > 0 || !!error;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-7 w-7 place-items-center rounded border border-border bg-foreground text-[11px] font-semibold tracking-tight text-background">
              DA
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Diligence Analyst
              </div>
              <div className="text-[11px] text-muted-foreground">
                Sourced investment memos in under 90 seconds
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/eval"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Gauge className="h-3.5 w-3.5" /> Eval harness
            </Link>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>you.com</span>
              <span className="text-border">·</span>
              <span>Baseten</span>
              <span className="text-border">·</span>
              <span>Veris AI</span>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Company name (e.g. Ramp, Linear, Klaviyo)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={running}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !running && company.trim()) run();
              }}
              className="h-11 flex-1 text-[15px]"
            />
            <Input
              placeholder="Optional URL or context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              disabled={running}
              className="h-11 w-full text-[13px] sm:w-64"
            />
            {running ? (
              <Button
                variant="outline"
                className="h-11 w-full sm:w-40"
                onClick={cancel}
              >
                <Square className="mr-2 h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button
                onClick={run}
                disabled={!company.trim()}
                className="h-11 w-full sm:w-40"
              >
                <Play className="mr-2 h-3.5 w-3.5" /> Generate memo
              </Button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <label className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={useCache}
                onChange={(e) => setUseCache(e.target.checked)}
                className="h-3 w-3 accent-foreground"
                disabled={running}
              />
              Use cached run if available (demo mode)
            </label>
          </div>
        </div>
      </section>

      {showWorkspace ? (
        <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
            <RunPanel
              phase={phase}
              phaseMessage={phaseMessage}
              queries={queries}
              sources={sources}
              warnings={warnings}
              error={error}
            />
          </div>

          <article className="min-w-0 rounded-lg border border-border/80 bg-card">
            <div className="border-b border-border/70 px-8 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Diligence Memo
                  </div>
                  <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight">
                    {company || "Untitled"}
                  </h1>
                  {context ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {context}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {verifier ? (
                    <GroundednessBadge score={verifier.score} />
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportPdf}
                    disabled={!memo}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/70">
              {orderedSections.map((s) => (
                <section key={s.key} className="px-8 py-6">
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-serif text-[20px] font-semibold tracking-tight">
                      {s.title}
                    </h2>
                    {!s.done && running ? (
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Writing…
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <MemoBody body={s.body} sources={sources} />
                  </div>
                </section>
              ))}

              {verifier ? (
                <section className="px-8 py-6">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Groundedness Report
                  </div>
                  <p className="mt-2 font-serif text-[16px] leading-relaxed">
                    {verifier.summary}
                  </p>
                  {verifier.findings.filter((f) => !f.supported).length ? (
                    <div className="mt-3 space-y-2">
                      {verifier.findings
                        .filter((f) => !f.supported)
                        .map((f, i) => (
                          <div
                            key={i}
                            className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-[13px]"
                          >
                            <div className="font-medium">Unsupported claim</div>
                            <div className="mt-1 text-muted-foreground">
                              “{f.claim}”
                            </div>
                            {f.note ? (
                              <div className="mt-1 text-xs text-muted-foreground/80">
                                {f.note}
                              </div>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {sources.length ? (
                <section className="px-8 py-6">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Sources
                  </div>
                  <ol className="mt-3 space-y-2">
                    {sources.map((s) => (
                      <li key={s.id} className="flex items-start gap-3 text-[13px]">
                        <Badge
                          variant="outline"
                          className="mt-0.5 h-5 shrink-0 rounded px-1.5 font-mono text-[10px]"
                        >
                          {s.id}
                        </Badge>
                        <div className="min-w-0">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {s.title}
                          </a>
                          <div className="truncate text-xs text-muted-foreground">
                            {hostnameOf(s.url)} · {s.url}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          </article>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="max-w-xl space-y-4">
            <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              A diligence memo on any company, in under 90 seconds.
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Point the agent at a target. It plans a research outline,
              runs 20+ targeted searches through you.com, and synthesizes a
              structured memo on Baseten with every claim linked to its source.
              A verifier pass flags anything that isn&rsquo;t supported by the
              evidence it gathered.
            </p>
            <Separator className="mx-auto my-4 max-w-32" />
            <div className="text-[12px] text-muted-foreground">
              Try{" "}
              {["Ramp", "Linear", "Klaviyo"].map((name, i, arr) => (
                <button
                  key={name}
                  onClick={() => setCompany(name)}
                  className="font-medium text-foreground underline underline-offset-2 hover:opacity-70"
                >
                  {name}
                  {i < arr.length - 1 ? (
                    <span className="font-normal text-muted-foreground">, </span>
                  ) : null}
                </button>
              ))}
              .
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

function GroundednessBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
      : score >= 65
      ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium ${tone}`}
      title="Groundedness score — how well every claim is supported by the cited sources."
    >
      <span className="uppercase tracking-wider">Grounded</span>
      <span className="font-mono tabular-nums">{score}</span>
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
