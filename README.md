# Diligence

**An AI investment memo analyst. Point it at a company, watch it read the internet, get a sourced 10-section memo in under 90 seconds — with every claim cited and every citation verified.**

---

## Why this matters

Diligence work on private companies is the last software-untouched corner of finance. An associate at a search fund, a mid-market PE shop, or a corp-dev team spends **two to five days** on the first pass of a target: Googling, skimming ten tabs, cross-checking funding histories on Crunchbase, triangulating headcount from LinkedIn, stitching it into a Word doc nobody reads. The output is expensive, slow, and inconsistent across analysts.

Diligence compresses that first pass into ~90 seconds of visible, auditable research. A user enters a company name. The agent plans up to 22 targeted searches across 8 research dimensions, executes them in parallel against you.com, assigns every retrieved source a stable ID, and streams a structured 10-section memo on Baseten — with every factual claim tagged `[S7]` so the reader can click through to the primary source. A second model pass audits the finished memo for groundedness and flags anything unsupported. A Veris-style evaluation harness then grades it against a scenario of known truths.

It is not a ChatGPT wrapper. It is a research system.

---

## Problem

First-pass investment diligence today looks like this:

- An associate gets a target name on Monday morning.
- They open ten Chrome tabs: Crunchbase, Pitchbook, LinkedIn, the target's website, G2, Reddit, two news aggregators, the target's Careers page, and an AI chat.
- They paste findings into a running Google Doc.
- They ask ChatGPT for a summary. The summary is fluent and uncited. They cannot ship it.
- Two days later they hand a 6-page memo to a partner who reads the first page.

**Existing tools don't solve this:**
- *Generalist LLM chatbots* hallucinate, don't cite, and produce a blob of text that a reader cannot audit.
- *Perplexity-style answer engines* cite, but they answer a single question — not produce a structured, repeatable deliverable.
- *Data providers (Pitchbook, AlphaSense)* give you rows of data. They don't write the memo.
- *Existing AI research agents* are either general (deep research features in ChatGPT, Gemini) or locked to consumer use cases. None are shaped around the investment-memo workflow with auditable grounding as a first-class requirement.

The gap: a **structured, sourced, auditable** first-pass memo that lets an analyst skip straight to judgment.

---

## Solution

Diligence is an agent pipeline with four stages wired to a real-time UI:

1. **Plan** — A planner LLM call (`generateObject` with a strict Zod schema) emits 12–24 research queries tagged by dimension (`business`, `market`, `competition`, `financials`, `team`, `sentiment`, `risks`, `news`) and mode (`search` vs. deep `research`).
2. **Research** — Queries fan out against the you.com Search and Research APIs in chunks of five, with per-query timeouts. Every returned source gets a stable ID (`S1`, `S2`, …) assigned on arrival.
3. **Synthesize** — For each of 10 memo sections, a streaming LLM call writes the section conditioned only on the sources tagged with that section's dimensions, under a system prompt that makes every factual claim end in a `[S#]` citation. Sections stream to the browser token-by-token.
4. **Verify** — A final LLM pass reads the completed memo plus its source bundle and produces a 0–100 groundedness score plus a list of unsupported claims.

A second surface — `/eval` — runs a separate LLM judge against hand-authored scenarios to grade completeness (known-truth coverage) and hallucination count, producing pass/warn/fail verdicts. This is the evaluation layer for the system itself.

The user-facing experience is split-screen: a **live reasoning panel** on the left (the planner's outline, each query's state, every source as it arrives) and the **memo article** on the right, streaming in section by section. Inline `[S#]` tags are clickable popovers showing the source snippet and a link to the original URL. A PDF export renders the memo with full citations and a sources appendix.

This is deliberately different from a ChatGPT session. You watch the agent think. You can click any claim back to the internet.

---

## Why this is technically impressive

Built end-to-end in ~6 hours at Agent Jam NYC (2026-04-18) by one person. What's actually doing work under the hood:

