// Veris-style evaluation scenarios.
// Each scenario is a target company with a curated set of "known truths" — facts
// we expect any serious diligence memo to surface. The judge scores how many
// known truths the memo covers (completeness), flags anything in the memo that
// contradicts them (hallucination), and rolls that into a pass/fail.
//
// Structured this way so the Veris API can slot in as the scenario source
// without changing the harness.

export type KnownFact = {
  id: string;
  category: "business" | "financials" | "team" | "competition" | "risk";
  fact: string; // short, declarative — what the memo should cover
  // A list of keywords we'd expect to see if the memo actually covered the fact;
  // used as a fast-path fallback if the LLM judge is unavailable.
  keywords: string[];
};

export type Scenario = {
  id: string;
  company: string;
  description: string;
  mustCover: KnownFact[];
  redFlags: string[]; // claims that would be hallucinations if present
};

export const SCENARIOS: Scenario[] = [
  {
    id: "ramp",
    company: "Ramp",
    description:
      "US fintech — corporate cards and finance automation, $22B+ class private company.",
    mustCover: [
      {
        id: "founders",
        category: "team",
        fact: "Founded by Eric Glyman and Karim Atiyeh in 2019, previously founded Paribus (acquired by Capital One).",
        keywords: ["Glyman", "Atiyeh", "Paribus", "Capital One"],
      },
      {
        id: "model",
        category: "business",
        fact: "Revenue comes from interchange on corporate cards plus SaaS subscription for finance automation.",
        keywords: ["interchange", "corporate card", "subscription"],
      },
      {
        id: "comp-brex",
        category: "competition",
        fact: "Brex is the most direct competitor; Rippling Spend is a broader suite threat.",
        keywords: ["Brex", "Rippling"],
      },
      {
        id: "funding",
        category: "financials",
        fact: "Has raised multi-billion total funding; most recent large primary round at a valuation in the ~$20-30B range.",
        keywords: ["billion", "Series", "valuation"],
      },
    ],
    redFlags: [
      "Ramp is publicly traded",
      "Ramp was acquired by",
      "Ramp is a cryptocurrency",
    ],
  },
  {
    id: "linear",
    company: "Linear",
    description: "Issue-tracking and project planning software, SaaS.",
    mustCover: [
      {
        id: "founders",
        category: "team",
        fact: "Co-founded by Karri Saarinen (ex-Airbnb/Coinbase design) and team.",
        keywords: ["Karri", "Saarinen"],
      },
      {
        id: "model",
        category: "business",
        fact: "Per-seat subscription pricing aimed at software engineering teams; competes with Jira and Asana.",
        keywords: ["seat", "Jira", "engineering"],
      },
      {
        id: "diff",
        category: "business",
        fact: "Differentiates on speed, keyboard-first UI, and opinionated workflow design.",
        keywords: ["speed", "keyboard", "opinionated"],
      },
      {
        id: "funding",
        category: "financials",
        fact: "Raised from tier-one funds (e.g., Sequoia, Accel) — private.",
        keywords: ["Sequoia", "Accel", "million"],
      },
    ],
    redFlags: [
      "Linear is publicly traded",
      "Linear was founded in 2005",
      "Linear is a hardware company",
    ],
  },
  {
    id: "klaviyo",
    company: "Klaviyo",
    description: "Public marketing automation platform for ecommerce.",
    mustCover: [
      {
        id: "ipo",
        category: "financials",
        fact: "Klaviyo IPO'd on NYSE in 2023 (ticker KVYO).",
        keywords: ["IPO", "NYSE", "KVYO"],
      },
      {
        id: "icp",
        category: "business",
        fact: "Primary ICP is mid-market and enterprise ecommerce brands, largely on Shopify.",
        keywords: ["Shopify", "ecommerce"],
      },
      {
        id: "comp",
        category: "competition",
        fact: "Competes with Mailchimp, Braze, and built-in email from Shopify.",
        keywords: ["Mailchimp", "Braze"],
      },
      {
        id: "founders",
        category: "team",
        fact: "Co-founded by Andrew Bialecki (CEO) and Ed Hallen.",
        keywords: ["Bialecki", "Hallen"],
      },
    ],
    redFlags: [
      "Klaviyo is a private company",
      "Klaviyo was acquired by",
      "Klaviyo is based in the UK",
    ],
  },
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id || s.company.toLowerCase() === id.toLowerCase());
}
