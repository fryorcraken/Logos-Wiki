import { utf8FromBytes, utf8ToBytes } from "./shims/utils.ts";

const TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64ToBytes(text: string) {
  const clean = text.replace(/[^A-Za-z0-9+/_-]/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = clean.length % 4 === 0 ? clean : clean + "=".repeat(4 - (clean.length % 4));
  const out: number[] = [];
  for (let i = 0; i < pad.length; i += 4) {
    const n =
      (TABLE.indexOf(pad[i]) << 18) |
      (TABLE.indexOf(pad[i + 1]) << 12) |
      ((pad[i + 2] === "=" ? 0 : TABLE.indexOf(pad[i + 2])) << 6) |
      (pad[i + 3] === "=" ? 0 : TABLE.indexOf(pad[i + 3]));
    out.push((n >> 16) & 255);
    if (pad[i + 2] !== "=") out.push((n >> 8) & 255);
    if (pad[i + 3] !== "=") out.push(n & 255);
  }
  return new Uint8Array(out);
}

export function joinBase64Chunks(chunks: string[]) {
  let total = 0;
  const parts = chunks.map((c) => {
    const bytes = base64ToBytes(c);
    total += bytes.length;
    return bytes;
  });
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return utf8FromBytes(out);
}

export function decodeMessage(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    if (raw.charAt(0) === "{" || raw.charAt(0) === "[") return raw;
    try {
      return utf8FromBytes(base64ToBytes(raw));
    } catch {
      return raw;
    }
  }
  if (typeof raw === "object") {
    const bytes = (raw as { _bytes?: unknown })._bytes;
    if (typeof bytes === "string") return utf8FromBytes(base64ToBytes(bytes));
  }
  return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
}

export { utf8FromBytes, utf8ToBytes };
