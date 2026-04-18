import type { Dimension, Source } from "@/lib/types";

const SEARCH_URL = "https://ydc-index.io/v1/search";
const RESEARCH_URL = "https://api.you.com/v1/research";

type RawSearchResult = {
  url: string;
  title: string;
  description?: string;
  snippets?: string[];
  page_age?: string;
  favicon_url?: string;
  contents?: { markdown?: string; html?: string };
};

type SearchResponse = {
  results?: {
    web?: RawSearchResult[];
    news?: RawSearchResult[];
  };
  metadata?: { search_uuid?: string; query?: string };
};

type ResearchResponse = {
  answer?: string;
  sources?: { url: string; title?: string; snippet?: string }[];
};

function apiKey(): string {
  const k = process.env.YOU_API_KEY;
  if (!k) throw new Error("YOU_API_KEY is not set");
  return k;
}

function trimSnippet(s: string | undefined, max = 500): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function youSearch(opts: {
  query: string;
  dimension: Dimension;
  count?: number;
  freshness?: "day" | "week" | "month" | "year";
  includeDomains?: string[];
}): Promise<Source[]> {
  const params = new URLSearchParams();
  params.set("query", opts.query);
  params.set("count", String(opts.count ?? 6));
  if (opts.freshness) params.set("freshness", opts.freshness);
  if (opts.includeDomains?.length)
    params.set("include_domains", opts.includeDomains.join(","));

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: { "X-API-Key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`you.com search ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as SearchResponse;
  const web = data.results?.web ?? [];
  const news = data.results?.news ?? [];
  const combined = [...web, ...news];
  return combined.map((r, i) => ({
    id: "", // assigned by caller when merged
    url: r.url,
    title: r.title ?? r.url,
    snippet:
      trimSnippet(r.snippets?.join(" ") || r.description || r.contents?.markdown, 600),
    dimension: opts.dimension,
    query: opts.query,
    publishedAt: r.page_age,
    favicon: r.favicon_url,
  }));
}

export async function youResearch(opts: {
  query: string;
  dimension: Dimension;
  effort?: "lite" | "standard" | "deep" | "exhaustive";
}): Promise<{ answer: string; sources: Source[] }> {
  const res = await fetch(RESEARCH_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: opts.query,
      research_effort: opts.effort ?? "standard",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`you.com research ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as ResearchResponse;
  return {
    answer: data.answer ?? "",
    sources: (data.sources ?? []).map((s) => ({
      id: "",
      url: s.url,
      title: s.title ?? s.url,
      snippet: trimSnippet(s.snippet, 600),
      dimension: opts.dimension,
      query: opts.query,
    })),
  };
}
