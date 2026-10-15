import { cookies, headers } from "next/headers";
import type { Viewer } from "@/components/skin.tsx";
import { gateway } from "./gateway.ts";

export const USER_COOKIE = "wikiuser";

export async function context() {
  const gw = await gateway();
  const [jar, head] = await Promise.all([cookies(), headers()]);
  const key = jar.get(USER_COOKIE)?.value ?? "";
  const name = gw.wiki.names.get(key);
  const viewer: Viewer = name
    ? { name, key, exists: gw.wiki.pages.has(`User:${name}`), talkExists: gw.wiki.pages.has(`User talk:${name}`) }
    : null;
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { gw, wiki: gw.wiki, version: gw.version, viewer, origin: process.env.WIKI_SERVER ?? `${proto}://${host}` };
}

export type Context = Awaited<ReturnType<typeof context>>;
