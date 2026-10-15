import { SITENAME } from "@/lib/config.ts";
import type { Verified } from "@/lib/events.ts";
import { byteLength, formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/format.ts";
import type { Revision } from "@/lib/state.ts";
import { actionUrl, dbKey, encodeTitle, parseTitle } from "@/lib/title.ts";
import type { Context } from "@/server/context.ts";
import { comment, esc, link, specialLink, userLink, userToolLinks } from "@/server/html.ts";
import { form, namespaceField, submitButton, textField } from "@/server/ooui.ts";
import { siteIndex } from "@/server/site.ts";
import { plusMinus } from "../actions.ts";
import { docTitle, specialProps, type Query, type ViewProps } from "../common.ts";
import { users } from "./lists.ts";

const DAY = 86_400_000;
const LIMITS = [50, 100, 250, 500];
const DAYS = [1, 3, 7, 14, 30];
const HIGHLIGHTS = `<div class="mw-rcfilters-ui-highlights">${["none", "c1", "c2", "c3", "c4", "c5"].map((c) => `<div class="mw-rcfilters-ui-highlights-color-${c}" data-color="${c}"></div>`).join("")}</div>`;
const NEW_PAGE = `<abbr class="newpage" title="This edit created a new page">N</abbr>`;
const MINOR = `<abbr class="minoredit" title="This is a minor edit">m</abbr>`;
const SEP = `<span class="mw-changeslist-separator"></span>`;

const size = (ctx: Context, id: number) => (id ? byteLength(ctx.wiki.revisions[id - 1].text) : 0);
const delta = (ctx: Context, rev: Revision) => plusMinus(byteLength(rev.text) - size(ctx, rev.parent), byteLength(rev.text));
const isCurrent = (ctx: Context, rev: Revision) => ctx.wiki.latest(rev.page)?.id === rev.id;
const titleLink = (page: string) => `<a href="/wiki/${encodeTitle(page)}" class="mw-changeslist-title" title="${esc(page)}">${esc(page)}</a>`;
const flags = (rev: Revision) => `${rev.parent ? "" : NEW_PAGE}${rev.minor ? MINOR : ""}`;
const lineClass = (rev: Revision) =>
  `mw-changeslist-line mw-changeslist-${rev.parent ? "edit" : "new"} mw-changeslist-ns${parseTitle(rev.page)?.ns ?? 0}-${esc(dbKey(rev.page))} mw-changeslist-line-not-watched`;

function a(page: string, query: Record<string, string | number>, text: string, cls = "") {
  return `<a href="${esc(actionUrl(page, query))}"${cls ? ` class="${cls}"` : ""} title="${esc(page)}">${text}</a>`;
}

function byDay<T>(items: T[], ts: (item: T) => number) {
  const days = new Map<string, T[]>();
  for (const item of items) {
    const day = formatDate(ts(item));
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return days;
}

function singleLine(ctx: Context, rev: Revision) {
  const diff = rev.parent ? a(rev.page, { diff: rev.id, oldid: rev.parent }, "diff", "mw-changeslist-diff") : "diff";
  const span = (name: string, html: string) => `<span class="mw-changeslist-line-inner-${name}">${html}</span>`;
  const inner = [
    span("articleLink", ` <span class="mw-title">${titleLink(rev.page)}</span>‎`),
    span("historyLink", ` <span class="mw-changeslist-links"><span>${diff}</span><span>${a(rev.page, { action: "history" }, "hist", "mw-changeslist-history")}</span></span>`),
    span("separatorAfterLinks", ` ${SEP} `),
    span("characterDiff", `${delta(ctx, rev)}‎`),
    span("separatorAftercharacterDiff", ` ${SEP} `),
    span("userLink", userLink(ctx.wiki, rev.user)),
    span("userTalkLink", ` ${userToolLinks(ctx.wiki, rev.user, true)}`),
    span("comment", comment(ctx.wiki, rev.summary, rev.page)),
  ].join("");
  return `<table data-mw-revid="${rev.id}" class="${lineClass(rev)} mw-enhanced-rc"><tr><td>${HIGHLIGHTS}</td><td><span class="mw-enhancedchanges-arrow-space"></span></td><td class="mw-changeslist-line-prefix"></td><td class="mw-enhanced-rc" colspan="2">${flags(rev)}     ${formatTime(rev.ts)} </td><td class="mw-changeslist-line-inner" data-target-page="${esc(rev.page)}">${inner}</td></tr></table>`;
}

function nestedRow(ctx: Context, rev: Revision) {
  const cur = isCurrent(ctx, rev) ? "cur" : `<a class="mw-changeslist-diff-cur" href="${esc(actionUrl(rev.page, { diff: 0, oldid: rev.id }))}">cur</a>`;
  const prev = rev.parent ? a(rev.page, { diff: rev.id, oldid: rev.parent }, "prev", "mw-changeslist-diff") : "prev";
  const body = `<span class="mw-enhanced-rc-time">${a(rev.page, { oldid: rev.id }, formatTime(rev.ts))}</span> (${cur} | ${prev}) ${SEP} ${delta(ctx, rev)}‎ ${SEP} ${userLink(ctx.wiki, rev.user)} ${userToolLinks(ctx.wiki, rev.user, true)}${comment(ctx.wiki, rev.summary, rev.page)}`;
  return `<tr class="mw-rcfilters-ui-highlights-enhanced-nested ${lineClass(rev)}" data-mw-revid="${rev.id}"><td></td><td></td><td></td><td class="mw-enhanced-rc">${flags(rev)}    &#160;</td><td>${HIGHLIGHTS.replace('highlights"', 'highlights mw-enhanced-rc-nested"')}</td><td class="mw-enhanced-rc-nested" data-target-page="${esc(rev.page)}">${body}</td></tr>`;
}

function groupBlock(ctx: Context, revs: Revision[]) {
  const [latest, earliest] = [revs[0], revs.at(-1)!];
  const id = `mw-checkbox-${latest.id}`;
  const counts = new Map<string, number>();
  for (const rev of revs) counts.set(rev.user, (counts.get(rev.user) ?? 0) + 1);
  const changedBy = [...counts].map(([user, n]) => `${userLink(ctx.wiki, user)}${n > 1 ? `‎ (${n}×)` : ""}`).join("; ");
  const total = byteLength(latest.text);
  const groupDiff = a(latest.page, { diff: latest.id, oldid: earliest.parent || earliest.id }, `${revs.length} changes`, "mw-changeslist-groupdiff");
  const links = `<span class="mw-changeslist-links"><span>${groupDiff}</span> <span>${a(latest.page, { action: "history" }, "history", "mw-changeslist-history")}</span></span>`;
  const top = `<tr class="mw-rcfilters-ui-highlights-enhanced-toplevel"><td>${HIGHLIGHTS}</td><td><label for="${id}" class="mw-enhancedchanges-arrow mw-enhancedchanges-arrow-space"></label></td><td class="mw-changeslist-line-prefix"></td><td class="mw-enhanced-rc" colspan="2">${earliest.parent ? "" : NEW_PAGE}    &#160;${formatTime(latest.ts)}&#160;</td><td class="mw-changeslist-line-inner"> <span class="mw-title">${titleLink(latest.page)}</span>‎‎ ${links} ${SEP} ${plusMinus(total - size(ctx, earliest.parent), total)}‎ ${SEP} <span class="changedby">[${changedBy}]</span></td></tr>`;
  return `<div><input type="checkbox" class="mw-enhancedchanges-checkbox" id="${id}"><table class="mw-enhanced-rc ${lineClass(latest)}">${top}${revs.map((r) => nestedRow(ctx, r)).join("")}</table>\n</div>`;
}

function enhancedList(ctx: Context, revs: Revision[]) {
  const legend = `<details class="mw-changeslist-legend" open=""><summary><strong>List of abbreviations:</strong></summary><dl>\n<dt class="newpage">N</dt>\n<dd class="mw-changeslist-legend-newpage">This edit created a new page</dd>\n<dt class="minoredit">m</dt>\n<dd class="mw-changeslist-legend-minor">This is a minor edit</dd>\n<dt class="mw-plusminus-pos">(<em>±123</em>)</dt>\n<dd class="mw-changeslist-legend-plusminus">The page size changed by this number of bytes</dd>\n</dl>\n</details>`;
  const days = [...byDay(revs, (r) => r.ts)].map(([day, list]) => {
    const pages = new Map<string, Revision[]>();
    for (const rev of list) pages.set(rev.page, [...(pages.get(rev.page) ?? []), rev]);
    const blocks = [...pages.values()].map((group) => (group.length > 1 ? groupBlock(ctx, group) : singleLine(ctx, group[0])));
    return `<h4>${day}</h4>\n${blocks.join("\n")}`;
  });
  return `<div class="mw-changeslist" aria-live="polite">${legend}${days.length ? days.join("") : `<div class="mw-changeslist-empty"><p>No changes during the given period match these criteria.\n</p></div>`}</div>`;
}

function rcOptions(ctx: Context, page: string, query: Query, limit: number, days: number) {
  const kept = Object.fromEntries(Object.entries(query).filter(([k, v]) => v !== undefined && k !== "title")) as Record<string, string>;
  const opt = (params: Record<string, string | number>, text: string, bold: boolean) => a(page, { ...kept, ...params }, bold ? `<strong>${text}</strong>` : text);
  const toggle = (key: string, label: string) => {
    const on = query[key] === "1";
    return `<span class="rcshowhide${key} rcshowhideoption clshowhideoption">${opt({ [key]: on ? 0 : 1 }, on ? "Show" : "Hide", false)} ${label}</span>`;
  };
  const limits = LIMITS.map((n) => opt({ limit: n }, String(n), n === limit)).join(" | ");
  const dayLinks = DAYS.map((n) => opt({ days: n }, String(n), n === days)).join(" | ");
  const toggles = [toggle("hideminor", "minor edits"), ...(ctx.viewer ? [toggle("hidemyself", "my edits")] : [])].join(" | ");
  const ns = namespaceField("Namespace:", query.namespace ?? "", "");
  return `<fieldset class="rcoptions cloptions">\n<legend>Recent changes options</legend>\n<span class="rclinks">Show last ${limits} changes in last ${dayLinks} days</span><br /><span class="rcshowhide">${toggles}</span>\n<hr />\n<form action="/index.php"><table class="mw-recentchanges-table"><tr class="namespaceForm"><td class="mw-input">${ns}</td><td class="mw-input">${submitButton("Show")}</td></tr></table><input type="hidden" value="${esc(page)}" name="title">${query.target ? `<input type="hidden" value="${esc(query.target)}" name="target">` : ""}</form>\n</fieldset>`;
}

function recent(ctx: Context, query: Query, pages?: Set<string>) {
  const limit = Math.min(Number(query.limit) || 50, 500);
  const days = Math.min(Number(query.days) || 7, 90);
  const since = Date.now() - days * DAY;
  const ns = query.namespace ? Number(query.namespace) : null;
  const revs: Revision[] = [];
  for (let i = ctx.wiki.revisions.length - 1; i >= 0 && revs.length < limit; i--) {
    const rev = ctx.wiki.revisions[i];
    if (rev.ts < since) break;
    if (pages && !pages.has(rev.page)) continue;
    if (query.hideminor === "1" && rev.minor) continue;
    if (query.hidemyself === "1" && rev.user === ctx.viewer?.name) continue;
    if (ns !== null && parseTitle(rev.page)?.ns !== ns) continue;
    revs.push(rev);
  }
  return { revs: revs.sort((x, y) => y.ts - x.ts || y.id - x.id), limit, days };
}

export function recentChanges(ctx: Context, _sub: string, query: Query): ViewProps {
  const { revs, limit, days } = recent(ctx, query);
  const summary = `<div class="mw-specialpage-summary">\n<p>Track the most recent changes to the wiki on this page.\n</p>\n</div>`;
  const head = `<div class="mw-rcfilters-head">${rcOptions(ctx, "Special:RecentChanges", query, limit, days)}</div>`;
  return specialProps("Recent changes", summary + head + enhancedList(ctx, revs));
}

export function recentChangesLinked(ctx: Context, sub: string, query: Query): ViewProps {
  const target = parseTitle(query.target ?? sub);
  const top = form("/index.php", "Related changes", [textField("Page name:", "target", target?.full ?? "", "mw-input-target"), submitButton("Show")], { title: "Special:RecentChangesLinked" });
  if (!target) return specialProps("Related changes", top);
  const linked = new Set<string>();
  for (const [to, from] of siteIndex(ctx.wiki, ctx.version).links) if (from.has(target.full)) linked.add(to);
  const { revs, limit, days } = recent(ctx, { ...query, target: target.full }, linked);
  const options = rcOptions(ctx, "Special:RecentChangesLinked", { ...query, target: target.full }, limit, days);
  return specialProps("Related changes", top + options + enhancedList(ctx, revs), {
    heading: "Related changes",
    subtitle: `(Page: ${link(ctx.wiki, target.full)})`,
  });
}

function contribLine(ctx: Context, rev: Revision) {
  const current = isCurrent(ctx, rev);
  const diff = rev.parent ? a(rev.page, { diff: "prev", oldid: rev.id }, "diff", "mw-changeslist-diff") : "diff";
  const title = `<a href="/wiki/${encodeTitle(rev.page)}" class="mw-contributions-title" title="${esc(rev.page)}">${esc(rev.page)}</a>`;
  return [
    `<li data-mw-revid="${rev.id}"${current ? ` class="mw-contributions-current"` : ""}><span class="mw-changeslist-time">${formatTime(rev.ts)}</span>${a(rev.page, { oldid: rev.id }, formatDateTime(rev.ts), "mw-changeslist-date")}`,
    `<span class="mw-changeslist-links"><span>${diff}</span> <span>${a(rev.page, { action: "history" }, "hist", "mw-changeslist-history")}</span></span> ${SEP} ${delta(ctx, rev)}‎ ${SEP} ${flags(rev)}`,
    title,
    `‎${comment(ctx.wiki, rev.summary, rev.page, false)}`,
    current ? `<span class="mw-uctop">current</span>` : "",
    `\n</li>`,
  ].join("\n");
}

function pager(page: string, base: Record<string, string>, limit: number, next: number | null, newest: boolean) {
  const nav = (params: Record<string, string | number>, text: string, cls: string) => `<a href="${esc(actionUrl(page, { ...base, ...params }))}" class="${cls}">${text}</a>`;
  const newer = newest ? `<span class="mw-prevlink">newer ${limit}</span>` : nav({ limit }, `newer ${limit}`, "mw-prevlink");
  const older = next ? nav({ offset: next, limit }, `older ${limit}`, "mw-nextlink") : `<span class="mw-nextlink">older ${limit}</span>`;
  const sizes = [20, 50, 100, 250, 500].map((n) => (n === limit ? `<span class="mw-numlink">${n}</span>` : nav({ limit: n }, String(n), "mw-numlink"))).join(" | ");
  const first = newest ? `<span class="mw-firstlink">newest</span>` : nav({ limit }, "newest", "mw-firstlink");
  return `<div class="mw-pager-navigation-bar">(${first}) View (${newer}  |  ${older}) (${sizes})</div>`;
}

function collapsedForm(legend: string, fields: string[], hidden: Record<string, string>) {
  const toggle = `<label for="mw-collapsible-toggle" class="mw-collapsible-toggle-label">${legend}</label>`;
  return `<input type="checkbox" id="mw-collapsible-toggle" class="mw-collapsible-checkbox">${form("/index.php", toggle, fields, hidden).replace("oo-ui-fieldsetLayout'>", "oo-ui-fieldsetLayout mw-collapsibleFieldsetLayout mw-collapsible mw-collapsed'>").replace("oo-ui-fieldsetLayout-group'", "oo-ui-fieldsetLayout-group mw-collapsible-content'")}`;
}

export function contributions(ctx: Context, sub: string, query: Query): ViewProps {
  const name = (query.target ?? sub).replace(/_/g, " ").trim();
  const fields = [textField("IP address or username:", "target", name, "mw-target-user-or-ip"), namespaceField("Namespace:", query.namespace ?? "all", "all"), submitButton("Search")];
  const top = collapsedForm("Search for contributions", fields, { title: "Special:Contributions" });
  if (!name) return specialProps("User contributions", top);
  const ns = query.namespace && query.namespace !== "all" ? Number(query.namespace) : null;
  const limit = Math.min(Number(query.limit) || 50, 500);
  const offset = Number(query.offset) || Infinity;
  const mine = ctx.wiki.revisions.filter((r) => r.user === name && (ns === null || parseTitle(r.page)?.ns === ns));
  const page = mine.filter((r) => r.id < offset).reverse().slice(0, limit);
  const next = page.length === limit && mine[0].id < page.at(-1)!.id ? page.at(-1)!.id : null;
  const known = users(ctx).find((u) => u.name === name);
  const tools = [
    link(ctx.wiki, `User talk:${name}`, "talk", { className: "mw-contributions-link-talk" }),
    specialLink("ListFiles", "uploads", name).replace("<a ", '<a class="mw-contributions-link-uploads" '),
    specialLink("Log", "logs", name).replace("<a ", '<a class="mw-contributions-link-logs" '),
  ];
  const info = known ? `<div class="mw-contributions-editor-info">A user with ${formatNumber(mine.length)} edit${mine.length === 1 ? "" : "s"}.${known.created ? ` Account created on ${formatDate(known.created)}.` : ""}</div>` : "";
  const subtitle = `<div class="mw-contributions-user-tools">For ${link(ctx.wiki, `User:${name}`, esc(name))} <span class="mw-changeslist-links">${tools.map((t) => `<span>${t}</span>`).join(" ")}</span></div>${info}`;
  const base = { target: name, ...(ns !== null ? { namespace: String(ns) } : {}) };
  const nav = pager(`Special:Contributions/${name}`, base, limit, next, offset === Infinity);
  const days = [...byDay(page, (r) => r.ts)].map(([day, revs], i) => `<h4 class="${i ? "" : "mw-index-pager-list-header-first "}mw-index-pager-list-header">${day}</h4><ul class="mw-contributions-list">\n${revs.map((r) => contribLine(ctx, r)).join("\n")}\n</ul>`);
  const body = page.length ? `${nav}<section class='mw-pager-body'>\n${days.join("")}</section>\n${nav}` : `<p>No changes were found matching these criteria.\n</p>`;
  return specialProps(`Contributions of ${name}`, top + body, {
    heading: `User contributions for ${esc(name)}`,
    docTitle: docTitle(`User contributions for ${name}`),
    subtitle,
  });
}

type LogType = "newusers" | "upload" | "rights";
type LogEntry = { type: LogType; ts: number; user: string; page: string; html: string };
const LOG_NAMES: Record<LogType, string> = { newusers: "User creation log", upload: "Upload log", rights: "Trusted editors log" };
const LOG_INTROS: Record<LogType, string> = {
  newusers: "This is a log of user creations.",
  upload: "This is a log of all file uploads.",
  rights: "This is a log of changes to the trusted editors list.",
};

function logEntries(ctx: Context) {
  const { wiki } = ctx;
  const entries: LogEntry[] = [];
  const who = (name: string) => `${userLink(wiki, name)} ${userToolLinks(wiki, name)}`;
  const nameOf = (e: Verified) => ("as" in e && e.as ? e.as : wiki.names.get(e.by) ?? "");
  let trusted: string[] = [];
  for (const e of wiki.log) {
    if (e.t === "account") entries.push({ type: "newusers", ts: e.ts, user: e.name, page: `User:${e.name}`, html: `User account ${who(e.name)} was created` });
    if (e.t === "file" && wiki.files.get(e.name)?.ts === e.ts) {
      const user = nameOf(e);
      entries.push({ type: "upload", ts: e.ts, user, page: `File:${e.name}`, html: `${who(user)} uploaded ${link(wiki, `File:${e.name}`)}` });
    }
    if (e.t === "trust") {
      const added = e.editors.filter((n) => !trusted.includes(n));
      const removed = trusted.filter((n) => !e.editors.includes(n));
      trusted = e.editors;
      const list = (names: string[]) => names.map((n) => userLink(wiki, n)).join(", ");
      const change = [added.length && `added ${list(added)}`, removed.length && `removed ${list(removed)}`].filter(Boolean).join("; ") || "made no changes";
      const user = nameOf(e);
      entries.push({ type: "rights", ts: e.ts, user, page: "Special:TrustedEditors", html: `${who(user)} changed the trusted editors list: ${change}` });
    }
  }
  return entries.reverse();
}

export function log(ctx: Context, sub: string, query: Query): ViewProps {
  const [first = "", rest = ""] = sub.split("/");
  const type = (Object.hasOwn(LOG_NAMES, first) ? first : query.type) as LogType | undefined;
  const user = (query.user ?? (type ? rest : first)).replace(/_/g, " ").trim();
  const page = parseTitle(query.page ?? "")?.full ?? "";
  const entries = logEntries(ctx).filter((e) => (!type || e.type === type) && (!user || e.user === user) && (!page || e.page === page));
  const select = `<div class='oo-ui-layout oo-ui-fieldLayout oo-ui-fieldLayout-align-top'><div class='oo-ui-fieldLayout-body'><span class='oo-ui-fieldLayout-header'><label class='oo-ui-labelElement-label' for='mw-log-type'>Logs:</label></span><div class='oo-ui-fieldLayout-field'><div class='oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-dropdownInputWidget oo-ui-dropdownInputWidget-php'><select name='type' id='mw-log-type' class='oo-ui-inputWidget-input oo-ui-indicator-down'><option value=''>All public logs</option>${(Object.keys(LOG_NAMES) as LogType[]).map((t) => `<option value='${t}'${t === type ? " selected='selected'" : ""}>${LOG_NAMES[t]}</option>`).join("")}</select></div></div></div></div>`;
  const fields = [select, textField("Performer:", "user", user, "mw-input-user"), textField("Target (title or User:username for user):", "page", page, "mw-input-page"), submitButton("Show")];
  const top = form("/index.php", "Logs", fields, { title: "Special:Log" });
  const intro = type ? `<p>${LOG_INTROS[type]}\n</p>` : `<p>Combined display of all available logs of ${esc(SITENAME)}.\nYou can narrow down the view by selecting a log type, the username (case-sensitive), or the affected page (also case-sensitive).\n</p>`;
  const items = entries.map((e) => `<li class="mw-logline-${e.type}"> <span class="mw-logevent-time">${formatDateTime(e.ts)}</span> ${e.html}</li>`);
  const body = items.length ? `<ul class='mw-logevent-loglines'>\n${items.join("\n")}\n</ul>` : `<div class="mw-warning-logempty">\n<p>No matching items in log.\n</p>\n</div>`;
  const heading = type ? LOG_NAMES[type] : "All public logs";
  return specialProps(heading, intro + top + body);
}
