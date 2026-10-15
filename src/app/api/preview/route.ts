import { MAX_TEXT } from "@/lib/config.ts";
import { diffRows } from "@/lib/diff.ts";
import { canonicalTitle } from "@/lib/state.ts";
import { clientIp, fail, json, limited, readJson } from "@/server/api.ts";
import { gateway } from "@/server/gateway.ts";
import { renderText } from "@/server/site.ts";

export async function POST(request: Request) {
  if (limited(`preview:${await clientIp()}`, 60)) return fail("Too many requests. Please wait a minute.", 429);
  const body = await readJson(request, 4 * MAX_TEXT);
  const title = canonicalTitle(body?.title);
  const text = body?.text;
  if (!title || typeof text !== "string" || text.length > MAX_TEXT) return fail("Invalid preview request.");
  const { wiki } = await gateway();
  if (body?.diff) return json({ html: diffRows(wiki.latest(title.full)?.text ?? "", text) || "" });
  return json({ html: renderText(wiki, title, text).html });
}
