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
  assert.match(page.html, /76 articles/);
  assert.match(page.html, /56 Circles in 20 countries/);
  assert.doesNotMatch(page.html, /121 articles/);
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
  assert.match(article.html, /The basics/);
  assert.match(article.html, /<hr/);

  const circle = W.renderPage(wiki, "Circles/Aba");
  assert.equal(circle.missing, false);
  assert.match(circle.html, /Winnable issues completed/);
  assert.match(circle.html, /class="wikitable"|bordercolor="#a2a9b1"/);
  assert.match(circle.html, /bgcolor="#eaecf0"/);
  assert.match(circle.html, /Know Your Landlord/);
  const polisParts = W.splitArticleHtml(article.html);
  assert.ok(polisParts.some((p) => p.anchor === "The_basics"));
  assert.ok(polisParts.some((p) => p.anchor === "Sources"));
  const circleParts = W.splitArticleHtml(circle.html);
  assert.ok(circleParts.some((p) => p.anchor === "Winnable_issues_completed"));

  const circles = W.renderPage(wiki, "Circles");
  assert.equal(circles.missing, false);
  assert.match(circles.html, /wiki:\/\/Circles/);
  assert.match(circles.html, /Accra/);
  assert.match(circles.html, /Aba/);

  const cat = W.renderPage(wiki, "Category:Circles");
  assert.equal(cat.missing, false);
  assert.match(cat.html, /Pages in category/);
  assert.match(cat.html, /56 pages/);
  assert.match(cat.html, /Circles\/Aba/);
  assert.match(cat.html, /Circles\/Accra/);
  assert.match(cat.html, /wiki:\/\/Circles/);
  const catParts = W.splitArticleHtml(cat.html);
  assert.ok(catParts.some((p) => p.anchor === "C" && /Circles\/Aba/.test(p.html)));

  const lan = W.renderPage(wiki, "Category:LAN");
  assert.match(lan.html, /Subcategories/);
  assert.match(lan.html, /Circles/);
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
  const hash = W.parseWikiHref("wiki://Parallel%20polis#The_basics");
  assert.equal(hash.title, "Parallel polis");
  assert.equal(hash.anchor, "The_basics");
  const here = W.parseWikiHref("#Winnable_issues_completed");
  assert.equal(here.title, "");
  assert.equal(here.anchor, "Winnable_issues_completed");
});

test("richText keeps index.php edit query and colors red links", () => {
  const html = W.richText('<p><a href="/index.php?title=Missing_Page&amp;action=edit&amp;redlink=1" class="new">Missing Page</a></p>');
  assert.match(html, /wiki:\/\/Missing(?:%20|\+)Page\?action=edit/);
  assert.match(html, /redlink=1/);
  assert.match(html, /#ba0000/);
});

test("Vector night remaps box, table, infobox, and link colors", () => {
  try {
    W.engineSetTheme(true)
    const heading = W.richText('<h2><span class="mw-headline" id="Head">Head</span></h2><p>Lead</p>');
    assert.match(heading, /color="#eaecf0"/);
    assert.match(heading, /<hr/);
    const table = W.richText(
      '<table class="wikitable" style="width:100%;"><tr><th>#</th><th>Issue</th></tr><tr><td>1</td><td>Housing</td></tr></table>',
    );
    assert.match(table, /bordercolor="#54595d"/);
    assert.match(table, /bgcolor="#202122"/);
    assert.match(table, /bgcolor="#27292d"/);
    assert.doesNotMatch(table, /bordercolor="#a2a9b1"/);
    const link = W.richText('<p><a href="/wiki/Existing">Existing</a></p>');
    assert.match(link, /#88a3e8/);
    const red = W.richText('<p><a href="/index.php?title=Missing&amp;action=edit&amp;redlink=1" class="new">Missing</a></p>');
    assert.match(red, /#fd7865/);
    const infobox = W.richText(
      '<div class="lan-infobox" style="border:1px solid #a2a9b1; background-color:#f8f9fa; color:#202122"><div style="font-weight:bold; border-bottom:1px solid #a2a9b1">Name</div><div>Location: Aba</div></div>',
    );
    assert.match(infobox, /bgcolor="#202122"/);
    assert.doesNotMatch(infobox, /bgcolor="#f8f9fa"/);
    const featured = W.richText(
      '<div style="border:1px solid #a2a9b1; background:#ffffff"><div style="background-color:#cef2e0">Featured page</div><p>Hello</p></div>',
    );
    assert.match(featured, /#274a32/);
    const news = W.richText(
      '<div style="border:1px solid #a2a9b1; background:#ffffff"><div style="background-color:#cedff2">Circle news</div><p>Hello</p></div>',
    );
    assert.match(news, /#233549/);
    assert.doesNotMatch(news, /#cedff2/);
    assert.match(W.engineDiff("a", "b"), /#fd7865|#80d4a0|#54595d/);
    W.engineSetTheme(false)
    const light = W.richText(
      '<table class="wikitable"><tr><th>H</th></tr><tr><td>1</td></tr></table>',
    );
    assert.match(light, /bordercolor="#a2a9b1"/);
    assert.match(light, /bgcolor="#f8f9fa"/);
    assert.match(light, /bgcolor="#eaecf0"/);
  } finally {
    W.engineSetTheme(false);
  }
});

test("article headings get Vector underlines and wikitables keep Vector chrome", () => {
  const heading = W.richText('<h2><span class="mw-headline" id="The_basics">The basics</span></h2><p>Lead</p>');
  assert.match(heading, /The basics/);
  assert.match(heading, /<hr/);
  const table = W.richText(
    '<table class="wikitable" style="width:100%;"><tr><th>#</th><th>Issue</th></tr><tr><td>1</td><td>Housing</td></tr></table>',
  );
  assert.match(table, /border="1"/);
  assert.match(table, /bordercolor="#a2a9b1"/);
  assert.match(table, /bgcolor="#f8f9fa"/);
  assert.match(table, /bgcolor="#eaecf0"/);
  assert.match(table, /Housing/);
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