- **A real agent graph, not a chatbot loop.** Planner → fan-out workers → per-section streaming synthesizer → verifier → cache, with a discriminated-union event bus that the frontend consumes over Server-Sent Events. 11 event types; no polling; full type safety from the agent to the React state.
- **Grounding as an invariant, not a prompt nicety.** Sources are assigned IDs on retrieval, those IDs are injected into the synthesizer's context, and the system prompt forces every claim to end in `[S#]`. The verifier then audits it. Hallucination is treated as a systems problem, not a wording problem.
- **Three distinct LLM shapes on one model endpoint.** `generateObject` (structured planner + judge + verifier) and `streamText` (synthesizer) — all routed through a single Baseten-hosted DeepSeek-V3.1 deployment. One model, four jobs, four prompt surfaces.
- **Streaming UX all the way through.** No "please wait 90 seconds." The UI shows the plan within 3 seconds, sources as they arrive, and memo sections as they stream from the model. This is the demo's unfakeable signal — you cannot pre-record this.
- **A real eval harness.** `/eval` is not a demo screenshot. It is a live judge endpoint that runs against cached memos, scored against hand-authored scenarios structured so the Veris API can slot in as the scenario source.
- **Demo-safe by design.** A file-backed memo cache replays a prior run as a synthetic SSE stream at roughly the same visual pace as a live run. If the stage wifi dies, the demo still runs.
- **PDF export that looks like a memo, not like HTML.** `@react-pdf/renderer` with serif body, bullets, and inline citation rendering — the output is the deliverable the user would actually send.

None of this is shimmed on top of a chatbot. Every line of the pipeline is bespoke to the investment-memo workflow.

---

## Who this is for

**Primary users:**
- **Search fund operators** running 3–5 targets a week and needing a credible first pass before the phone call.
- **Lower-middle-market PE associates** prepping diligence binders where speed and sourcing matter more than model aesthetics.
- **Corporate development teams** sizing up partnership or acquisition targets.

**Secondary users:**
- **Early-stage VC associates** triaging inbound decks.
- **Strategy consultants** doing market-entry or competitor landscapes.
- **Sell-side bankers** prepping pitch books.

Anyone whose job contains the sentence "write me a memo on $COMPANY by Thursday."

---

## Key features

- **90-second first-pass memo.** 10 sections, ~100 sources, ~1,600 words — structurally identical across every run.
- **Every claim cited.** Inline `[S#]` tags, clickable popovers, sources appendix.
- **Visible reasoning.** Live plan, live queries, live sources. Judges and users can watch the agent think.
- **Groundedness verifier.** A second LLM pass scores 0–100 and flags unsupported claims inline in the memo.
- **Veris-style eval dashboard.** `/eval` grades memos against known-truth scenarios. Pass / warn / fail verdicts, completeness score, hallucination count.
- **PDF export.** Serif-typeset memo with full citation rendering and sources appendix, ready to send.
- **Demo mode.** `DEMO_MODE=true` replays cached runs with the same live-streaming feel. Stage-safe.
- **Typed SSE pipeline.** One discriminated-union event type shared between the agent and the UI. No stringly-typed JSON contracts.

---

## End-to-end workflow

1. **Input.** User types a company name (and optionally a URL or free-text context) on `/`.
2. **Plan (~3s).** The POST to `/api/research` opens an SSE stream. The first event is the planner's 12–24 queries, grouped in the UI by dimension.
3. **Research (~30–45s).** Queries fan out to you.com in chunks of five. Each query's state (running / done / failed) updates live. Sources stream into the right-hand column as they arrive, each with its `S#` badge.
4. **Synthesize (~25–40s).** Sections stream one at a time, token by token. The title shows "Writing…" until the section finishes. Inline `[S#]` badges are clickable as soon as they appear.
5. **Verify (~5s).** The groundedness score appears in the memo header. Unsupported claims surface in a report card at the bottom of the memo.
6. **Export.** User clicks PDF. The server renders the memo through `@react-pdf/renderer` and streams it back as a download.
7. **Evaluate.** User navigates to `/eval`, hits "Run all scenarios," and watches the LLM judge grade each cached memo against known truths.

The whole loop from "click generate" to "read the memo" is sub-90 seconds on a warm backend.

---

## How Veris is used

