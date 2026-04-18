"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import type { Source } from "@/lib/types";
import { Citation } from "@/components/memo/Citation";

type Props = {
  body: string;
  sources: Source[];
};

const CITATION_RE = /\[S(\d+)\]/g;

export function MemoBody({ body, sources }: Props) {
  const byId = useMemo(() => {
    const m = new Map<string, Source>();
    for (const s of sources) m.set(s.id, s);
    return m;
  }, [sources]);

  const paragraphs = useMemo(() => {
    const trimmed = body.trim();
    if (!trimmed) return [] as string[];
    return trimmed.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  }, [body]);

  if (!paragraphs.length) return null;

  return (
    <div className="space-y-4 font-serif text-[17px] leading-[1.7] text-foreground/90">
      {paragraphs.map((p, i) => (
        <Paragraph key={i} text={p} byId={byId} />
      ))}
    </div>
  );
}

function Paragraph({
  text,
  byId,
}: {
  text: string;
  byId: Map<string, Source>;
}) {
  // Bullet list detection — if all lines start with "- " or "• "
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const isList =
    lines.length > 1 && lines.every((l) => /^(-|\*|•)\s+/.test(l));

  if (isList) {
    return (
      <ul className="list-disc space-y-1.5 pl-6">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^(-|\*|•)\s+/, ""), byId)}</li>
        ))}
      </ul>
    );
  }

  return <p>{renderInline(text, byId)}</p>;
}

function renderInline(text: string, byId: Map<string, Source>) {
  const out: ReactNode[] = [];
  let lastIdx = 0;
  CITATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    const [full, num] = match;
    if (match.index > lastIdx) {
      out.push(renderBold(text.slice(lastIdx, match.index), key++));
    }
    const id = `S${num}`;
    out.push(<Citation key={key++} source={byId.get(id)} />);
    lastIdx = match.index + full.length;
  }
  if (lastIdx < text.length) {
    out.push(renderBold(text.slice(lastIdx), key++));
  }
  return <Fragment>{out}</Fragment>;
}

function renderBold(text: string, k: number) {
  // simple **bold** support
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Fragment key={k}>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </Fragment>
  );
}
