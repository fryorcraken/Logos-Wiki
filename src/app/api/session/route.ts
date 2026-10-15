import type { NextRequest } from "next/server";
import { fail, json } from "@/server/api.ts";
import { gateway } from "@/server/gateway.ts";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!/^[0-9a-f]{64}$/.test(key)) return fail("Invalid key.");
  const { wiki } = await gateway();
  return json({ name: wiki.names.get(key) ?? null, admin: key === wiki.admin });
}
