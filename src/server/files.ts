import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "@/lib/config.ts";
import { sha256Hex } from "@/lib/events.ts";
import type { StoredFile } from "@/lib/state.ts";
import { gateway } from "./gateway.ts";

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  "image/webp": (b) => String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
};

export const matchesType = (mime: string, bytes: Uint8Array) => !!MAGIC[mime]?.(bytes);

const cachePath = (sha: string) => join(DATA_DIR, "files", sha);

export async function storeBytes(bytes: Uint8Array) {
  const sha = sha256Hex(bytes);
  const path = cachePath(sha);
  await writeFile(path, bytes);
  const gw = await gateway();
  return { sha, cid: await gw.storeFile(path) };
}

export async function loadFile(file: StoredFile) {
  const path = cachePath(file.sha);
  const cached = await readFile(path).catch(() => null);
  if (cached) return cached;
  const temp = `${path}.${process.pid}.${Date.now()}.part`;
  try {
    await (await gateway()).fetchFile(file.cid, temp);
    const bytes = await readFile(temp);
    if (sha256Hex(bytes) !== file.sha) return null;
    await rename(temp, path);
    return bytes;
  } finally {
    await rm(temp, { force: true });
  }
}
