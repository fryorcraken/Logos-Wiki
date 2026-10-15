import type { Wiki } from "@/lib/state.ts";
import { actionUrl, encodeTitle, NAMESPACES, pageUrl, parseTitle, type Title } from "@/lib/title.ts";
import { escapeHtml } from "@/lib/wikitext/sanitize.ts";
import { pageExists } from "./site.ts";

export const esc = escapeHtml;

export function link(wiki: Wiki, full: string, text = full, attrs: { className?: string; query?: Record<string, string | number>; extra?: string } = {}) {
  const exists = pageExists(wiki, full);
  const classes = [exists ? "" : "new", attrs.className ?? ""].filter(Boolean).join(" ");
  const href = attrs.query ? actionUrl(full, attrs.query) : exists ? pageUrl(full) : actionUrl(full, { action: "edit", redlink: 1 });
  const title = exists ? full : `${full} (page does not exist)`;
  return `<a href="${esc(href)}"${classes ? ` class="${classes}"` : ""} title="${esc(title)}"${attrs.extra ?? ""}>${text === full ? esc(text) : text}</a>`;
}

export const specialLink = (name: string, text: string, sub = "") =>
  `<a href="/wiki/Special:${name}${sub ? `/${encodeTitle(sub)}` : ""}" title="Special:${esc(name)}${sub ? `/${esc(sub)}` : ""}">${text}</a>`;

export function userLink(wiki: Wiki, name: string, revid?: number) {
  const extra = revid ? ` data-mw-revid="${revid}"` : "";
  return link(wiki, `User:${name}`, `<bdi>${esc(name)}</bdi>`, { className: "mw-userlink", extra });
}

export function userToolLinks(wiki: Wiki, name: string, changeslist = false) {
  const talk = link(wiki, `User talk:${name}`, "talk", { className: "mw-usertoollinks-talk" });
  const contribs = `<a href="/wiki/Special:Contributions/${encodeTitle(name)}" class="mw-usertoollinks-contribs" title="Special:Contributions/${esc(name)}">contribs</a>`;
  if (changeslist) return `<span class="mw-usertoollinks mw-changeslist-links"><span>${talk}</span> <span>${contribs}</span></span>`;
  return `<span class="mw-usertoollinks">(${talk} | ${contribs})</span>`;
}

export const userWithTools = (wiki: Wiki, name: string, revid?: number) => `${userLink(wiki, name, revid)} ${userToolLinks(wiki, name)}`;

export function formatComment(wiki: Wiki, summary: string, page?: string) {
  return esc(summary)
    .replace(/\/\*\s*(.*?)\s*\*\//g, (_, section: string) => {
      const href = `${page ? pageUrl(page) : ""}#${section.replace(/ /g, "_")}`;
      return `<span class="autocomment"><a href="${esc(href)}">→‎${section}</a></span>`;
    })
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (raw, target: string, label?: string) => {
      const title = parseTitle(target);
      return title ? link(wiki, title.full, label || target) : raw;
    });
}

export const comment = (wiki: Wiki, summary: string, page?: string, parens = true) =>
  summary ? ` <span class="comment${parens ? "" : " comment--without-parentheses"}">${parens ? "(" : ""}${formatComment(wiki, summary, page)}${parens ? ")" : ""}</span>` : "";

export function titleHeading(title: Title) {
  const prefix = NAMESPACES[title.ns];
  const main = `<span class="mw-page-title-main">${esc(title.text)}</span>`;
  if (!prefix) return main;
  return `<span class="mw-page-title-namespace">${esc(prefix)}</span><span class="mw-page-title-separator">:</span>${main}`;
}

export function subpages(wiki: Wiki, title: Title) {
  if (title.ns === 0 && !title.text.includes("/")) return "";
  const parts = title.text.split("/");
  const crumbs: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const full = `${NAMESPACES[title.ns] ? `${NAMESPACES[title.ns]}:` : ""}${parts.slice(0, i).join("/")}`;
    if (!wiki.pages.has(full)) continue;
    crumbs.push(link(wiki, full, esc(i === 1 ? full : parts[i - 1])));
  }
  return crumbs.length ? `<div class="subpages">&lt; ${crumbs.join("‎ | ")}</div>` : "";
}

export function catlinks(wiki: Wiki, categories: { name: string }[]) {
  const names = [...new Set(categories.map((c) => c.name))];
  if (!names.length) return "";
  const items = names.map((name) => `<li>${link(wiki, `Category:${name}`, esc(name))}</li>`).join("");
  return `<div id="mw-normal-catlinks" class="mw-normal-catlinks">${specialLink("Categories", names.length > 1 ? "Categories" : "Category")}: <ul>${items}</ul></div>`;
}
