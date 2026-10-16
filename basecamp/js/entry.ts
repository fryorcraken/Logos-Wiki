import { scrypt } from "@noble/hashes/scrypt.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { ADMIN_KEY, MAX_TEXT, MAIN_PAGE, PRESET, SITENAME, SNAPSHOT_CID, TOPIC } from "./config.ts";
import { canonicalTitle, validUsername, Wiki, type Page } from "../../src/lib/state.ts";
import { publicKey, sign, verify, type Body, type Envelope } from "../../src/lib/events.ts";
import { parseTitle, type Title } from "../../src/lib/title.ts";
import { render } from "../../src/lib/wikitext/index.ts";
import { formatDate, formatDateTime, formatNumber, formatTime } from "../../src/lib/format.ts";
import { diffRows } from "../../src/lib/diff.ts";
import { appendSection, replaceSection, sectionText } from "../../src/lib/sections.ts";
import { bytesToHex, hexToBytes } from "./shims/utils.ts";
import { decodeMessage, joinBase64Chunks } from "./bytes.ts";
import { qmlHtml } from "./qml-html.ts";

export function deriveSeed(name: string, password: string) {
  const salt = utf8ToBytes("logos-wiki/v1/" + name.normalize("NFC"));
  return scrypt(utf8ToBytes(password.normalize("NFC")), salt, { N: 65536, r: 8, p: 1, dkLen: 32 });
}

export {
  ADMIN_KEY,
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
  SNAPSHOT_CID,
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

export function ingestEvents(wiki: Wiki, events: { id: string }[]) {
  if (!events) return 0;
  let n = 0;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || !event.id || wiki.has(event.id)) continue;
    wiki.add(event as Parameters<Wiki["add"]>[0]);
    n++;
  }
  return n;
}

export function latestText(wiki: Wiki, full: string) {
  const page = wiki.pages.get(full) as Page | undefined;
  if (!page || !page.revs.length) return null;
  return page.revs[page.revs.length - 1].text;
}

export function richText(html: string) {
  html = html
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
    .replace(/href="\/index\.php\?title=([^"&#]+)([^"]*)"/g, (_m, title: string, query: string) => {
      const name = decodeURIComponent(String(title).replace(/\+/g, " ")).replace(/_/g, " ");
      const params = String(query || "").replace(/&amp;/g, "&");
      const q = !params ? "" : params.charAt(0) === "?" ? params : params.charAt(0) === "&" ? "?" + params.slice(1) : "?" + params;
      return `href="wiki://${encodeURIComponent(name)}${q}"`;
    });
  return qmlHtml(html);
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

export function parseWikiHref(link: string) {
  const out = { title: "", action: "", section: "", redlink: false };
  if (!link || link.charAt(0) === "#") return out;
  let rest = link;
  if (rest.indexOf("wiki://") === 0) rest = rest.slice("wiki://".length);
  else if (rest.indexOf("/wiki/") === 0) rest = rest.slice("/wiki/".length);
  const qpos = rest.indexOf("?");
  const hpos = rest.indexOf("#");
  let path = rest;
  let query = "";
  if (qpos >= 0 && (hpos < 0 || qpos < hpos)) {
    path = rest.slice(0, qpos);
    query = hpos > qpos ? rest.slice(qpos + 1, hpos) : rest.slice(qpos + 1);
  } else if (hpos >= 0) path = rest.slice(0, hpos);
  try {
    path = decodeURIComponent(path.replace(/\+/g, " ")).replace(/_/g, " ");
  } catch (_e) {
    path = path.replace(/\+/g, " ").replace(/_/g, " ");
  }
  if (path.indexOf("title=") === 0) {
    query = path + (query ? "&" + query : "");
    path = "";
  }
  const parts = query.replace(/&amp;/g, "&").split("&");
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf("=");
    const key = eq < 0 ? parts[i] : parts[i].slice(0, eq);
    let value = eq < 0 ? "" : parts[i].slice(eq + 1);
    try {
      value = decodeURIComponent(value.replace(/\+/g, " "));
    } catch (_e) {}
    if (key === "title") path = value.replace(/_/g, " ");
    if (key === "action") out.action = value;
    if (key === "section") out.section = value;
    if (key === "redlink" && (value === "1" || value === "true")) out.redlink = true;
  }
  const parsed = path ? parseTitle(path) : null;
  out.title = parsed ? parsed.full : path;
  return out;
}

export function parseWikiLink(link: string) {
  return parseWikiHref(link).title;
}

export function engineDiff(before: string, after: string) {
  const rows = diffRows(before || "", after || "")
    .replace(/<del\b[^>]*>/gi, '<font color="#8f0000">')
    .replace(/<\/del>/gi, "</font>")
    .replace(/<ins\b[^>]*>/gi, '<font color="#006400">')
    .replace(/<\/ins>/gi, "</font>");
  return `<table width="100%" cellspacing="0" cellpadding="4" border="1" bordercolor="#a2a9b1">${rows}</table>`;
}

export function engineIsAdmin(key: string) {
  return !!(key && session.admin && key.toLowerCase() === session.admin);
}

export function normalizeUsername(raw: string) {
  const s = String(raw || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function followRedirect(wiki: Wiki, rawTitle: string) {
  const page = renderPage(wiki, rawTitle);
  const target = (page as { redirect?: Title }).redirect;
  if (!target) return { title: page.title, hops: 0 as const };
  return { title: target.full, hops: 1 as const, from: page.title };
}

let session = new Wiki("");

export function resetEngine(admin: string) {
  session = new Wiki((admin || "").toLowerCase());
}

export function ingestEnvelope(envelope: unknown) {
  return ingest(session, envelope);
}

export function ingestSnapshotEvents(events: { id: string }[]) {
  return ingestEvents(session, events);
}

export function engineHas(id: string) {
  return session.has(id);
}

export function engineStats() {
  return session.stats();
}

export function engineRenderPage(rawTitle: string, editable = false) {
  try {
    return renderPage(session, rawTitle, editable);
  } catch (e) {
    return {
      html: "<p>Could not render this page.</p><p>" + e + "</p>",
      title: rawTitle,
      missing: false,
      categories: [],
      headings: [],
    };
  }
}

export function engineTitles() {
  return pageTitles(session);
}

export function engineRecent(limit = 100) {
  return recent(session, limit);
}

export function engineTrusted() {
  return session.trusted.slice();
}

export function engineAccountName(key: string) {
  return accountName(session, key);
}

export function engineCanEdit(key: string, rawTitle: string) {
  return canEditPage(session, key, rawTitle);
}

export function engineAccountTaken(userKey: string, name: string) {
  return session.names.has(userKey) || session.accounts.has(name);
}

export function engineRevisions(title: string) {
  const page = session.pages.get(title) as Page | undefined;
  return page ? page.revs.slice().reverse() : [];
}

export function enginePageExists(full: string) {
  return session.pages.has(full);
}

export function engineLatestText(full: string) {
  return latestText(session, full);
}

export function engineFollowRedirect(rawTitle: string) {
  return followRedirect(session, rawTitle);
}

export function enginePreview(rawTitle: string, text: string) {
  const title = parseTitle(rawTitle);
  if (!title) return "<p>Invalid title.</p>";
  return richText(
    render(text, {
      title,
      exists: (full) => session.pages.has(full),
      template: (full) => latestText(session, full),
      file: () => null,
      stats: session.stats(),
    }).html,
  );
}
