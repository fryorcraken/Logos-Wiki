import { ADMIN_KEY, MAX_TEXT } from "./config.ts";
import type { Verified } from "./events.ts";
import { parseTitle, type Title } from "./title.ts";

export type Revision = {
  id: number;
  event: string;
  page: string;
  ts: number;
  user: string;
  summary: string;
  minor: boolean;
  text: string;
  parent: number;
};
export type Page = { title: Title; revs: Revision[] };
export type Account = { name: string; key: string; ts: number };
export type StoredFile = {
  name: string;
  cid: string;
  mime: string;
  size: number;
  sha: string;
  width: number;
  height: number;
  user: string;
  ts: number;
};

export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const CID = /^z[1-9A-HJ-NP-Za-km-z]{20,100}$/;
const MAX_FILE = 50 * 1024 * 1024;
const MAX_PENDING = 1000;

const order = (a: Verified, b: Verified) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const isInt = (n: unknown, max: number): n is number => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= max;

export function validUsername(raw: unknown) {
  if (typeof raw !== "string") return null;
  const title = parseTitle(raw, 2);
  if (!title || title.ns !== 2 || title.fragment || title.text.length > 85) return null;
  if (/[/@:#]/.test(title.text) || /^\d{1,3}(\.\d{1,3}){3}$/.test(title.text)) return null;
  return title.text;
}

export function canonicalTitle(raw: unknown) {
  if (typeof raw !== "string") return null;
  const title = parseTitle(raw);
  return title && title.ns >= 0 && !title.fragment && title.full === raw ? title : null;
}

export class Wiki {
  log: Verified[] = [];
  pages = new Map<string, Page>();
  revisions: Revision[] = [];
  accounts = new Map<string, Account>();
  names = new Map<string, string>();
  trusted: string[] = [];
  files = new Map<string, StoredFile>();
  reserved = new Set<string>();
  private ids = new Set<string>();
  private pending = new Map<string, Verified>();
  readonly admin: string;

  constructor(admin = ADMIN_KEY) {
    this.admin = admin;
  }

  has(id: string) {
    return this.ids.has(id);
  }

  isPending(id: string) {
    return this.pending.has(id);
  }

  add(event: Verified) {
    if (this.ids.has(event.id) || this.pending.has(event.id)) return false;
    const last = this.log.at(-1);
    const reserves = "as" in event && event.as && !this.reserved.has(event.as);
    if ((!last || order(last, event) < 0) && !reserves) {
      if (!this.attempt(event)) return false;
      this.drain();
      return true;
    }
    this.rebuild([...this.log, ...this.pending.values(), event]);
    return this.ids.has(event.id);
  }

  rebuild(events: Verified[]) {
    Object.assign(this, {
      log: [],
      pages: new Map(),
      revisions: [],
      accounts: new Map(),
      names: new Map(),
      trusted: [],
      files: new Map(),
      ids: new Set(),
      pending: new Map(),
    });
    this.reserved = new Set(events.flatMap((e) => ("as" in e && e.as && e.by === this.admin ? [e.as] : [])));
    for (const event of [...events].sort(order)) if (!this.ids.has(event.id)) this.attempt(event);
  }

  canEdit(key: string, title: Title) {
    if (key === this.admin) return true;
    const user = this.names.get(key);
    if (!user || title.ns === 8 || title.ns === 9) return false;
    if ((title.ns === 2 || title.ns === 3) && title.text.split("/")[0] === user) return true;
    return this.trusted.includes(user);
  }

  canUpload(key: string) {
    const user = this.names.get(key);
    return key === this.admin || (!!user && this.trusted.includes(user));
  }

  isAdmin(name: string) {
    return this.accounts.get(name)?.key === this.admin;
  }

  latest(full: string) {
    return this.pages.get(full)?.revs.at(-1);
  }

  stats() {
    let articles = 0;
    this.pages.forEach((page) => {
      const text = page.revs.at(-1)!.text;
      if (page.title.ns === 0 && !/^\s*#redirect/i.test(text) && text.includes("[[")) articles++;
    });
    const users = new Set(this.accounts.keys());
    this.reserved.forEach((name) => users.add(name));
    users.delete("MediaWiki default");
    return { articles, pages: this.pages.size, edits: this.revisions.length, users: users.size };
  }

  private keep(event: Verified) {
    this.log.push(event);
    this.ids.add(event.id);
  }

  private attempt(event: Verified) {
    if (this.apply(event)) {
      this.pending.delete(event.id);
      this.keep(event);
      return true;
    }
    if (event.t !== "account" && !this.names.has(event.by)) this.park(event);
    return false;
  }

  private park(event: Verified) {
    this.pending.set(event.id, event);
    if (this.pending.size > MAX_PENDING) this.pending.delete(this.pending.keys().next().value!);
  }

  private drain() {
    for (let progress = true; progress; ) {
      progress = false;
      for (const event of [...this.pending.values()].sort(order)) {
        if (order(this.log.at(-1)!, event) < 0 && this.apply(event)) {
          this.pending.delete(event.id);
          this.keep(event);
          progress = true;
        }
      }
    }
  }

  private author(event: Verified & { as?: string }) {
    if (event.as === undefined) return this.names.get(event.by);
    return event.by === this.admin && validUsername(event.as) === event.as ? event.as : undefined;
  }

  private apply(event: Verified) {
    switch (event.t) {
      case "account":
        return this.applyAccount(event);
      case "edit":
        return this.applyEdit(event);
      case "trust":
        return this.applyTrust(event);
      case "file":
        return this.applyFile(event);
    }
  }

  private applyAccount(event: Extract<Verified, { t: "account" }>) {
    const name = validUsername(event.name);
    if (!name || name !== event.name || this.names.has(event.by) || this.accounts.has(name)) return false;
    if (this.reserved.has(name) && event.by !== this.admin) return false;
    this.accounts.set(name, { name, key: event.by, ts: event.ts });
    this.names.set(event.by, name);
    return true;
  }

  private applyEdit(event: Extract<Verified, { t: "edit" }>) {
    const user = this.author(event);
    const title = canonicalTitle(event.title);
    const { text, summary } = event;
    if (!user || !title || typeof text !== "string" || typeof summary !== "string") return false;
    if (text.length > MAX_TEXT || summary.length > 500 || !this.canEdit(event.by, title)) return false;
    const page = this.pages.get(title.full) ?? { title, revs: [] };
    if (page.revs.at(-1)?.text === text) return false;
    const rev: Revision = {
      id: this.revisions.length + 1,
      event: event.id,
      page: title.full,
      ts: event.ts,
      user,
      summary,
      minor: event.minor === true,
      text,
      parent: page.revs.at(-1)?.id ?? 0,
    };
    page.revs.push(rev);
    this.revisions.push(rev);
    this.pages.set(title.full, page);
    return true;
  }

  private applyTrust(event: Extract<Verified, { t: "trust" }>) {
    if (event.by !== this.admin || !Array.isArray(event.editors) || event.editors.length > 1000) return false;
    const names: string[] = [];
    for (let i = 0; i < event.editors.length; i++) {
      const n = validUsername(event.editors[i]);
      if (n && names.indexOf(n) < 0) names.push(n);
    }
    this.trusted = names;
    return true;
  }

  private applyFile(event: Extract<Verified, { t: "file" }>) {
    const user = this.author(event);
    const title = parseTitle(String(event.name), 6);
    const { cid, mime, size, sha, width, height } = event;
    if (!user || !title || title.ns !== 6 || title.text !== event.name || !this.canUpload(event.by)) return false;
    if (typeof cid !== "string" || !CID.test(cid) || !IMAGE_TYPES.has(mime) || typeof sha !== "string") return false;
    if (!/^[0-9a-f]{64}$/.test(sha) || !isInt(size, MAX_FILE) || !isInt(width, 1e5) || !isInt(height, 1e5)) return false;
    this.files.set(title.text, { name: title.text, cid, mime, size, sha, width, height, user, ts: event.ts });
    return true;
  }
}