Diligence uses Veris as the **shape** of its evaluation layer, not as a live dependency. The reason: during the hackathon, the publicly documented Veris product (`docs.veris.dev`) is a memory-provider integration for coding agents (Claude Code, Cursor, Codex CLI) — not a hosted eval API with a public judging endpoint.

What's in the repo:

- **`lib/eval/scenarios.ts`** — Scenarios structured exactly as a Veris feed would provide them: a target company, a `mustCover` list of known-truth facts (each with a category and keyword hints), and a `redFlags` list of claims that count as hallucinations if the memo asserts them. Three scenarios ship: Ramp, Linear, Klaviyo.
- **`lib/eval/judge.ts`** — An LLM judge (running on Baseten) that evaluates a memo against a scenario, producing per-fact coverage findings (covered / partial / missing), per-claim hallucinations tied to the red-flags list, a completeness score, and a pass/warn/fail verdict.
- **`app/eval/page.tsx`** — A dashboard that runs the judge over all scenarios and renders the findings.
- **`.env.local`** — `VERIS_API_KEY` and `VERIS_API_URL` placeholders are reserved; `lib/eval/scenarios.ts` is the one file that changes when Veris ships a scenario endpoint.

In short: Diligence is **Veris-compatible by construction**. When Veris exposes a scenario API, this code plugs into it by swapping the hardcoded `SCENARIOS` array for a fetched one.

This is called out honestly because lying to judges about a sponsor integration is worse than shipping a clean adapter.

---

## How You.com is used

you.com is the research backbone. Every external fact in every memo enters the system through one of two you.com endpoints:

- **Search API** (`ydc-index.io/v1/search`) — Fast, broad retrieval. Used for targeted factual queries the planner marks as `mode: "search"`. Typical latency under a second. Each call returns up to six deduplicated sources per query.
- **Research API** (`api.you.com/v1/research`) — Deeper multi-hop research with a `research_effort` knob. Used for the planner's `mode: "research"` queries — the ones where a single search won't cut it, like "Klaviyo vs Mailchimp vs Braze feature comparison 2025." Higher latency, significantly richer sources.

The planner chooses `mode` per query based on the question shape; the pipeline's fan-out worker routes accordingly. A typical run issues ~18 search calls and ~4 research calls, yielding 80–110 unique sources after URL deduplication.

Sources are normalized into a shared `Source` shape (`id`, `url`, `title`, `snippet`, `dimension`, `query`) and passed to the synthesizer. The synthesizer never sees raw HTML — only the structured source bundle, which keeps the context window tight and the citations honest.

**Why you.com:** it is the only search API that exposes both shallow search and deep research from the same provider with one key, which matters for an agent that wants to choose its own depth per query. Everything else would require juggling two vendors.

Implementation: `lib/sources/you.ts`. Call sites: `lib/agent/pipeline.ts` fan-out loop.

---

## How Baseten is used

Baseten hosts **the one and only LLM** in the system: **DeepSeek-V3.1**, served via Baseten's OpenAI-compatible inference endpoint at `https://inference.baseten.co/v1`. Every LLM call in the product — four distinct ones — goes through the same provider and model:

1. **Planner** (`lib/agent/planner.ts`) — `generateObject` with a Zod schema producing 12–24 typed query objects.
2. **Synthesizer** (`lib/agent/synthesizer.ts`) — `streamText` producing one memo section at a time, under a strict `[S#]` citation prompt.
3. **Verifier** (`lib/agent/verifier.ts`) — `generateObject` auditing the finished memo, producing a score and findings.
4. **Eval judge** (`lib/eval/judge.ts`) — `generateObject` grading memos against scenarios.

**Why Baseten:**
- **OpenAI-compat is a first-class citizen, not a wrapper.** Swapping DeepSeek-V3.1 for any other frontier open model is a one-line env var change.
- **One endpoint, four jobs.** No multi-provider juggling, no per-model config drift.
- **Throughput over latency.** The synthesizer streams 10 sections sequentially; the planner and judge run `generateObject` with structured output. Baseten's inference tier handles both cases without tuning.

