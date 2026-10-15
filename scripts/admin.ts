import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { deriveSeed, publicKey } from "../src/lib/events.ts";

async function ask(question: string, hidden = false) {
  let muted = false;
  const output = new Writable({ write: (chunk, _enc, done) => (muted || process.stderr.write(chunk), done()) });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const answer = rl.question(question);
  muted = hidden;
  const value = await answer;
  rl.close();
  if (hidden) process.stderr.write("\n");
  return value.trim();
}

export async function adminIdentity() {
  const name = process.env.WIKI_ADMIN_NAME ?? (await ask("Admin username: "));
  const password = process.env.WIKI_ADMIN_PASSWORD ?? (await ask("Admin password: ", true));
  if (!name || password.length < 10) throw new Error("A username and a password of at least 10 characters are required.");
  const normalized = name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");
  const seed = await deriveSeed(normalized, password);
  return { name: normalized, seed, key: publicKey(seed) };
}
