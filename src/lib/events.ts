import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export type Body =
  | { t: "account"; name: string }
  | { t: "edit"; title: string; text: string; summary: string; minor?: boolean; as?: string }
  | { t: "trust"; editors: string[] }
  | { t: "file"; name: string; cid: string; mime: string; size: number; sha: string; width: number; height: number; as?: string };

export type Event = Body & { v: 1; by: string; ts: number };
export type Envelope = { data: string; sig: string };
export type Verified = Event & { id: string };

const KINDS = new Set(["account", "edit", "trust", "file"]);

export const sha256Hex = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

export async function deriveSeed(name: string, password: string) {
  const salt = utf8ToBytes(`logos-wiki/v1/${name.normalize("NFC")}`);
  return scryptAsync(utf8ToBytes(password.normalize("NFC")), salt, { N: 2 ** 16, r: 8, p: 1, dkLen: 32 });
}

export const publicKey = (seed: Uint8Array) => bytesToHex(ed25519.getPublicKey(seed));

export function sign(seed: Uint8Array, body: Body, ts = Date.now()): Envelope {
  const data = JSON.stringify({ v: 1, by: publicKey(seed), ts, ...body });
  return { data, sig: bytesToHex(ed25519.sign(utf8ToBytes(data), seed)) };
}

const requestMessage = (purpose: string, ts: string) => utf8ToBytes(`logos-wiki-request\n${purpose}\n${ts}`);

export const signRequest = (seed: Uint8Array, purpose: string, ts: string) => bytesToHex(ed25519.sign(requestMessage(purpose, ts), seed));

export function verifyRequest(key: string, purpose: string, ts: string, sig: string) {
  if (!/^[0-9a-f]{64}$/.test(key) || !/^[0-9a-f]{128}$/.test(sig) || !/^\d{1,15}$/.test(ts)) return false;
  try {
    return ed25519.verify(hexToBytes(sig), requestMessage(purpose, ts), hexToBytes(key));
  } catch {
    return false;
  }
}

export function verify(envelope: unknown): Verified | null {
  if (!envelope || typeof envelope !== "object") return null;
  const { data, sig } = envelope as Envelope;
  if (typeof data !== "string" || typeof sig !== "string" || !/^[0-9a-f]{128}$/.test(sig)) return null;
  let event: Event;
  try {
    event = JSON.parse(data);
  } catch {
    return null;
  }
  if (event?.v !== 1 || !KINDS.has(event.t) || !Number.isSafeInteger(event.ts)) return null;
  if (typeof event.by !== "string" || !/^[0-9a-f]{64}$/.test(event.by)) return null;
  const bytes = utf8ToBytes(data);
  try {
    if (!ed25519.verify(hexToBytes(sig), bytes, hexToBytes(event.by))) return null;
  } catch {
    return null;
  }
  return { ...event, id: sha256Hex(bytes) };
}
