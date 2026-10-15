import type { NextRequest } from "next/server";
import { canonicalTitle } from "@/lib/state.ts";
import { parseTitle } from "@/lib/title.ts";
import { gateway } from "@/server/gateway.ts";

export async function GET(request: NextRequest) {
  const raw = parseTitle(request.nextUrl.searchParams.get("title") ?? "");
  const title = raw && canonicalTitle(raw.full);
  const { wiki } = await gateway();
  const rev = title && wiki.latest(title.full);
  if (!rev) return new Response("", { status: 404 });
  return new Response(rev.text, { headers: { "content-type": "text/x-wiki; charset=UTF-8", "x-content-type-options": "nosniff", "cache-control": "no-cache" } });
}
