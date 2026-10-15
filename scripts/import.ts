import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { sha256Hex, sign, signRequest, type Body, type Envelope } from "../src/lib/events.ts";
import { adminIdentity } from "./admin.ts";

type Rev = { id: number; title: string; ts: string; user: string; comment: string; text: string; minor?: boolean };
type SourceFile = { name: string; url: string; mime: string; user: string; ts: string; width: number; height: number };
type Query = Record<string, string>;

const { values } = parseArgs({
  options: {
    api: { type: "string", default: "https://alienware-1.tailb5c716.ts.net/api.php" },
    file: { type: "string" },
    server: { type: "string", default: process.env.WIKI_SERVER ?? "http://localhost:3000" },
  },
});

async function api(params: Query) {
  const url = `${values.api}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function* paged(params: Query) {
  let next: Query = {};
  do {
    const data = await api({ ...params, ...next });
    yield data.query ?? {};
    next = data.continue ?? null;
  } while (next);
}

async function titles() {
  const all: string[] = [];
  for (let ns = 0; ns <= 15; ns++) {
    for await (const q of paged({ action: "query", list: "allpages", apnamespace: String(ns), aplimit: "max" })) all.push(...q.allpages.map((p: { title: string }) => p.title));
  }
  return all;
}

async function revisions(title: string) {
  const revs: Rev[] = [];
  const params = { action: "query", prop: "revisions", titles: title, rvprop: "ids|timestamp|user|comment|content|flags", rvslots: "main", rvlimit: "max", rvdir: "newer" };
  for await (const q of paged(params)) {
    for (const r of q.pages[0].revisions ?? []) revs.push({ id: r.revid, title, ts: r.timestamp, user: r.user, comment: r.comment ?? "", text: r.slots.main.content ?? "", minor: !!r.minor });
  }
  return revs;
}

async function files() {
  const out: SourceFile[] = [];
  for await (const q of paged({ action: "query", list: "allimages", aiprop: "url|mime|user|timestamp|dimensions", ailimit: "max" })) {
    for (const f of q.allimages) out.push({ name: f.name.replace(/_/g, " "), url: f.url, mime: f.mime, user: f.user, ts: f.timestamp, width: f.width, height: f.height });
  }
  return out;
}

async function fromFile(path: string) {
  const pages: { title: string; revisions: Omit<Rev, "title">[] }[] = JSON.parse(await readFile(path, "utf8"));
  return pages.flatMap((p) => p.revisions.map((r) => ({ ...r, title: p.title })));
}

async function send(envelope: Envelope) {
  const response = await fetch(`${values.server}/api/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope) });
  return response.ok ? null : ((await response.json().catch(() => ({}))).error ?? String(response.status));
}

async function upload(seed: Uint8Array, key: string, file: SourceFile) {
  const bytes = new Uint8Array(await (await fetch(file.url)).arrayBuffer());
  const sha = sha256Hex(bytes);
  const ts = String(Date.now());
  const headers = { "content-type": file.mime, "x-wiki-key": key, "x-wiki-ts": ts, "x-wiki-sig": signRequest(seed, `upload:${sha}`, ts) };
  const response = await fetch(`${values.server}/api/upload`, { method: "POST", headers, body: bytes });
  const data = await response.json();
  if (!response.ok) throw new Error(`${file.name}: ${data.error}`);
  return { cid: String(data.cid), sha, size: bytes.length };
}

async function main() {
  const admin = await adminIdentity();
  const revs = values.file ? await fromFile(values.file) : (await Promise.all((await titles()).map(revisions))).flat();
  revs.sort((a, b) => a.id - b.id);
  let ts = 0;
  const publish = async (body: Body, at: number) => {
    ts = Math.max(at, ts + 1);
    return send(sign(admin.seed, body, ts));
  };
  let failed = 0;
  for (const rev of revs) {
    const error = await publish({ t: "edit", title: rev.title, text: rev.text, summary: rev.comment.slice(0, 500), minor: rev.minor, as: rev.user }, Date.parse(rev.ts));
    if (!error) continue;
    failed++;
    console.warn(`r${rev.id} ${rev.title}: ${error}`);
  }
  console.log(`Imported ${revs.length - failed} of ${revs.length} revisions.`);
  if (!values.file) {
    for (const file of await files()) {
      const stored = await upload(admin.seed, admin.key, file);
      const error = await publish({ t: "file", name: file.name, cid: stored.cid, mime: file.mime, size: stored.size, sha: stored.sha, width: file.width, height: file.height, as: file.user }, Date.parse(file.ts));
      console.log(error ? `File:${file.name}: ${error}` : `Uploaded File:${file.name} as ${stored.cid}`);
    }
  }
  const error = await send(sign(admin.seed, { t: "account", name: admin.name }));
  console.log(error ? `Admin account: ${error}` : `Created admin account ${admin.name}.`);
}

await main();
