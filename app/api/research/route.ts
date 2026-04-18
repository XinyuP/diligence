import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent/pipeline";
import type { AgentEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sse(data: AgentEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    company?: string;
    context?: string;
    useCache?: boolean;
  };
  const company = (body.company ?? "").trim();
  if (!company) {
    return new Response(JSON.stringify({ error: "company is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const useCache = Boolean(body.useCache);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(ev)));
        } catch {
          // stream already closed
        }
      };
      try {
        await runAgent({ company, context: body.context, useCache, emit });
      } catch (err) {
        emit({ type: "error", message: (err as Error).message });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
