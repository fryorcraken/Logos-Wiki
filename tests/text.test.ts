import assert from "node:assert/strict";
import { test } from "node:test";
import { diffRows } from "../src/lib/diff.ts";
import { appendSection, replaceSection, sectionText } from "../src/lib/sections.ts";
import { parseTitle } from "../src/lib/title.ts";
import { render } from "../src/lib/wikitext/index.ts";

const page = "Intro\n\n== A ==\nalpha\n=== A1 ===\nsub\n== B ==\nbeta";

test("sections are addressed like MediaWiki", () => {
  assert.equal(sectionText(page, 1), "== A ==\nalpha\n=== A1 ===\nsub");
  assert.equal(sectionText(page, 2), "=== A1 ===\nsub");
  assert.equal(sectionText(page, 9), null);
  assert.equal(replaceSection(page, 3, "== B ==\ngamma"), "Intro\n\n== A ==\nalpha\n=== A1 ===\nsub\n== B ==\ngamma");
  assert.equal(appendSection("", "New", "body"), "== New ==\n\nbody");
});

test("diffs mark changed lines and escape markup", () => {
  const html = diffRows("a\n<b>\nc", "a\n<i>\nc");
  assert.match(html, /diff-lineno/);
  assert.match(html, /diff-deletedline/);
  assert.match(html, /diff-addedline/);
  assert.ok(!html.includes("<b>"));
});

function html(source: string, title = "Test") {
  return render(source, {
    title: parseTitle(title)!,
    exists: (full) => full === "Existing",
    template: (full) => (full === "Template:Hi" ? "Hello {{{1|world}}}" : null),
    file: () => null,
    stats: { articles: 1, pages: 1, edits: 1, users: 1 },
  });
}

test("renders links, templates and headings", () => {
  const out = html("== Head ==\n[[Existing]] [[Missing]] {{Hi|there}} '''bold'''\n[[Category:Things]]");
  assert.match(out.html, /<h2[^>]*>.*Head/);
  assert.match(out.html, /href="\/wiki\/Existing"/);
  assert.match(out.html, /class="new"/);
  assert.match(out.html, /Hello there/);
  assert.match(out.html, /<b>bold<\/b>/);
  assert.deepEqual(out.categories.map((c) => c.name), ["Things"]);
});

test("strips scripts, handlers and javascript urls", () => {
  const out = html('<script>alert(1)</script><span onclick="x()" style="color:red">s</span>[javascript:alert(1) x]');
  assert.ok(!/<script/i.test(out.html));
  assert.ok(!/onclick/i.test(out.html));
  assert.ok(!/href="javascript:/i.test(out.html));
});

test("redirects are detected", () => {
  assert.equal(html("#REDIRECT [[Existing]]").redirect?.full, "Existing");
});
