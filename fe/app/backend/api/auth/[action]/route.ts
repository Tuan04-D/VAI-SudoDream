import type { NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ action: string }>;
};

function upstreamBase(): string | null {
  return (process.env.API_PROXY_TARGET || process.env.API_SERVER_BASE || "").replace(/\/$/, "") || null;
}

async function proxyAuth(request: NextRequest, context: RouteContext): Promise<Response> {
  const base = upstreamBase();
  if (!base) {
    return Response.json({ detail: "Chưa cấu hình API_PROXY_TARGET" }, { status: 503 });
  }

  const { action } = await context.params;
  const upstreamUrl = new URL(`${base}/api/auth/${encodeURIComponent(action)}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");
  headers.delete("expect");
  headers.delete("transfer-encoding");

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    const isLocalhost = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
    const browserCookie = setCookie
      .replace(/Path=\/api\/auth/gi, "Path=/backend/api/auth")
      .replace(isLocalhost ? /;\s*Secure/gi : /$^/, "");
    responseHeaders.set(
      "set-cookie",
      browserCookie
    );
  }
  responseHeaders.delete("content-length");
  responseHeaders.delete("content-encoding");

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const dynamic = "force-dynamic";

export const GET = proxyAuth;
export const POST = proxyAuth;
export const PATCH = proxyAuth;
export const DELETE = proxyAuth;
