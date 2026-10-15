import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, LOGOS_ENABLED, SNAPSHOT_CID } from "../lib/config.ts";
import { verify, type Envelope, type Verified } from "../lib/events.ts";
import { Wiki } from "../lib/state.ts";
import { send, startDelivery } from "./delivery.ts";
import { download, startStorage, upload } from "./storage.ts";

const LOG = join(DATA_DIR, "events.jsonl");
const SNAPSHOT = join(DATA_DIR, "snapshot.json");
const SNAPSHOT_EVERY = 15 * 60_000;
const MAX_SNAPSHOT = 512 * 1024 * 1024;
const CID = /^z[1-9A-HJ-NP-Za-km-z]{20,100}$/;

type Status = { delivery: string; storage: string; snapshot: string | null; error: string | null };

class Gateway {
  wiki = new Wiki();
  version = 0;
  status: Status = { delivery: "off", storage: "off", snapshot: null, error: null };
  private envelopes = new Map<string, Envelope>();
  private seenSnapshots = new Set<string>();
  private snapshotVersion = -1;

  async start() {
    await mkdir(join(DATA_DIR, "files"), { recursive: true });
    this.wiki.rebuild(this.parse(await readFile(LOG, "utf8").catch(() => "")));
    this.version++;
    this.status.snapshot = await readFile(SNAPSHOT, "utf8").then((s) => JSON.parse(s).cid, () => null);
    this.snapshotVersion = this.status.snapshot ? this.version : -1;
    if (LOGOS_ENABLED) void this.connect();
  }

  ingest(envelope: unknown, relay: boolean) {
    const event = verify(envelope);
    if (!event || !this.wiki.add(event)) return null;
    this.remember(event, envelope as Envelope);
    void appendFile(LOG, `${JSON.stringify(this.envelopes.get(event.id))}\n`);
    if (relay && this.status.delivery === "online") send(JSON.stringify(this.envelopes.get(event.id))).catch((e) => this.fail(e));
    return event;
  }

  async storeFile(path: string) {
    if (this.status.storage !== "online") throw new Error("Logos Storage is not available");
    return upload(path);
  }

  async fetchFile(cid: string, path: string) {
    if (this.status.storage !== "online") throw new Error("Logos Storage is not available");
    await download(cid, path);
  }

  private parse(text: string) {
    const events: Verified[] = [];
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const envelope = JSON.parse(line);
        const event = verify(envelope);
        if (event) events.push(this.remember(event, envelope));
      } catch {}
    }
    return events;
  }

  private remember(event: Verified, { data, sig }: Envelope) {
    this.envelopes.set(event.id, { data, sig });
    this.version++;
    return event;
  }

  private async connect() {
    try {
      this.status.storage = "starting";
      await startStorage();
      this.status.storage = "online";
      if (SNAPSHOT_CID) await this.importSnapshot(SNAPSHOT_CID);
      this.status.delivery = "starting";
      await startDelivery((text) => this.receive(text));
      this.status.delivery = "online";
      if (this.status.snapshot) this.announce(this.status.snapshot);
      setInterval(() => void this.snapshot(), SNAPSHOT_EVERY).unref();
    } catch (error) {
      this.fail(error);
      setTimeout(() => void this.connect(), 30_000).unref();
    }
  }

  private receive(text: string) {
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    const cid = (message as { snapshot?: unknown })?.snapshot;
    if (typeof cid === "string") void this.importSnapshot(cid).catch((e) => this.fail(e));
    else this.ingest(message, false);
  }

  private async importSnapshot(cid: string) {
    if (!CID.test(cid) || this.seenSnapshots.has(cid) || cid === this.status.snapshot) return;
    this.seenSnapshots.add(cid);
    const path = join(DATA_DIR, `snapshot-${cid}.jsonl`);
    try {
      await download(cid, path);
      if ((await stat(path)).size > MAX_SNAPSHOT) return;
      for (const line of (await readFile(path, "utf8")).split("\n")) {
        try {
          if (line) this.ingest(JSON.parse(line), false);
        } catch {}
      }
    } finally {
      await rm(path, { force: true });
    }
  }

  private async snapshot() {
    if (this.version === this.snapshotVersion || this.status.storage !== "online") return;
    const version = this.version;
    const path = join(DATA_DIR, "snapshot.jsonl");
    await writeFile(path, this.wiki.log.map((e) => JSON.stringify(this.envelopes.get(e.id))).join("\n"));
    const cid = await upload(path).catch((e) => this.fail(e));
    if (!cid) return;
    await writeFile(`${SNAPSHOT}.tmp`, JSON.stringify({ cid, count: this.wiki.log.length, at: Date.now() }));
    await rename(`${SNAPSHOT}.tmp`, SNAPSHOT);
    this.status.snapshot = cid;
    this.snapshotVersion = version;
    this.announce(cid);
  }

  private announce(cid: string) {
    send(JSON.stringify({ snapshot: cid })).catch((e) => this.fail(e));
  }

  private fail(error: unknown) {
    this.status.error = error instanceof Error ? error.message : String(error);
    console.error("[logos]", this.status.error);
    return undefined;
  }
}

const shared = globalThis as unknown as { gateway?: Gateway; ready?: Promise<void> };

export function gateway() {
  shared.gateway ??= new Gateway();
  shared.ready ??= shared.gateway.start();
  return shared.ready.then(() => shared.gateway!);
}
