import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { deriveSeed, publicKey, sign, signRequest, type Body } from "@/lib/events.ts";

const SEED = "wiki-seed";
const COOKIE = "wikiuser";
const YEAR = 365 * 86_400;

export type Result = { ok: true; data?: unknown } | { ok: false; error: string };

function storedSeed() {
  const hex = sessionStorage.getItem(SEED) ?? localStorage.getItem(SEED);
  return hex && /^[0-9a-f]{64}$/.test(hex) ? hexToBytes(hex) : null;
}

export async function keyFor(name: string, password: string) {
  const seed = await deriveSeed(name, password);
  return { seed, key: publicKey(seed) };
}

export function remember(seed: Uint8Array, persistent: boolean) {
  forget();
  (persistent ? localStorage : sessionStorage).setItem(SEED, bytesToHex(seed));
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${publicKey(seed)}; Path=/; SameSite=Strict${persistent ? `; Max-Age=${YEAR}` : ""}${secure}`;
}

export function forget() {
  sessionStorage.removeItem(SEED);
  localStorage.removeItem(SEED);
  document.cookie = `${COOKIE}=; Path=/; Max-Age=0`;
}

export async function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Result> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, data } : { ok: false, error: data.error ?? `Request failed (${response.status})` };
  } catch {
    return { ok: false, error: "The wiki could not be reached." };
  }
}

export function publish(body: Body, extra: Record<string, unknown> = {}, seed = storedSeed()): Promise<Result> {
  if (!seed) return Promise.resolve({ ok: false, error: "Your session has expired. Please log in again." });
  return post("/api/events", { ...sign(seed, body), ...extra });
}

export function authHeaders(purpose: string): Record<string, string> | null {
  const seed = storedSeed();
  if (!seed) return null;
  const ts = String(Date.now());
  return { "x-wiki-key": publicKey(seed), "x-wiki-ts": ts, "x-wiki-sig": signRequest(seed, purpose, ts) };
}

export function returnTo(target: string) {
  location.assign(target ? `/wiki/${encodeURIComponent(target.replace(/ /g, "_")).replace(/%2F/g, "/").replace(/%3A/g, ":")}` : "/");
}
