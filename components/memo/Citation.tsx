"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Source } from "@/lib/types";

export function Citation({ source }: { source?: Source }) {
  if (!source) {
    return (
      <span className="ml-0.5 inline-flex h-[1.15em] translate-y-[-0.1em] items-center rounded bg-muted px-1 font-mono text-[10px] leading-none text-muted-foreground">
        ?
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ml-0.5 inline-flex h-[1.15em] translate-y-[-0.1em] items-center rounded bg-foreground/90 px-1 font-mono text-[10px] leading-none text-background transition-colors hover:bg-foreground"
          aria-label={`Source ${source.id}: ${source.title}`}
        >
          {source.id}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{source.id}</span>
            <span className="truncate">{new URL(source.url).hostname}</span>
          </div>
          <div className="font-medium leading-snug">{source.title}</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {source.snippet.slice(0, 320)}
            {source.snippet.length > 320 ? "…" : ""}
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium underline underline-offset-2"
          >
            Open source →
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
