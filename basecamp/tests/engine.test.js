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

test("bundled snapshot loads the imported Main Page", () => {
  assert.match(W.ADMIN_KEY, /^[0-9a-f]{64}$/);
  const jsonl = readFileSync(path.join(dir, "../data/snapshot.jsonl"), "utf8");
  assert.ok(jsonl.length > 1000);
  const wiki = W.createWiki(W.ADMIN_KEY);
  const events = jsonl
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const envelope = JSON.parse(line);
      const event = W.verify(envelope);
      if (!event) throw new Error("snapshot envelope failed verify");
      return event;
    });
  W.ingestEvents(wiki, events);
  const page = W.renderPage(wiki, "Main Page");
  assert.equal(page.missing, false);
  assert.match(page.source || page.html, /Parallel Wiki/);
  assert.match(page.html, /bgcolor="#cef2e0"/);
  assert.match(page.html, /Featured page/);
  assert.match(page.html, /Did you know/);
  assert.match(page.html, /Circle news/);
  assert.match(page.html, /<table[^>]*border="1"/);
  assert.doesNotMatch(page.html, /Every page carries a status/);
  assert.doesNotMatch(page.html, /Page status:/);
  assert.equal(page.toc, false);
  assert.equal(typeof wiki.stats().pages, "number");
  assert.ok(wiki.stats().pages > 100);
  assert.ok(wiki.stats().edits >= 250);

  const article = W.renderPage(wiki, "Parallel polis");
  assert.equal(article.missing, false);
  assert.ok(article.headings && article.headings.length >= 4);
  assert.equal(article.toc, true);
  assert.doesNotMatch(article.html, /Page status:/);
  assert.doesNotMatch(article.html, /Every page carries a status/);
});

test("parseWikiHref keeps edit, section, and redlink", () => {
  const red = W.parseWikiHref("wiki://Missing%20Page?action=edit&redlink=1");
  assert.equal(red.title, "Missing Page");
  assert.equal(red.action, "edit");
  assert.equal(red.redlink, true);
  assert.equal(red.section, "");
  const section = W.parseWikiHref("wiki://Parallel%20polis?action=edit&section=2");
  assert.equal(section.title, "Parallel polis");
  assert.equal(section.action, "edit");
  assert.equal(section.section, "2");
  assert.equal(W.parseWikiLink("wiki://Talk:Hello"), "Talk:Hello");
});

test("richText keeps index.php edit query and colors red links", () => {
  const html = W.richText('<p><a href="/index.php?title=Missing_Page&amp;action=edit&amp;redlink=1" class="new">Missing Page</a></p>');
  assert.match(html, /wiki:\/\/Missing(?:%20|\+)Page\?action=edit/);
  assert.match(html, /redlink=1/);
  assert.match(html, /#ba0000/);
});

test("normalizeUsername matches the web wiki", () => {
  assert.equal(W.normalizeUsername("  alice_bob "), "Alice bob");
  assert.equal(W.validUsername(W.normalizeUsername("alice")), "Alice");
});

test("permissions match trusted editors, user pages, and admin", async () => {
  const adminSeed = await W.deriveSeed("AdminTest", "password-admin-test");
  const bobSeed = await W.deriveSeed("Bob", "password-bob-test");
  const adminKey = W.publicKey(adminSeed);
  const bobKey = W.publicKey(bobSeed);
  W.resetEngine(adminKey);
  W.ingestEnvelope(W.sign(adminSeed, { t: "account", name: "AdminTest" }, 1));
  W.ingestEnvelope(W.sign(bobSeed, { t: "account", name: "Bob" }, 2));
  assert.equal(W.engineCanEdit(bobKey, "Hello"), false);
  assert.equal(W.engineCanEdit(bobKey, "User:Bob"), true);
  assert.equal(W.engineCanEdit(bobKey, "User talk:Bob"), true);
  assert.equal(W.engineCanEdit(bobKey, "User:AdminTest"), false);
  assert.equal(W.engineCanEdit(adminKey, "Hello"), true);
  assert.equal(W.engineIsAdmin(adminKey), true);
  assert.equal(W.engineIsAdmin(bobKey), false);
  W.ingestEnvelope(W.sign(bobSeed, { t: "edit", title: "Hello", text: "nope", summary: "x" }, 3));
  assert.equal(W.enginePageExists("Hello"), false);
  W.ingestEnvelope(W.sign(adminSeed, { t: "trust", editors: ["Bob"] }, 4));
  assert.equal([].concat(W.engineTrusted()).join(","), "Bob");
  assert.equal(W.engineCanEdit(bobKey, "Hello"), true);
  assert.equal(W.engineCanEdit(bobKey, "MediaWiki:Foo"), false);
  assert.equal(W.engineCanEdit(adminKey, "MediaWiki:Foo"), true);
  W.ingestEnvelope(W.sign(bobSeed, { t: "edit", title: "Hello", text: "yes [[Main Page]]", summary: "n" }, 5));
  assert.equal(W.enginePageExists("Hello"), true);
  assert.match(W.engineDiff("a", "b"), /font color/);
  const auth = W.engineAuth("Bob", "password-bob-test");
  assert.equal(auth.key, bobKey);
  assert.match(auth.seedHex, /^[0-9a-f]{64}$/);
});
