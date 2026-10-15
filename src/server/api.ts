import { headers } from "next/headers";

const buckets = new Map<string, { count: number; reset: number }>();

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export const fail = (error: string, status = 400) => json({ error }, status);

export function limited(key: string, max: number, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  return ++bucket.count > max;
}

export async function clientIp() {
  const head = await headers();
  return head.get("x-forwarded-for")?.split(",")[0].trim() ?? head.get("x-real-ip") ?? "local";
}

export async function readBody(request: Request, max: number) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > max) return null;
  const bytes = new Uint8Array(await request.arrayBuffer());
  return bytes.length > max ? null : bytes;
}

export async function readJson(request: Request, max: number): Promise<Record<string, unknown> | null> {
  const bytes = await readBody(request, max);
  if (!bytes) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
