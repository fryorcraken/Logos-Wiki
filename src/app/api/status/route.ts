import { json } from "@/server/api.ts";
import { gateway } from "@/server/gateway.ts";

export async function GET() {
  const gw = await gateway();
  return json({ ...gw.status, events: gw.wiki.log.length, ...gw.wiki.stats() });
}
