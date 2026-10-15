import { SITENAME } from "@/lib/config.ts";
import { byteLength, formatBytes, formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/format.ts";
import { actionUrl, encodeTitle, NAMESPACES, parseTitle, type Title } from "@/lib/title.ts";
import type { Heading } from "@/lib/wikitext/blocks.ts";
import type { Context } from "@/server/context.ts";
import { esc, link, specialLink, userWithTools } from "@/server/html.ts";
import { checkField, form, namespaceField, submitButton, textField } from "@/server/ooui.ts";
import { renderRevision, siteIndex } from "@/server/site.ts";
import { SPECIAL_TITLES } from "@/server/special-names.ts";
import { specialProps, type Query, type ViewProps } from "../common.ts";

const byText = (a: Title, b: Title) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0);

function isRedirect(ctx: Context, full: string) {
  const rev = ctx.wiki.latest(full);
  return !!rev && !!renderRevision(ctx.wiki, ctx.version, rev, false).redirect;
}

function pageList(ctx: Context, titles: Title[], hideRedirects: boolean, label = (t: Title) => t.text) {
  const items = titles
    .filter((t) => !(hideRedirects && isRedirect(ctx, t.full)))
    .map((t) => {
      if (!isRedirect(ctx, t.full)) return `<li>${link(ctx.wiki, t.full, esc(label(t)))}</li>`;
      return `<li class="allpagesredirect"><a href="${esc(actionUrl(t.full, { redirect: "no" }))}" class="mw-redirect" title="${esc(t.full)}">${esc(label(t))}</a></li>`;
    });
  return `<div class="mw-allpages-body"><ul class="mw-allpages-chunk">${items.join("\n")}</ul></div>`;
}

function titlesIn(ctx: Context, ns: number) {
  return [...ctx.wiki.pages.values()].map((p) => p.title).filter((t) => t.ns === ns).sort(byText);
}

export function allPages(ctx: Context, sub: string, query: Query): ViewProps {
  const ns = Number(query.namespace ?? 0) || 0;
  const from = query.from ?? sub;
  const to = query.to ?? "";
  const hide = query.hideredirects === "1";
  const titles = titlesIn(ctx, ns).filter((t) => (!from || t.text >= from) && (!to || t.text <= to));
  const fields = [
    textField("Display pages starting at:", "from", from, "nsfrom"),
    textField("Display pages ending at:", "to", to, "nsto"),
    namespaceField("Namespace:", String(ns)),
    checkField("Hide redirects", "hideredirects", hide),
    submitButton("Go"),
  ];
  return specialProps("All pages", form("/wiki/Special:AllPages", "All pages", fields) + pageList(ctx, titles, hide));
}

export function prefixIndex(ctx: Context, sub: string, query: Query): ViewProps {
  const raw = query.prefix ?? sub;
  const parsed = raw ? parseTitle(raw) : null;
  const ns = parsed ? parsed.ns : Number(query.namespace ?? 0) || 0;
  const prefix = parsed?.text ?? "";
  const hide = query.hideredirects === "1";
  const titles = titlesIn(ctx, ns).filter((t) => t.text.startsWith(prefix));
  const fields = [textField("Display pages with prefix:", "prefix", prefix, "nsfrom"), namespaceField("Namespace:", String(ns)), checkField("Hide redirects", "hideredirects", hide), submitButton("Go")];
  const body = raw || query.namespace ? pageList(ctx, titles, hide) : "";
  return specialProps("All pages with prefix", form("/wiki/Special:PrefixIndex", "All pages with prefix", fields) + body);
}

export function categories(ctx: Context, _sub: string, query: Query): ViewProps {
  const index = siteIndex(ctx.wiki, ctx.version).categories;
  const names = new Set([...index.keys(), ...titlesIn(ctx, 14).map((t) => t.text)]);
  const from = query.from ?? "";
  const items = [...names]
    .filter((n) => n >= from)
    .sort()
    .map((n) => {
      const count = index.get(n)?.length ?? 0;
      return `<li>${link(ctx.wiki, `Category:${n}`, esc(n))}‏‎ (${formatNumber(count)} member${count === 1 ? "" : "s"})</li>`;
    });
  const intro = `<p>The following categories exist on the wiki, and may or may not be unused.\nAlso see ${specialLink("WantedCategories", "wanted categories")}.\n</p>`;
  const fields = [textField("Display categories starting at:", "from", from, "from"), submitButton("Show")];
  return specialProps("Categories", `<div class="mw-spcontent">${intro}${form("/wiki/Special:Categories", "Categories", fields)}<ul>${items.join("\n")}</ul></div>`);
}

