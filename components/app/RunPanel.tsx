"use client";

import { useEffect, useMemo, useRef } from "react";
import { Search, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DIMENSION_LABELS } from "@/lib/memo/template";
import type { Dimension, PlannedQuery, Source } from "@/lib/types";

export type QueryItem = {
  id: string;
  query: string;
  dimension: Dimension;
  state: "pending" | "running" | "done" | "failed";
  results?: number;
};

type Props = {
  phase: string;
  phaseMessage: string;
  queries: QueryItem[];
  sources: Source[];
  warnings: string[];
  error?: string;
};

export function RunPanel({
  phase,
  phaseMessage,
  queries,
  sources,
  warnings,
  error,
}: Props) {
  const byDim = useMemo(() => {
    const m = new Map<Dimension, QueryItem[]>();
    for (const q of queries) {
      const arr = m.get(q.dimension) ?? [];
      arr.push(q);
      m.set(q.dimension, arr);
    }
    return m;
  }, [queries]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sources.length, queries.length]);

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border/80 bg-card">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <PhaseIcon phase={phase} />
          <span>{phase === "idle" ? "Agent" : phase}</span>
        </div>
        <div className="mt-1 font-mono text-[13px] leading-snug text-foreground">
          {phaseMessage || "Waiting for input."}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 pb-4">
          {error ? (
            <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          ) : null}

          {warnings.length ? (
            <div className="space-y-1">
              {warnings.slice(-4).map((w, i) => (
                <div
                  key={i}
                  className="rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 font-mono text-[11px] text-amber-900 dark:text-amber-200"
                >
                  {w}
                </div>
              ))}
            </div>
          ) : null}

          {queries.length === 0 ? (
            <div className="pt-8 text-center text-sm text-muted-foreground">
              Enter a company to begin.
            </div>
          ) : null}

          {Array.from(byDim.entries()).map(([dim, items]) => (
            <div key={dim} className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>{DIMENSION_LABELS[dim]}</span>
                <span className="text-muted-foreground/60">· {items.length}</span>
              </div>
              <ul className="space-y-1">
                {items.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-start gap-2 font-mono text-[12px] leading-snug"
                  >
                    <StateIcon state={q.state} />
                    <span
                      className={
                        q.state === "done"
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }
                    >
                      {q.query}
                      {q.state === "done" && typeof q.results === "number" ? (
                        <span className="ml-1 text-muted-foreground/70">
                          · {q.results} results
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {sources.length ? (
            <div className="pt-3">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Sources collected · {sources.length}
              </div>
              <ul className="space-y-1.5">
                {sources.slice(-8).map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[12px]">
                    <Badge
                      variant="outline"
                      className="h-5 rounded px-1.5 font-mono text-[10px]"
                    >
                      {s.id}
                    </Badge>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-muted-foreground hover:text-foreground"
                      title={s.title}
                    >
                      {hostnameOf(s.url)} · {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
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

function PhaseIcon({ phase }: { phase: string }) {
  if (phase === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (phase === "idle") return <Search className="h-3.5 w-3.5" />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
}

function StateIcon({ state }: { state: QueryItem["state"] }) {
  if (state === "done")
    return <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />;
  if (state === "failed")
    return <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />;
  if (state === "running")
    return <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-foreground" />;
  return <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />;
}

export function buildInitialQueries(plan: PlannedQuery[]): QueryItem[] {
  return plan.map((p, i) => ({
    id: `q${i}`,
    query: p.query,
    dimension: p.dimension,
    state: "pending" as const,
  }));
}
