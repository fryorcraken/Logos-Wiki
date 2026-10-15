import assert from "node:assert/strict";
import { test } from "node:test";
import { publicKey, sign, verify, type Body } from "../src/lib/events.ts";
import { Wiki } from "../src/lib/state.ts";
import { parseTitle } from "../src/lib/title.ts";

const admin = new Uint8Array(32).fill(1);
const alice = new Uint8Array(32).fill(2);
const bob = new Uint8Array(32).fill(3);

let clock = 1000;
const event = (seed: Uint8Array, body: Body) => verify(sign(seed, body, clock++))!;
const edit = (title: string, text: string, as?: string): Body => ({ t: "edit", title, text, summary: "", ...(as ? { as } : {}) });

function setup() {
  const wiki = new Wiki(publicKey(admin));
  wiki.add(event(admin, { t: "account", name: "Admin" }));
  wiki.add(event(alice, { t: "account", name: "Alice" }));
  return wiki;
}

test("accounts are unique by name and key", () => {
  const wiki = setup();
  assert.ok(!wiki.add(event(bob, { t: "account", name: "Alice" })));
  assert.ok(!wiki.add(event(alice, { t: "account", name: "Alice2" })));
  assert.ok(!wiki.add(event(bob, { t: "account", name: "1.2.3.4" })));
  assert.ok(wiki.add(event(bob, { t: "account", name: "Bob" })));
  assert.ok(wiki.isAdmin("Admin"));
});

test("only trusted editors edit articles, everyone edits their own user page", () => {
  const wiki = setup();
  assert.ok(!wiki.add(event(alice, edit("Main Page", "hi"))));
  assert.ok(wiki.add(event(alice, edit("User:Alice/Notes", "mine"))));
  assert.ok(!wiki.add(event(alice, { t: "trust", editors: ["Alice"] })));
  assert.ok(wiki.add(event(admin, { t: "trust", editors: ["Alice"] })));
  assert.ok(wiki.add(event(alice, edit("Main Page", "hi"))));
  assert.ok(!wiki.add(event(alice, edit("MediaWiki:Common.css", "body{}"))));
  assert.ok(wiki.canUpload(publicKey(alice)));
  assert.equal(wiki.latest("Main Page")?.user, "Alice");
});

test("null edits and non-canonical titles are rejected", () => {
  const wiki = setup();
  assert.ok(wiki.add(event(admin, edit("Page", "a"))));
  assert.ok(!wiki.add(event(admin, edit("Page", "a"))));
  assert.ok(!wiki.add(event(admin, edit("page_two", "a"))));
});

test("imported edits keep their author and reserve the name", () => {
  const wiki = setup();
  assert.ok(wiki.add(event(admin, edit("Page", "old", "Carol"))));
  assert.equal(wiki.latest("Page")?.user, "Carol");
  assert.ok(!wiki.add(event(bob, { t: "account", name: "Carol" })));
  assert.ok(!wiki.add(event(alice, edit("Page", "forged", "Alice"))));
});

test("out-of-order events converge to the same history", () => {
  const events = [
    event(admin, { t: "account", name: "Admin" }),
    event(admin, edit("Page", "one")),
    event(admin, edit("Page", "two")),
  ];
  const forward = new Wiki(publicKey(admin));
  const backward = new Wiki(publicKey(admin));
  for (const e of events) forward.add(e);
  for (const e of [...events].reverse()) backward.add(e);
  assert.deepEqual(backward.pages.get("Page")?.revs.map((r) => r.text), ["one", "two"]);
  assert.deepEqual(backward.log.map((e) => e.id), forward.log.map((e) => e.id));
});

test("edits wait for a missing account but rejected edits stay rejected", () => {
  const wiki = setup();
  const early = event(bob, edit("User:Bob", "waiting"));
  assert.ok(!wiki.add(early));
  assert.ok(wiki.isPending(early.id));
  assert.ok(wiki.add(event(bob, { t: "account", name: "Bob" })));
  assert.ok(!wiki.has(early.id));
  const carol = new Uint8Array(32).fill(4);
  const account = event(carol, { t: "account", name: "Carol" });
  const late = event(carol, edit("User:Carol", "delivered"));
  wiki.add(event(admin, edit("Tail", "x")));
  assert.ok(!wiki.add(late));
  assert.ok(wiki.add(account));
  assert.ok(wiki.has(late.id));
  assert.ok(!wiki.add(event(alice, edit("Main Page", "denied"))));
  wiki.add(event(admin, { t: "trust", editors: ["Alice"] }));
  assert.equal(wiki.latest("Main Page"), undefined);
});

test("user pages belong to the account owner only", () => {
  const wiki = setup();
  assert.ok(!wiki.canEdit(publicKey(alice), parseTitle("User:Bob")!));
  assert.ok(wiki.canEdit(publicKey(alice), parseTitle("User talk:Alice")!));
});