export function users(ctx: Context) {
  const { wiki } = ctx;
  const firstEdit = new Map<string, number>();
  for (const rev of wiki.revisions) if (!firstEdit.has(rev.user)) firstEdit.set(rev.user, rev.ts);
  const names = new Set([...wiki.accounts.keys(), ...wiki.reserved]);
  const created = (name: string) => Math.min(wiki.accounts.get(name)?.ts ?? Infinity, firstEdit.get(name) ?? Infinity);
  return [...names].sort().map((name) => ({ name, created: Number.isFinite(created(name)) ? created(name) : 0 }));
}

export function listUsers(ctx: Context, _sub: string, query: Query): ViewProps {
  const start = query.username ?? "";
  const groupLink = (page: string, label: string) => link(ctx.wiki, `${SITENAME}:${page}`, label);
  const items = users(ctx)
    .filter((u) => u.name >= start)
    .map(({ name, created }) => {
      const groups = [ctx.wiki.isAdmin(name) && groupLink("Administrators", "administrator"), ctx.wiki.trusted.includes(name) && specialLink("TrustedEditors", "trusted editor")].filter(Boolean);
      const when = created ? ` (Created on ${formatDate(created)} at ${formatTime(created)})` : "";
      return `<li>${userWithTools(ctx.wiki, name).replace('class="mw-usertoollinks"', 'class="mw-usertoollinks mw-changeslist-links"')}${groups.length ? `‏‎ (${groups.join(", ")})` : ""}${when}</li>`;
    });
  const fields = [textField("Display users starting at:", "username", start, "mw-input-username"), submitButton("Show")];
  return specialProps("User list", form("/wiki/Special:ListUsers", "User list", fields) + `<ul>${items.join("")}</ul>`);
}

