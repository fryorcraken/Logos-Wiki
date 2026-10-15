import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveSeed, publicKey, sign, signRequest, verify, verifyRequest } from "../src/lib/events.ts";

const seed = new Uint8Array(32).fill(7);

test("signed events verify and get a content id", () => {
  const event = verify(sign(seed, { t: "account", name: "Alice" }, 1000));
  assert.equal(event?.by, publicKey(seed));
  assert.equal(event?.ts, 1000);
  assert.match(event!.id, /^[0-9a-f]{64}$/);
});

test("tampered or malformed events are rejected", () => {
  const envelope = sign(seed, { t: "account", name: "Alice" });
  assert.equal(verify({ ...envelope, data: envelope.data.replace("Alice", "Mallory") }), null);
  assert.equal(verify({ data: envelope.data, sig: "00".repeat(64) }), null);
  assert.equal(verify({ data: "{", sig: envelope.sig }), null);
  assert.equal(verify(null), null);
  assert.equal(verify(sign(seed, { t: "unknown" } as never)), null);
});

test("request signatures are domain separated from events", () => {
  const key = publicKey(seed);
  const sig = signRequest(seed, "upload", "123");
  assert.ok(verifyRequest(key, "upload", "123", sig));
  assert.ok(!verifyRequest(key, "upload", "124", sig));
  assert.ok(!verifyRequest(key, "other", "123", sig));
  assert.equal(verify({ data: "logos-wiki-request\nupload\n123", sig }), null);
});

test("seeds derive deterministically from name and password", async () => {
  const a = await deriveSeed("Alice", "correct horse");
  assert.deepEqual(a, await deriveSeed("Alice", "correct horse"));
  assert.notDeepEqual(a, await deriveSeed("Bob", "correct horse"));
});
