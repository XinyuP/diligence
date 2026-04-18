export type Dimension =
  | "business"
  | "market"
  | "competition"
  | "financials"
  | "team"
  | "sentiment"
  | "risks"
  | "news";

export type Source = {
  id: string; // e.g. "S7"
  url: string;
  title: string;
  snippet: string;
  dimension: Dimension;
  query: string;
  publishedAt?: string;
  favicon?: string;
};

export type PlannedQuery = {
  dimension: Dimension;
  query: string;
  mode: "search" | "research";
};

export type MemoSection = {
  key: string;
  title: string;
  body: string; // markdown with inline [S1] [S3] citations
};

export type GroundednessFinding = {
  sectionKey: string;
  claim: string;
  supportedBy: string[]; // source IDs
  supported: boolean;
  note?: string;
};

export type VerifierReport = {
  score: number; // 0-100
  findings: GroundednessFinding[];
  summary: string;
};

export type Memo = {
  company: string;
  context?: string;
  generatedAt: string;
  sections: MemoSection[];
  sources: Source[];
  verifier?: VerifierReport;
  recommendation?: "pass" | "explore" | "prioritize";
  elapsedMs?: number;
};

export type AgentEvent =
  | { type: "status"; phase: string; message: string }
  | { type: "plan"; queries: PlannedQuery[] }
  | { type: "query.start"; id: string; dimension: Dimension; query: string }
  | { type: "query.done"; id: string; results: number }
  | { type: "source"; source: Source }
  | { type: "synth.section.start"; key: string; title: string }
  | { type: "synth.section.delta"; key: string; delta: string }
  | { type: "synth.section.done"; key: string; body: string }
  | { type: "verifier"; report: VerifierReport }
  | { type: "done"; memo: Memo }
  | { type: "error"; message: string };