export function listFiles(ctx: Context): ViewProps {
  const rows = [...ctx.wiki.files.values()]
    .sort((a, b) => b.ts - a.ts)
    .map((f) => {
      const src = `/files/${encodeURIComponent(f.name)}`;
      return `<tr><td class="TablePager_col_img_timestamp">${formatDateTime(f.ts)}</td><td class="TablePager_col_img_name">${link(ctx.wiki, `File:${f.name}`, esc(f.name))} (<a href="${src}">file</a>)</td><td class="TablePager_col_thumb"><a href="${src}"><img alt="" src="${src}" decoding="async" loading="lazy" width="180" height="${Math.max(1, Math.round((f.height * 180) / f.width))}" /></a></td><td class="TablePager_col_img_size">${formatBytes(f.size)}</td><td class="TablePager_col_img_actor">${userWithTools(ctx.wiki, f.user)}</td><td class="TablePager_col_img_description"></td></tr>`;
    });
  const table = `<table class="mw-datatable listfiles"><thead><tr><th>Date</th><th>Name</th><th>Thumbnail</th><th>Size</th><th>User</th><th>Description</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  return specialProps("File list", `<p>This special page shows all uploaded files.\n</p>${table}`);
}

const GROUPS: [string, string, string[]][] = [
  ["pages", "Lists of pages", ["AllPages", "PrefixIndex", "Categories", "Search"]],
  ["login", "Account management", ["UserLogin", "UserLogout"]],
  ["users", "Users and rights", ["CreateAccount", "TrustedEditors", "Contributions", "ListUsers"]],
  ["changes", "Recent changes and logs", ["Log", "RecentChanges", "RecentChangesLinked"]],
  ["media", "Media reports and uploads", ["ListFiles", "Upload"]],
  ["redirects", "Redirecting special pages", ["Random"]],
  ["pagetools", "Page tools", ["WhatLinksHere"]],
];

export function specialPages(): ViewProps {
  const toc: Heading[] = GROUPS.map(([id, label], i) => ({ level: 2, text: label, anchor: `mw-specialpagesgroup-${id}`, number: String(i + 1), toclevel: 1 }));
  const html = GROUPS.map(([id, label, names]) => {
    const items = [...names].sort((a, b) => SPECIAL_TITLES[a].localeCompare(SPECIAL_TITLES[b])).map((n) => `<li>${specialLink(n, SPECIAL_TITLES[n])}</li>`);
    return `<h2 class="mw-specialpagesgroup" id="mw-specialpagesgroup-${id}">${label}</h2>\n<div class="mw-specialpages-list"><ul>${items.join("\n")}</ul></div>`;
  });
  return specialProps("Special pages", `<meta property="mw:PageProp/toc" />${html.join("")}`, { toc });
}

export function whatLinksHere(ctx: Context, sub: string, query: Query): ViewProps {
  const target = parseTitle(query.target ?? sub);
  const fields = [textField("Page:", "target", target?.full ?? "", "mw-whatlinkshere-target"), namespaceField("Namespace:", query.namespace ?? "", ""), submitButton("Go")];
  const top = form("/wiki/Special:WhatLinksHere", "What links here", fields);
  if (!target) return specialProps("What links here", top);
  const index = siteIndex(ctx.wiki, ctx.version);
  const ns = query.namespace ? Number(query.namespace) : null;
  const sources = new Map<string, string[]>();
  for (const from of index.links.get(target.full) ?? []) sources.set(from, isRedirect(ctx, from) ? ["redirect page"] : []);
  for (const from of index.transclusions.get(target.full) ?? []) sources.set(from, [...(sources.get(from) ?? []), "transclusion"]);
  const items = [...sources]
    .filter(([from]) => ns === null || parseTitle(from)?.ns === ns)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([from, notes]) => {
      const redirect = notes.includes("redirect page");
      const anchor = redirect ? `<a href="${esc(actionUrl(from, { redirect: "no" }))}" class="mw-redirect" title="${esc(from)}">${esc(from)}</a>` : link(ctx.wiki, from);
      const tools = `<span class="mw-whatlinkshere-tools">(<a href="${esc(actionUrl("Special:WhatLinksHere", { target: from }))}" title="Special:WhatLinksHere">← links</a>)</span>`;
      return `<li>${anchor}${notes.length ? ` (${notes.join(" | ")})` : " "} ‎ ${tools}</li>`;
    });
  const body = items.length
    ? `<p>The following pages link to <strong>${link(ctx.wiki, target.full)}</strong>:\n</p><p>Displayed ${items.length} item${items.length === 1 ? "" : "s"}.\n</p><ul id="mw-whatlinkshere-list">${items.join("\n")}</ul>`
    : `<p>No pages link to <strong>${link(ctx.wiki, target.full)}</strong>.\n</p>`;
  return specialProps(`Pages that link to "${target.full}"`, top + body, {
    heading: `Pages that link to "${esc(target.full)}"`,
    subtitle: `← ${link(ctx.wiki, target.full)}`,
  });
}

function snippet(text: string, terms: string[]) {
  const lines = text.split("\n").filter((l) => terms.some((t) => l.toLowerCase().includes(t))).slice(0, 2);
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return lines.map((l) => esc(l.length > 200 ? l.slice(0, 200) : l).replace(pattern, '<span class="searchmatch">$1</span>')).join("\n");
}

export type SearchOutcome = ViewProps | { redirect: string };

export function search(ctx: Context, sub: string, query: Query): SearchOutcome {
  const term = (query.search ?? sub).trim();
  if (term && query.fulltext !== "1" && !query.offset) {
    const exact = parseTitle(term);
    if (exact && ctx.wiki.pages.has(exact.full)) return { redirect: `/wiki/${encodeTitle(exact.full)}` };
  }
  const profile = query.profile ?? "default";
  const namespaces = profile === "all" ? null : profile === "images" ? [6] : [0];
  const terms = term.toLowerCase().split(/\s+/).filter(Boolean);
  const pages = [...ctx.wiki.pages.values()].filter((p) => !namespaces || namespaces.includes(p.title.ns));
  const matches = (s: string) => terms.length > 0 && terms.every((t) => s.toLowerCase().includes(t));
  const titleHits = pages.filter((p) => matches(p.title.full));
  const textHits = pages.filter((p) => !titleHits.includes(p) && matches(p.revs.at(-1)!.text));
  const total = titleHits.length + textHits.length;
  const result = (p: (typeof pages)[number], pos: number) => {
    const rev = p.revs.at(-1)!;
    const words = rev.text.split(/\s+/).filter(Boolean).length;
    return `<li class="mw-search-result mw-search-result-ns-${p.title.ns}"><div class="mw-search-result-heading">${link(ctx.wiki, p.title.full, esc(p.title.full), { extra: ` data-serp-pos="${pos}"` })} </div><div class="searchresult">${snippet(rev.text, terms)}</div> <div class='mw-search-result-data'>${formatBytes(byteLength(rev.text))} (${formatNumber(words)} words) - ${formatDateTime(rev.ts)}</div></li>`;
  };
  const exact = term ? parseTitle(term) : null;
  const createLink = exact
    ? ctx.wiki.pages.has(exact.full)
      ? `There is a page named "${link(ctx.wiki, exact.full)}" on this wiki.`
      : `Create the page "${link(ctx.wiki, exact.full)}" on this wiki!`
    : "";
  const tabs = [
    ["default", "Content pages", "Search in (Main)"],
    ["images", "Multimedia", "Search for files"],
    ["all", "Everything", "Search all of content (including talk pages)"],
  ]
    .map(([id, label, tip]) => `<li class="${id === profile ? "current" : "normal"}"><a href="${esc(actionUrl("Special:Search", { profile: id, search: term, fulltext: 1 }))}" title="${tip}">${label}</a></li>`)
    .join("");
  const box = `<div class="mw-search-form-wrapper"><form id="search" method="get" action="/index.php"><div id="mw-search-top-table"><div class='oo-ui-layout oo-ui-fieldLayout oo-ui-fieldLayout-align-top oo-ui-actionFieldLayout'><div class='oo-ui-fieldLayout-body'><span class='oo-ui-fieldLayout-header'><label for='ooui-php-1' class='oo-ui-labelElement-label'></label></span><div class='oo-ui-fieldLayout-field'><div class='oo-ui-actionFieldLayout-input'><div id='searchText' class='oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-iconElement oo-ui-textInputWidget oo-ui-textInputWidget-type-text oo-ui-textInputWidget-php mw-widget-titleInputWidget mw-widget-searchInputWidget'><input type='search' tabindex='0' title='Search ${esc(SITENAME)}' name='search' value='${esc(term)}' autocapitalize='sentences' id='ooui-php-1' class='oo-ui-inputWidget-input' /><span class='oo-ui-iconElement-icon oo-ui-icon-search'></span><span class='oo-ui-indicatorElement-indicator oo-ui-indicatorElement-noIndicator'></span></div></div><span class='oo-ui-actionFieldLayout-button'><span class='oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-buttonElement oo-ui-buttonElement-framed oo-ui-labelElement oo-ui-flaggedElement-progressive oo-ui-flaggedElement-primary oo-ui-buttonInputWidget'><button type='submit' tabindex='0' value='' class='oo-ui-inputWidget-input oo-ui-buttonElement-button'><span class='oo-ui-iconElement-icon oo-ui-iconElement-noIcon oo-ui-image-invert'></span><span class='oo-ui-labelElement-label'>Search</span><span class='oo-ui-indicatorElement-indicator oo-ui-indicatorElement-noIndicator oo-ui-image-invert'></span></button></span></span></div></div></div>${total ? `<div class="results-info" data-mw-num-results-offset="0" data-mw-num-results-total="${total}">Results <strong>1 – ${total}</strong> of <strong>${total}</strong></div>` : ""}<input type="hidden" value="Special:Search" name="title"><input type="hidden" value="${esc(profile)}" name="profile"><input type="hidden" value="1" name="fulltext"></div><div class="mw-search-visualclear"></div><div class="mw-search-profile-tabs"><div class="search-types"><ul>${tabs}</ul></div><div style="clear:both"></div></div></form></div>`;
  if (!term) return specialProps("Search", box);
  const section = (heading: string, list: typeof pages) =>
    list.length ? `<h2>${heading}</h2><ul class='mw-search-results'>${list.map(result).join("")}</ul><div class='mw-search-visualclear'></div>` : "";
  const results = total
    ? `<div class="mw-search-results-container">${section("Page title matches", titleHits)}${section("Page text matches", textHits)}</div>`
    : `<p class="mw-search-nonefound">There were no results matching the query.\n</p>`;
  const body = `<div class="searchresults"><div class="mw-search-results-info"><p class="mw-search-createlink">${createLink}\n</p></div><div class="mw-search-visualclear"></div>${results}</div>`;
  return specialProps("Search results", box + body, { docTitle: `Search results for "${term}" - ${SITENAME}` });
}

export const namespaceName = (ns: number) => NAMESPACES[ns] ?? "";
