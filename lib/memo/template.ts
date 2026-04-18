import type { Dimension } from "@/lib/types";

export type SectionDef = {
  key: string;
  title: string;
  purpose: string; // shown to synthesizer
  dimensions: Dimension[]; // which source buckets feed it
  wordTarget: [number, number];
};

export const MEMO_SECTIONS: SectionDef[] = [
  {
    key: "summary",
    title: "Executive Summary",
    purpose:
      "Three tight bullets: what the company does (one sentence), why it matters right now, and the recommendation (Pass / Explore / Prioritize) with a one-line rationale.",
    dimensions: ["business", "market", "financials"],
    wordTarget: [80, 150],
  },
  {
    key: "business",
    title: "Business Overview",
    purpose:
      "What they sell, who buys it (ICP with named examples if available), and how they make money. Revenue model, pricing, contract motion if known.",
    dimensions: ["business", "sentiment"],
    wordTarget: [150, 250],
  },
  {
    key: "market",
    title: "Market & TAM",
    purpose:
      "Market size, growth rate, tailwinds, and adjacent wedges. Cite published market research or analyst numbers. Call out if numbers look inflated.",
    dimensions: ["market", "news"],
    wordTarget: [150, 250],
  },
  {
    key: "competition",
    title: "Competitive Landscape",
    purpose:
      "Name 3-5 real competitors (direct and adjacent). For each, one line on positioning vs the target. Say who is winning what.",
    dimensions: ["competition"],
    wordTarget: [180, 280],
  },
  {
    key: "financials",
    title: "Financial Signals",
    purpose:
      "Funding history (rounds, investors, amounts, dates), revenue estimates or disclosed ARR, growth rate, and any public margin signals. If numbers are estimated, label them as estimates.",
    dimensions: ["financials", "news"],
    wordTarget: [180, 280],
  },
  {
    key: "team",
    title: "Team",
    purpose:
      "Founders and key executives. Prior roles, notable wins, any concerning signals. Focus on people who actually move the needle.",
    dimensions: ["team"],
    wordTarget: [120, 220],
  },
  {
    key: "sentiment",
    title: "Customer & Product Sentiment",
    purpose:
      "What real users say. Pull from G2, Reddit, Hacker News, review sites. Favor specific quotes over vibes. Call out the loudest complaint and the loudest praise.",
    dimensions: ["sentiment"],
    wordTarget: [140, 240],
  },
  {
    key: "risks",
    title: "Risks",
    purpose:
      "Three to five concrete risks (technical, market, regulatory, team, customer concentration). Evidence required — no generic 'market risk'.",
    dimensions: ["risks", "news", "competition"],
    wordTarget: [150, 260],
  },
  {
    key: "questions",
    title: "Diligence Questions",
    purpose:
      "Five to seven sharp questions an operator should ask management. Questions should be answerable in a meeting and expose the risks above.",
    dimensions: ["business", "financials", "risks"],
    wordTarget: [100, 180],
  },
  {
    key: "recommendation",
    title: "Recommendation",
    purpose:
      "Final call: Pass / Explore / Prioritize, with two or three sentences of rationale anchored to the strongest evidence in the memo.",
    dimensions: ["business", "financials", "risks", "market"],
    wordTarget: [80, 140],
  },
];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  business: "Business Model",
  market: "Market & TAM",
  competition: "Competitive Landscape",
  financials: "Financial Signals",
  team: "Team",
  sentiment: "Customer & Product Sentiment",
  risks: "Risks & Red Flags",
  news: "Recent News",
};