**One real engineering note:** the AI SDK v6 defaults to OpenAI's newer `/v1/responses` endpoint, which Baseten does not implement. `lib/llm/baseten.ts` forces the provider's `.chat()` method so all calls hit `/v1/chat/completions`. If you don't do this, every call returns `missing field: messages`. The fix is one line, but it's not obvious.

Integration file: `lib/llm/baseten.ts` (26 lines). This is the entire LLM provider layer.

---

## Architecture overview

```
┌───────────────────────────────────────────────────────────────┐
│                        Browser (React 19)                      │
│                                                                │
│  app/page.tsx ──── SSE reader (lib/sse-client.ts) ────┐        │
│       │                                                │        │
│       ├─ RunPanel (live queries + sources)             │        │
│       ├─ MemoBody (streaming sections, [S#] popovers)  │        │
│       └─ PDF download button                           │        │
│                                                        │        │
└────────────────────────────────────────────────────────┼────────┘
                                                         │
                                      Server-Sent Events │
                                                         │
┌────────────────────────────────────────────────────────┼────────┐
│                 Next.js 16 App Router (Node runtime)   │        │
│                                                        ▼        │
│  POST /api/research ────── lib/agent/pipeline.ts ──── emit()    │
│                                  │                              │
│                                  ▼                              │
│                   ┌──────────────────────────────┐              │
│                   │  Planner                     │              │
│                   │  (generateObject + Zod)      │────────┐     │
│                   └──────────────────────────────┘        │     │
│                                  │                        │     │
│                                  ▼                        │     │
│                   ┌──────────────────────────────┐        │     │
│   lib/sources/ ───│  Fan-out research workers    │        │     │
│   you.ts          │  (chunks of 5, 15s timeout)  │        │     │
│                   └──────────────────────────────┘        │     │
│                                  │                        │     │
│                                  ▼                        │     │
│                   ┌──────────────────────────────┐        │     │
│                   │  Synthesizer (per section)   │        │     │
│                   │  (streamText, [S#] enforced) │        │     │
│                   └──────────────────────────────┘        │     │
│                                  │                        │     │
│                                  ▼                        │     │
│                   ┌──────────────────────────────┐        │     │
│                   │  Verifier                    │        │     │
│                   │  (generateObject audit)      │        │     │
│                   └──────────────────────────────┘        │     │
│                                  │                        │     │
│                                  ▼                        │     │
│                        data/cache.json                    │     │
│                                                           │     │
│  POST /api/eval  ── lib/eval/judge.ts ────────────────────┤     │
│  POST /api/pdf   ── @react-pdf/renderer stream            │     │
│  GET  /api/config ── reads DEMO_MODE                      │     │
│                                                           │     │
└───────────────────────────────────────────────────────────┼─────┘
                                                            │
                                                            ▼
                                              Baseten (DeepSeek-V3.1)
                                              you.com (Search + Research)
```

**Data flow invariants:**
- Source IDs are assigned once, on arrival, and referenced everywhere downstream.
- The synthesizer only ever sees the `Source` struct — never raw HTML.
- The verifier reads the finished memo plus the same source bundle — no new retrieval.
- The cache key is the lowercased company name. One cache hit = full run replayed at stream speed.

---

## Tech stack

**Frontend**
- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS 4
- shadcn/ui (Radix primitives) + Geist sans/mono + Newsreader serif
- lucide-react icons

