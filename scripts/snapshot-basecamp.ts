import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { publicKey, sign, verify } from "../src/lib/events.ts";
import { Wiki } from "../src/lib/state.ts";

type Rev = { id: number; title: string; ts: string; user: string; comment: string; text: string; minor?: boolean };

const { values } = parseArgs({
  options: {
    api: { type: "string", default: "https://alienware-1.tailb5c716.ts.net/api.php" },
    file: { type: "string" },
  },
});

async function api(params: Record<string, string>) {
  const url = `${values.api}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function* paged(params: Record<string, string>) {
  let next: Record<string, string> | null = {};
  do {
    const data = await api({ ...params, ...next });
    yield data.query ?? {};
    next = data.continue ?? null;
  } while (next);
}

async function revisions() {
  const titles: string[] = [];
  for (let ns = 0; ns <= 15; ns++) {
    for await (const q of paged({ action: "query", list: "allpages", apnamespace: String(ns), aplimit: "max" })) {
      titles.push(...(q.allpages ?? []).map((p: { title: string }) => p.title));
    }
  }
  const revs: Rev[] = [];
  for (const title of titles) {
    const params = {
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids|timestamp|user|comment|content|flags",
      rvslots: "main",
      rvlimit: "max",
      rvdir: "newer",
    };
    for await (const q of paged(params)) {
      for (const r of q.pages[0].revisions ?? []) {
        revs.push({
          id: r.revid,
          title,
          ts: r.timestamp,
          user: r.user,
          comment: r.comment ?? "",
          text: r.slots.main.content ?? "",
          minor: !!r.minor,
        });
      }
    }
  }
  revs.sort((a, b) => a.id - b.id);
  return revs;
}

async function main() {
  const revs: Rev[] = values.file ? JSON.parse(readFileSync(values.file, "utf8")) : await revisions();
  const seed = randomBytes(32);
  const admin = publicKey(seed);
  const wiki = new Wiki(admin);
  const envelopes: { data: string; sig: string }[] = [];
  let ts = 0;
  const publish = (body: Parameters<typeof sign>[1], at: number) => {
    ts = Math.max(at, ts + 1);
    const envelope = sign(seed, body, ts);
    const event = verify(envelope);
    if (!event) throw new Error("sign/verify failed");
    envelopes.push(envelope);
    wiki.add(event);
  };
  publish({ t: "account", name: "Admin" }, 1);
  for (const rev of revs) {
    const at = Date.parse(rev.ts);
    publish(
      {
        t: "edit",
        title: rev.title,
        text: rev.text,
        summary: String(rev.comment || "").slice(0, 500),
        minor: rev.minor || undefined,
        as: rev.user,
      },
      Number.isFinite(at) ? at : ts + 1,
    );
  }
  mkdirSync("basecamp/data", { recursive: true });
  writeFileSync("basecamp/data/snapshot.jsonl", envelopes.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const configPath = "basecamp/js/config.ts";
  const config = readFileSync(configPath, "utf8").replace(/export const ADMIN_KEY = "[^"]*";/, `export const ADMIN_KEY = "${admin}";`);
  writeFileSync(configPath, config);
  const mainPage = wiki.latest("Main Page");
  console.log(`ADMIN_KEY=${admin}`);
  console.log(`Wrote ${envelopes.length} events, ${wiki.pages.size} pages, Main Page ${mainPage ? mainPage.text.length : 0} chars.`);
}

await main();
