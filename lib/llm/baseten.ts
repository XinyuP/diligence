import { createOpenAI } from "@ai-sdk/openai";

const BASETEN_BASE = "https://inference.baseten.co/v1";

function key(): string {
  const k = process.env.BASETEN_API_KEY;
  if (!k) throw new Error("BASETEN_API_KEY is not set");
  return k;
}

export function baseten() {
  return createOpenAI({
    apiKey: key(),
    baseURL: BASETEN_BASE,
  });
}

export function modelId(): string {
  return process.env.BASETEN_MODEL || "deepseek-ai/DeepSeek-V3.1";
}

// Shorthand: returns a LanguageModel for the default Baseten model.
// Force .chat() — Baseten speaks OpenAI /v1/chat/completions, not /v1/responses.
export function basetenModel() {
  return baseten().chat(modelId());
}
