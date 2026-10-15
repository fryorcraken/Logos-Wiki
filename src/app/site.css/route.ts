import { gateway } from "@/server/gateway.ts";

export async function GET() {
  const { wiki } = await gateway();
  const css = (wiki.latest("MediaWiki:Common.css")?.text ?? "").replace(/@import[^;]*;?/gi, "");
  return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "x-content-type-options": "nosniff", "cache-control": "public, max-age=60" } });
}
