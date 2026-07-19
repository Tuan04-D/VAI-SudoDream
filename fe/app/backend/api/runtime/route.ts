function upstreamBase(): string | null {
  return (process.env.API_PROXY_TARGET || process.env.API_SERVER_BASE || "").replace(/\/$/, "") || null;
}

export function GET(): Response {
  const base = upstreamBase();
  if (!base) {
    return Response.json({ detail: "Chưa cấu hình backend URL" }, { status: 503 });
  }
  return Response.json(
    { websocket_base: base.replace(/^http/, "ws") },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const dynamic = "force-dynamic";