**AI / model layer**
- Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`)
- DeepSeek-V3.1 on Baseten (OpenAI-compatible chat)
- Zod 4 for structured output schemas

**External APIs**
- you.com Search + Research
- Baseten inference

**Backend / runtime**
- Next.js API routes on the Node runtime (300s maxDuration)
- Server-Sent Events for live streaming
- `@react-pdf/renderer` for PDF export
- File-backed JSON cache (`data/cache.json`)

**Deployment target**
- Vercel (ready to ship; no custom infra required)

---

## Project structure

```
diligence/
├── app/
│   ├── page.tsx              # Home: input form + live workspace + memo
│   ├── eval/page.tsx         # Evaluation dashboard
│   ├── layout.tsx            # Fonts, tooltip provider, metadata
│   └── api/
│       ├── research/         # SSE agent stream
│       ├── pdf/              # PDF render + stream
│       ├── eval/             # Judge a scenario against a cached memo
│       └── config/           # Expose DEMO_MODE to the client
├── components/
│   ├── app/RunPanel.tsx      # Live reasoning column
│   └── memo/                 # Citation popover + memo body renderer
├── lib/
│   ├── agent/
│   │   ├── pipeline.ts       # Orchestration + SSE emitter
│   │   ├── planner.ts        # 12–24 structured queries
│   │   ├── synthesizer.ts    # Streaming section writer
│   │   └── verifier.ts       # Groundedness audit
│   ├── eval/
│   │   ├── scenarios.ts      # Known-truth scenarios (Veris-shaped)
│   │   └── judge.ts          # LLM judge
│   ├── llm/baseten.ts        # Baseten provider (forces .chat())
│   ├── sources/you.ts        # you.com Search + Research clients
│   ├── memo/template.ts      # 10-section memo definition
│   ├── pdf/MemoPdf.tsx       # @react-pdf/renderer document
│   ├── cache.ts              # File-backed memo cache
│   ├── sse-client.ts         # Typed SSE reader
│   └── types.ts              # Shared types + AgentEvent union
└── data/
    └── cache.json            # Pre-warmed demo cache (Ramp, Linear, Klaviyo)
```

---

## Quickstart

```bash
git clone <repo>
cd diligence
npm install
cp .env.local.example .env.local   # fill in YOU_API_KEY + BASETEN_API_KEY
npm run dev
# open http://localhost:3000
```

Type `Ramp` and hit generate. First run takes ~65 seconds and hits the live APIs. Subsequent runs of the same company replay from cache in a few seconds.

---

## Installation and local development

**Prerequisites**
- Node.js 20+
- A [you.com API key](https://api.you.com/)
- A [Baseten API key](https://www.baseten.co/) with a DeepSeek-V3.1 deployment (or any OpenAI-compatible model — see [Environment variables](#environment-variables))

**Install and run**
```bash
npm install
npm run dev     # dev server with Turbopack
npm run build   # production build
npm start       # production server
```

The dev server runs on `http://localhost:3000`.

---

## Environment variables

```bash
# Required — every request depends on both of these
YOU_API_KEY=ydc-sk-...
BASETEN_API_KEY=...

# Optional — defaults to deepseek-ai/DeepSeek-V3.1
BASETEN_MODEL=deepseek-ai/DeepSeek-V3.1

# Optional — soft default: when "true", pre-checks the "use cached run" box
# on page load so a pre-warmed demo won't accidentally hit live APIs.
# No visible indicator in the UI.
DEMO_MODE=false

# Reserved for future Veris integration. Read by nothing today.
VERIS_API_KEY=
VERIS_API_URL=
```

---

## Example usage

**Input:** `Ramp` (with the cache warm)

**What happens internally:**
1. Planner emits 22 queries tagged across `business`, `market`, `competition`, `financials`, `team`, `sentiment`, `risks`, `news`.
2. Fan-out fires in chunks of 5 against you.com. 102 unique sources return.
3. Synthesizer streams 10 sections sequentially; each claim ends in `[S#]`.
4. Verifier scores the memo at 85/100 groundedness.
5. Total elapsed: ~65 seconds.

**Output:** a 10-section memo. First section looks like:

> **Executive Summary**
>
> Ramp is a US fintech that sells corporate cards and finance-automation software, founded in 2019 by Eric Glyman and Karim Atiyeh (both previously Paribus, acquired by Capital One) `[S54][S59]`. It earns primarily through interchange on card volume plus SaaS subscriptions for spend management `[S3][S4]`. Most recently valued around $32B in November 2025 `[S38][S39]`.
>
> **Recommendation: Prioritize.** Category-defining brand in corporate spend, strong second-act founder team, and ongoing multi-turn valuation growth `[S34][S38]`.

Every `[S#]` is a clickable popover. The PDF export preserves them as superscripts with a full sources appendix.

**Eval output:** on `/eval`, the same memo scores 100/100 completeness, 0 hallucinations, 85 groundedness — verdict **pass**.

---

## Differentiation

