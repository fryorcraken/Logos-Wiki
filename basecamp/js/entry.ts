import { scrypt } from "@noble/hashes/scrypt.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { MAX_TEXT, MAIN_PAGE, PRESET, SITENAME, TOPIC } from "./config.ts";
import { canonicalTitle, validUsername, Wiki, type Page } from "../../src/lib/state.ts";
import { publicKey, sign, verify, type Body, type Envelope } from "../../src/lib/events.ts";
import { parseTitle, type Title } from "../../src/lib/title.ts";
import { render } from "../../src/lib/wikitext/index.ts";
import { formatDate, formatDateTime, formatNumber, formatTime } from "../../src/lib/format.ts";
import { diffRows } from "../../src/lib/diff.ts";
import { appendSection, replaceSection, sectionText } from "../../src/lib/sections.ts";
import { bytesToHex, hexToBytes } from "./shims/utils.ts";
import { decodeMessage, joinBase64Chunks } from "./bytes.ts";

export function deriveSeed(name: string, password: string) {
  const salt = utf8ToBytes("logos-wiki/v1/" + name.normalize("NFC"));
  return scrypt(utf8ToBytes(password.normalize("NFC")), salt, { N: 65536, r: 8, p: 1, dkLen: 32 });
}

export {
  appendSection,
  bytesToHex,
  canonicalTitle,
  decodeMessage,
  diffRows,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  hexToBytes,
  joinBase64Chunks,
  MAIN_PAGE,
  MAX_TEXT,
  parseTitle,
  PRESET,
  publicKey,
  render,
  replaceSection,
  sectionText,
  sign,
  SITENAME,
  TOPIC,
  validUsername,
  verify,
  Wiki,
};

export function createWiki(admin: string) {
  return new Wiki((admin || "").toLowerCase());
}

export function ingest(wiki: Wiki, envelope: unknown) {
  const event = verify(envelope);
  if (!event || wiki.has(event.id)) return null;
  wiki.add(event);
  return event;
}

export function latestText(wiki: Wiki, full: string) {
  const page = wiki.pages.get(full) as Page | undefined;
  if (!page || !page.revs.length) return null;
  return page.revs[page.revs.length - 1].text;
}

export function richText(html: string) {
  return html
    .replace(/<figure\b[^>]*>/gi, "<div>")
    .replace(/<\/figure>/gi, "</div>")
    .replace(/<figcaption\b[^>]*>/gi, "<p><i>")
    .replace(/<\/figcaption>/gi, "</i></p>")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = /alt="([^"]*)"/.exec(tag)?.[1] || "image";
      return `[${alt}]`;
    })
    .replace(/href="\/wiki\/([^"#]*)(#[^"]*)?"/g, (_m, title: string, hash = "") => {
      const name = decodeURIComponent(String(title).replace(/\+/g, " ")).replace(/_/g, " ");
      return `href="wiki://${encodeURIComponent(name)}${hash || ""}"`;
    })
    .replace(/href="\/index\.php\?title=([^"&#]+)[^"]*"/g, (_m, title: string) => {
      const name = decodeURIComponent(String(title).replace(/\+/g, " ")).replace(/_/g, " ");
      return `href="wiki://${encodeURIComponent(name)}"`;
    });
}

export function renderPage(wiki: Wiki, rawTitle: string, editable = false) {
  const title = parseTitle(rawTitle);
  if (!title) return { html: "<p>Invalid title.</p>", title: rawTitle, missing: true, categories: [], headings: [] };
  const text = latestText(wiki, title.full);
  if (text === null) {
    return { html: "<p>There is currently no text in this page.</p>", title: title.full, missing: true, categories: [], headings: [], parsed: title };
  }
  const rendered = render(text, {
    title,
    exists: (full) => wiki.pages.has(full),
    template: (full) => latestText(wiki, full),
    file: (name) => {
      const file = wiki.files.get(name);
      return file ? { width: file.width, height: file.height } : null;
    },
    stats: wiki.stats(),
    editable,
  });
  return { ...rendered, html: richText(rendered.html), title: title.full, missing: false, parsed: title, source: text };
}

export function pageTitles(wiki: Wiki) {
  const out: string[] = [];
  wiki.pages.forEach((_page, full) => out.push(full));
  return out.sort();
}

export function recent(wiki: Wiki, limit = 100) {
  return wiki.revisions
    .slice()
    .reverse()
    .slice(0, limit)
    .map((rev) => ({ id: rev.id, page: rev.page, user: rev.user, ts: rev.ts, summary: rev.summary, minor: rev.minor }));
}

export function accountName(wiki: Wiki, key: string) {
  return wiki.names.get(key) || "";
}

export function canEditPage(wiki: Wiki, key: string, rawTitle: string) {
  const title = parseTitle(rawTitle);
  return !!(key && title && wiki.canEdit(key, title));
}

export function publishBody(seedHex: string, body: Body, ts?: number): Envelope {
  return sign(hexToBytes(seedHex), body, ts);
}

export function parseWikiLink(link: string) {
  if (link.startsWith("wiki://")) return decodeURIComponent(link.slice("wiki://".length).split("#")[0]);
  if (link.startsWith("#")) return "";
  return link;
}

export function followRedirect(wiki: Wiki, rawTitle: string) {
  const page = renderPage(wiki, rawTitle);
  const target = (page as { redirect?: Title }).redirect;
  if (!target) return { title: page.title, hops: 0 as const };
  return { title: target.full, hops: 1 as const, from: page.title };
}
