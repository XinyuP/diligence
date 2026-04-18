import { createElement, type ReactElement } from "react";
import { NextRequest } from "next/server";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToStream } from "@react-pdf/renderer";
import { MemoPdf } from "@/lib/pdf/MemoPdf";
import type { Memo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { memo } = (await req.json().catch(() => ({}))) as { memo?: Memo };
  if (!memo) {
    return new Response(JSON.stringify({ error: "memo required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const element = createElement(MemoPdf, { memo }) as unknown as ReactElement<DocumentProps>;
  const nodeStream = (await renderToStream(element)) as NodeJS.ReadableStream & {
    destroy?: () => void;
  };
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(
          typeof chunk === "string"
            ? new TextEncoder().encode(chunk)
            : new Uint8Array(chunk),
        );
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy?.();
    },
  });

  const filename = memo.company.replace(/[^\w.-]+/g, "_");
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}-diligence-memo.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