This is not "wrap ChatGPT, ship Friday." Concretely:

- **Grounding is a systems property.** Stable source IDs + citation-enforced synth + a verifier pass + an eval harness. Four layers that reinforce each other. A chatbot wrapper has none of them.
- **The output is a deliverable, not a conversation.** 10-section memo, repeatable structure, PDF export. This is what the user's actual job output looks like — not a transcript.
- **Visible reasoning is the product, not a demo trick.** The user (and the judge) watches the plan, the queries, and the sources in real time. This is the moat against both chat UIs and black-box research agents.
- **The eval layer is real.** Most hackathon projects don't have one. Ours grades itself on Veris-shaped scenarios and ships a dashboard.
- **Single-provider LLM stack.** Four distinct prompt surfaces, one model endpoint. Clean ops, fast swaps.
- **Hackathon-to-production path is short.** No auth, DB, or queue today — but every line is written as if there will be, and the architecture has clear extension points (background job runner, per-user source caches, Veris API plugin, richer document outputs).

---

## Limitations and current constraints

Honest list:

- **No auth, no multi-tenant state.** Single-user demo. The cache is a shared JSON file on disk.
- **No background jobs.** A run holds the HTTP connection for 60–90 seconds. Fine for a demo and interactive use; not fine for batch mode. A queue + worker split is the obvious next step.
- **No PDF/data extraction.** Sources are whatever you.com returns — HTML pages. A real diligence tool would also ingest an investor deck, an S-1, or a Notion page. That's the next expansion.
- **Veris integration is shape-only.** Scenarios are hand-authored. When Veris ships a scenario API, `lib/eval/scenarios.ts` becomes a fetch call.
- **One model, no specialized fine-tune.** The synthesizer is a general-purpose frontier model. A fine-tune on analyst-written memos would likely improve tone and factual tightness considerably.
- **Verifier is a check, not a rewrite.** It flags unsupported claims but doesn't re-run the synth with stricter grounding. Closing that loop is a clear next iteration.
- **The planner's query budget is static.** 22 queries per target regardless of complexity. A simpler target wastes calls; a harder one gets shortchanged.

None of these are blockers for what's built — they're the honest roadmap.

---

## Future improvements

Short horizon (weeks):
- **Document ingest.** Let the user drop a deck, a PDF, or a URL. Route it through a dedicated extraction step and merge it into the source bundle.
- **Per-section iterative grounding.** When the verifier flags an unsupported claim, re-run that section with a tighter constraint instead of just flagging.
- **Adaptive query budgets.** Planner gets a token budget, not a fixed count. Harder targets get deeper research.
- **Real Veris API integration.** When the scenario endpoint lands.

Medium horizon (months):
- **Team workspaces.** Multi-user, per-firm source caches, saved memos, memo diffing across targets.
- **Red-team agent.** A second agent whose job is to argue the opposite recommendation, surfacing the strongest bear case.
- **Export integrations.** Drop a memo directly into Notion, Google Docs, or an email-ready format.
- **Custom dimension trees.** Different verticals (healthcare, defense, DTC) need different research shapes. Expose dimension configs.

Longer horizon (product):
- **Continuous monitoring.** Once a target is memo'd, watch it. Alert on funding rounds, exec changes, press. Diligence becomes a subscription, not a one-shot.
- **Firm-specific fine-tunes.** Train on a firm's own historical memos to match its voice, risk tolerance, and rubric.
- **Data-room mode.** Ingest the full data room for a live deal. Produce a diligence memo grounded in both public web + private docs, with clear provenance split.

---

## Closing

The first-pass diligence memo is a multi-billion-dollar-a-year manual workflow hiding in plain sight. Every PE associate, every search fund, every corp-dev team, every early-stage VC does some version of it by hand. None of them love doing it. All of them ship worse work than they'd like because they're too slow.

Diligence is the first honest attempt at producing that artifact — grounded, structured, auditable, and fast enough that an analyst can actually use it at the front of their week instead of the end of it. The pipeline is built. The eval layer proves it works. The demo mode makes it reliable. The PDF makes it shippable.

It's a 6-hour hackathon build. It's also the first version of a real product.
