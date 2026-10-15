import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRESET, TOPIC } from "../lib/config.ts";
import { call, ctl, on } from "./logos.ts";

const MODULE = "delivery_module";
export const MAX_MESSAGE = 150 * 1024;

function decode(raw: unknown) {
  const bytes = typeof raw === "string" ? JSON.parse(raw)?._bytes : (raw as { _bytes?: string })?._bytes;
  return typeof bytes === "string" ? Buffer.from(bytes, "base64url").toString("utf8") : null;
}

async function loaded() {
  const status = await ctl("status");
  return status.modules?.some((m: { name: string; status: string }) => m.name === MODULE && m.status === "loaded");
}

export async function startDelivery(receive: (text: string) => void) {
  if (!(await loaded())) await ctl("module", "load", MODULE);
  on(MODULE, ({ event, data }) => {
    if (event !== "messageReceived" || data.arg1 !== TOPIC) return;
    const text = decode(data.arg2);
    if (text) receive(text);
  });
  const status = await call(MODULE, "getConnectionStatus").catch(() => null);
  if (status === null) {
    await call(MODULE, "createNode", JSON.stringify({ mode: "Edge", preset: PRESET }));
    await call(MODULE, "start");
  }
  await call(MODULE, "subscribe", TOPIC);
}

export async function send(text: string) {
  if (Buffer.byteLength(text) > MAX_MESSAGE) throw new Error("message exceeds the Delivery size limit");
  const path = join(tmpdir(), `logos-wiki-${randomUUID()}.json`);
  await writeFile(path, text, { mode: 0o600 });
  try {
    return await call(MODULE, "send", TOPIC, `@${path}`);
  } finally {
    await rm(path, { force: true });
  }
}
