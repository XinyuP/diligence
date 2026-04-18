export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const demoMode = (process.env.DEMO_MODE ?? "").toLowerCase() === "true";
  return Response.json({ demoMode });
}
