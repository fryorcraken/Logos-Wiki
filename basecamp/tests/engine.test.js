import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { deriveSeed, publicKey, sign, verify } from "../../src/lib/events.ts";
import { parseTitle } from "../../src/lib/title.ts";
import { render } from "../../src/lib/wikitext/index.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(dir, "../qml/wiki.js"), "utf8").replace(".pragma library\n", "");
const ctx = createContext({ console, setTimeout, clearTimeout });
runInContext(source, ctx);
const W = ctx.WikiEngine;

test("bundle verifies noble-signed events", async () => {
  const seed = await deriveSeed("Alice", "correct horse");
  const envelope = sign(seed, { t: "account", name: "Alice" }, 1000);
  const event = W.verify(envelope);
  assert.equal(event.by, publicKey(seed));
  assert.equal(event.ts, 1000);
});

test("noble verifies bundle-signed events", async () => {
  const seed = await W.deriveSeed("Alice", "correct horse");
  const envelope = W.sign(seed, { t: "account", name: "Alice" }, 1000);
  const event = verify(envelope);
  assert.equal(event.by, W.publicKey(seed));
  assert.equal(event.by, publicKey(await deriveSeed("Alice", "correct horse")));
});

test("renderer output matches the TypeScript source", () => {
  const ctxPage = {
    title: parseTitle("Test"),
    exists: (full) => full === "Existing",
    template: (full) => (full === "Template:Hi" ? "Hello {{{1|world}}}" : null),
    file: () => null,
    stats: { articles: 1, pages: 1, edits: 1, users: 1 },
  };
  const sourceText = "== Head ==\n[[Existing]] [[Missing]] {{Hi|there}} '''bold'''";
  const fromTs = render(sourceText, ctxPage);
  const fromJs = W.render(sourceText, ctxPage);
  assert.equal(fromJs.html, fromTs.html);
});

test("createWiki replays edits", async () => {
  const seed = await W.deriveSeed("Alice", "pw");
  const wiki = W.createWiki(W.publicKey(seed));
  W.ingest(wiki, W.sign(seed, { t: "account", name: "Alice" }, 1));
  W.ingest(wiki, W.sign(seed, { t: "edit", title: "Main Page", text: "Hello '''LAN'''", summary: "n" }, 2));
  const page = W.renderPage(wiki, "Main Page");
  assert.equal(page.missing, false);
  assert.match(page.html, /<b>LAN<\/b>/);
});
