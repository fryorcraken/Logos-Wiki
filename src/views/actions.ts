import { SITENAME } from "@/lib/config.ts";
import { diffRows } from "@/lib/diff.ts";
import { byteLength, formatDate, formatDateTime, formatNumber, formatTime, isoSeconds } from "@/lib/format.ts";
import type { Revision } from "@/lib/state.ts";
import { actionUrl, pageUrl, parseTitle, type Title } from "@/lib/title.ts";
import { sectionText } from "@/lib/sections.ts";
import type { Context } from "@/server/context.ts";
import { comment, esc, link, specialLink, titleHeading, userLink, userToolLinks, userWithTools } from "@/server/html.ts";
import { renderRevision } from "@/server/site.ts";
import { canEdit, docTitle, pageProps, type Query, type ViewProps } from "./common.ts";

const back = (title: Title) => `← <a href="${esc(pageUrl(title.full))}" title="${esc(title.full)}">${esc(title.full)}</a>`;

function permissionError(ctx: Context, title: Title) {
  if (title.ns === 8 || title.ns === 9) {
    return "This page provides interface text for the software on this wiki, and is protected to prevent abuse.\nTo add or change translations for all wikis, please use translatewiki.net, the MediaWiki localisation project.";
  }
  const group = ctx.viewer ? specialLink("TrustedEditors", "Trusted editors") : link(ctx.wiki, `${SITENAME}:Users`, "Users");
  return `The action you have requested is limited to users in the group: ${group}.`;
}

function templatesUsed(ctx: Context, templates: Set<string>) {
  const items = [...templates].filter((t) => ctx.wiki.pages.has(t)).sort();
  if (!items.length) return `<div class="templatesUsed"></div>`;
  const list = items
    .map((t) => `<li>${link(ctx.wiki, t)} (<a href="${esc(actionUrl(t, { action: "edit" }))}" title="${esc(t)}">${canEdit(ctx, parseTitle(t)!) ? "edit" : "view source"}</a>) </li>`)
    .join("");
  return `<div class="templatesUsed"><div class="mw-templatesUsedExplanation"><p>Templates used on this page:\n</p></div><ul>\n${list}</ul></div>`;
}

export type EditorState = { title: string; section: string; text: string; original: string; base: number; summary: string; creating: boolean };

export function editView(ctx: Context, title: Title, query: Query): ViewProps & { editor?: EditorState } {
  const rev = query.oldid ? ctx.wiki.revisions[Number(query.oldid) - 1] : ctx.wiki.latest(title.full);
  const section = query.section ?? "";
  const full = rev?.text ?? "";
  const text = section && section !== "new" ? (sectionText(full, Number(section)) ?? full) : full;
  const returnto = `<p id="mw-returnto">Return to ${link(ctx.wiki, title.full)}.</p>`;
  const used = rev ? renderRevision(ctx.wiki, ctx.version, rev, false).templates : new Set<string>();
  if (!canEdit(ctx, title)) {
    const content = [
      `<p>You do not have permission to edit this page, for the following reason:\n</p>`,
      `<div class="permissions-errors">\n<p>${permissionError(ctx, title)}\n</p>\n</div>`,
      rev ? `<hr />\n<p>You can view and copy the source of this page.\n</p><textarea readonly="" accesskey="," id="wpTextbox1" cols="80" rows="25" class="mw-editfont-monospace" lang="en" dir="ltr" name="wpTextbox1">${esc(text)}</textarea>${templatesUsed(ctx, used)}` : "",
      returnto,
    ].join("");
    return pageProps(ctx, title, "edit", { heading: `View source for ${esc(title.full)}`, docTitle: docTitle(`View source for ${title.full}`), content, subtitle: back(title) });
  }
  const creating = !rev;
  const verb = creating ? "Creating" : "Editing";
  const suffix = section === "new" ? " (new section)" : section ? ` (section)` : "";
  return {
    ...pageProps(ctx, title, "edit", {
      heading: `${verb} ${titleHeading(title).replace(/<[^>]+>/g, "")}${suffix}`,
      docTitle: docTitle(`${verb} ${title.full}${suffix}`),
      content: templatesUsed(ctx, used),
    }),
    editor: { title: title.full, section, text: section === "new" ? "" : text, original: full, base: ctx.wiki.latest(title.full)?.id ?? 0, summary: section && section !== "new" ? sectionSummary(text) : "", creating },
  };
}

function sectionSummary(text: string) {
  const heading = /^(=+)\s*(.*?)\s*\1/.exec(text);
  return heading ? `/* ${heading[2]} */ ` : "";
}

function historyLine(ctx: Context, title: Title, revs: Revision[], k: number) {
  const rev = revs[k];
  const latest = revs.at(-1)!;
  const prev = revs[k - 1];
  const a = (query: Record<string, string | number>, cls: string, tip: string, text: string) =>
    `<a href="${esc(actionUrl(title.full, query))}" class="${cls}" title="${tip}">${text}</a>`;
  const cur = rev === latest ? `<span class="mw-history-histlinks-current">cur</span>` : a({ diff: latest.id, oldid: rev.id }, "mw-history-histlinks-current", "Difference with latest revision", "cur");
  const prevLink = prev ? a({ diff: "prev", oldid: rev.id }, "mw-history-histlinks-previous", "Difference with preceding revision", "prev") : `<span class="mw-history-histlinks-previous">prev</span>`;
  const size = byteLength(rev.text);
  const delta = size - (prev ? byteLength(prev.text) : 0);
  const radios =
    rev === latest
      ? `<input type="radio" value="${rev.id}" disabled="" name="oldid" id="mw-oldid-null"><input type="radio" value="${rev.id}" checked="" name="diff" id="mw-diff-${rev.id}">`
      : `<input type="radio" value="${rev.id}"${k === revs.length - 2 ? ' checked=""' : ""} name="oldid" id="mw-oldid-${rev.id}"><input type="radio" value="${rev.id}" name="diff" id="mw-diff-${rev.id}">`;
  return [
    `<li data-mw-revid="${rev.id}"><span class="mw-history-histlinks mw-changeslist-links"><span>${cur}</span><span>${prevLink}</span></span>${radios} `,
    `<span class="mw-changeslist-time">${formatTime(rev.ts)}</span><a href="${esc(actionUrl(title.full, { oldid: rev.id }))}" class="mw-changeslist-date" title="${esc(title.full)}">${formatDateTime(rev.ts)}</a>‎ `,
    `<span class='history-user'>${userLink(ctx.wiki, rev.user, rev.id)} ${userToolLinks(ctx.wiki, rev.user, true)}</span>‎ `,
    rev.minor ? `<abbr class="minoredit" title="This is a minor edit">m</abbr> ` : "",
    `<span class="mw-changeslist-separator"></span> <span class="history-size mw-diff-bytes" data-mw-bytes="${size}">${formatNumber(size)} bytes</span> ${plusMinus(delta, size)}‎ <span class="mw-changeslist-separator"></span> `,
    rev.summary ? comment(ctx.wiki, rev.summary, title.full, false) : "",
    `</li>`,
  ].join("");
}

export function plusMinus(delta: number, size: number) {
  const cls = delta > 0 ? "mw-plusminus-pos" : delta < 0 ? "mw-plusminus-neg" : "mw-plusminus-null";
  const text = delta > 0 ? `+${formatNumber(delta)}` : delta < 0 ? `−${formatNumber(-delta)}` : "0";
  const tag = Math.abs(delta) > 500 ? "strong" : "span";
  return `<${tag} dir="ltr" class="${cls} mw-diff-bytes" title="${formatNumber(size)} byte${size === 1 ? "" : "s"} after change">${text}</${tag}>`;
}

export function historyView(ctx: Context, title: Title): ViewProps {
  const page = ctx.wiki.pages.get(title.full);
  if (!page) {
    const content = `<p>There is no revision history for this page.\n</p>`;
    return pageProps(ctx, title, "history", { heading: `${esc(title.full)}: Revision history`, docTitle: docTitle(`${title.full}: Revision history`), content });
  }
  const revs = page.revs;
  const days = new Map<string, string[]>();
  for (let k = revs.length - 1; k >= 0; k--) {
    const day = formatDate(revs[k].ts);
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(historyLine(ctx, title, revs, k));
  }
  const list = [...days]
    .map(([day, lines], i) => `<h4 class="${i === 0 ? "mw-index-pager-list-header-first " : ""}mw-index-pager-list-header">${day}</h4><ul class="mw-contributions-list">\n${lines.join("\n")}\n</ul>`)
    .join("");
  const button = `<div class="mw-history-compareselectedversions"><input class="historysubmit mw-history-compareselectedversions-button cdx-button" title="See the differences between the two selected revisions of this page [v]" accesskey="v" type="submit" value="Compare selected revisions">\n</div>`;
  const content = [
    `<div class="mw-history-legend">\n<p>Diff selection: Mark the radio buttons of the revisions to compare and hit enter or the button at the bottom.<br />\nLegend: <strong>(cur)</strong> = difference with latest revision, <strong>(prev)</strong> = difference with preceding revision, <strong>m</strong> = minor edit.\n</p>\n</div>`,
    `<form action="/index.php" id="mw-history-compare">\n<input type="hidden" value="${esc(title.full.replace(/ /g, "_"))}" name="title">\n${button}<section id="pagehistory" class="mw-pager-body">${list}</section>${button}</form>`,
  ].join("");
  return pageProps(ctx, title, "history", {
    heading: `${esc(title.full)}: Revision history`,
    docTitle: docTitle(`${title.full}: Revision history`),
    content,
    subtitle: `<div class="mw-history-subtitle"><a href="${esc(actionUrl("Special:Log", { page: title.full }))}" title="Special:Log">View logs for this page</a></div>`,
  });
}

function diffSide(ctx: Context, title: Title, rev: Revision, side: "o" | "n", latest: Revision, nav: string) {
  const label = rev === latest ? "Latest revision as of" : "Revision as of";
  const edit = rev === latest ? actionUrl(title.full, { action: "edit" }) : actionUrl(title.full, { action: "edit", oldid: rev.id });
  const editText = canEdit(ctx, title) ? "edit" : "view source";
  return [
    `<div id="mw-diff-${side}title1"><strong><a href="${esc(actionUrl(title.full, { oldid: rev.id }))}" title="${esc(title.full)}">${label} ${formatDateTime(rev.ts)}</a> <span class="mw-diff-edit"><a href="${esc(edit)}" title="${esc(title.full)}">${editText}</a></span><span class="mw-diff-timestamp" data-timestamp="${isoSeconds(rev.ts)}"></span></strong></div>`,
    `<div id="mw-diff-${side}title2">${userWithTools(ctx.wiki, rev.user, rev.id)}<div class="mw-diff-usermetadata"><div class="mw-diff-userroles"></div><div class="mw-diff-usereditcount"><span>${formatNumber(ctx.wiki.revisions.filter((r) => r.user === rev.user).length)}</span> edits</div></div></div>`,
    `<div id="mw-diff-${side}title3">${rev.minor ? '<abbr class="minoredit" title="This is a minor edit">m</abbr>' : ""} ${rev.summary ? comment(ctx.wiki, rev.summary, title.full, false).trimStart() : ""}</div>`,
    `<div id="mw-diff-${side}title5"></div>`,
    `<div id="mw-diff-${side}title4">${nav}</div>`,
  ].join("");
}

export function diffView(ctx: Context, title: Title, query: Query): ViewProps {
  const page = ctx.wiki.pages.get(title.full);
  const byId = (id: number) => (ctx.wiki.revisions[id - 1]?.page === title.full ? ctx.wiki.revisions[id - 1] : undefined);
  const revs = page?.revs ?? [];
  const at = (rev?: Revision) => (rev ? revs.indexOf(rev) : -1);
  let oldRev = byId(Number(query.oldid));
  let newRev: Revision | undefined;
  if (query.diff === "prev") {
    newRev = oldRev;
    oldRev = revs[at(newRev) - 1];
  } else if (query.diff === "next") newRev = revs[at(oldRev) + 1];
  else if (query.diff === "cur" || query.diff === "0") newRev = revs.at(-1);
  else newRev = byId(Number(query.diff)) ?? revs.at(-1);
  if (oldRev && newRev && oldRev.id > newRev.id) [oldRev, newRev] = [newRev, oldRev];
  const latest = revs.at(-1);
  if (!newRev || !latest) return pageProps(ctx, title, "view", { heading: `${esc(title.full)}: Difference between revisions`, content: `<p>The revision could not be found.</p>` });
  const a = (query: Record<string, string | number>, attrs: string, text: string) =>
    `<a href="${esc(actionUrl(title.full, query))}" ${attrs} title="${esc(title.full)}">${text}</a>`;
  const hasOlder = !!oldRev && at(oldRev) > 0;
  const hasNewer = newRev !== latest;
  const older = (attrs: string) => (hasOlder ? a({ diff: "prev", oldid: oldRev!.id }, attrs, "← Older edit") : "");
  const newer = (attrs: string) => (hasNewer ? a({ diff: "next", oldid: newRev!.id }, attrs, "Newer edit →") : "");
  const olderNav = older('id="differences-prevlink"');
  const newerNav = newer('id="differences-nextlink"') || " ";
  const header = `<div class="mw-diff-revision-history-links">${older('class="mw-diff-revision-history-link-previous"')}${newer('class="mw-diff-revision-history-link-next"')}</div>`;
  const rows = diffRows(oldRev?.text ?? "", newRev.text);
  const table = [
    `<div class="mw-diff-table-prefix" dir="ltr" lang="en"><div></div></div><table class="diff diff-type-table diff-contentalign-left diff-editfont-monospace" data-mw="interface">`,
    `<col class="diff-marker" />\n<col class="diff-content" />\n<col class="diff-marker" />\n<col class="diff-content" />`,
    `<tr class="diff-title" lang="en">`,
    oldRev ? `<td colspan="2" class="diff-otitle diff-side-deleted">${diffSide(ctx, title, oldRev, "o", latest, olderNav)}</td>` : `<td colspan="2" class="diff-otitle diff-side-deleted"></td>`,
    `<td colspan="2" class="diff-ntitle diff-side-added">${diffSide(ctx, title, newRev, "n", latest, newerNav)}</td>`,
    `</tr>${rows}</table>`,
  ].join("\n");
  const rendered = renderRevision(ctx.wiki, ctx.version, newRev, false);
  const preview = `<hr class="diff-hr" id="mw-oldid" /><h2 class="diff-currentversion-title">${newRev === latest ? "Latest revision" : `Revision as of ${formatDateTime(newRev.ts)}`}</h2>${rendered.html}`;
  return pageProps(ctx, title, "view", {
    heading: `${esc(title.full)}: Difference between revisions`,
    docTitle: docTitle(`${title.full}: Difference between revisions`),
    content: header + table + preview,
    siteSub: true,
    lastmod: latest.ts,
    catlinks: "",
  });
}

export function infoView(ctx: Context, title: Title): ViewProps {
  const page = ctx.wiki.pages.get(title.full);
  const row = (id: string, label: string, value: string) => `<tr${id ? ` id="${id}"` : ""} style="vertical-align: top;"><td>${label}</td><td>${value}</td></tr>`;
  const table = (rows: string[]) => `<table class="wikitable mw-page-info">\n${rows.join("\n")}\n</table>`;
  const h2 = (id: string, header: string, text: string) => `<h2 id="${id}"><span id="mw-pageinfo-header-${header}"></span>${text}</h2>`;
  if (!page) return pageProps(ctx, title, "info", { heading: `Information for "${esc(title.full)}"`, content: `<p>This page does not exist.</p>` });
  const revs = page.revs;
  const first = revs[0];
  const latest = revs.at(-1)!;
  const rendered = renderRevision(ctx.wiki, ctx.version, latest, false);
  const recent = revs.filter((r) => r.ts > Date.now() - 90 * 86400_000);
  const redirects = [...ctx.wiki.pages.values()].filter((p) => renderRevision(ctx.wiki, ctx.version, p.revs.at(-1)!, false).redirect?.full === title.full).length;
  const at = (rev: Revision) => `<a href="${esc(actionUrl(title.full, { oldid: rev.id }))}" title="${esc(title.full)}">${formatDateTime(rev.ts)}</a>`;
  const prefix = `${title.full}/`;
  const subpages = [...ctx.wiki.pages.keys()].filter((k) => k.startsWith(prefix)).length;
  const magic = [...latest.text.matchAll(/__[A-Z]+__/g)].map((m) => m[0]);
  const content = [
    h2("Basic_information", "basic", "Basic information"),
    table([
      row("mw-pageinfo-display-title", "Display title", esc(title.full)),
      row("mw-pageinfo-default-sort", "Default sort key", esc(rendered.sortKey ?? title.text)),
      row("mw-pageinfo-length", "Page length (in bytes)", formatNumber(byteLength(latest.text))),
      row("mw-pageinfo-namespace-id", "Namespace ID", String(title.ns)),
      row("", "Page content language", "en - English"),
      row("mw-pageinfo-content-model", "Page content model", "wikitext"),
      row("mw-pageinfo-robot-policy", "Indexing by robots", "Allowed"),
      row("", `<a href="${esc(`/index.php?title=Special:WhatLinksHere/${title.full.replace(/ /g, "_")}&hidelinks=1&hidetrans=1`)}" title="Special:WhatLinksHere/${esc(title.full)}">Number of redirects to this page</a>`, String(redirects)),
      row("mw-pageinfo-contentpage", "Counted as a content page", title.ns === 0 && !rendered.redirect && latest.text.includes("[[") ? "Yes" : "No"),
      row("", `<a href="/wiki/Special:PrefixIndex/${esc(prefix.replace(/ /g, "_"))}" title="Special:PrefixIndex/${esc(prefix)}">Number of subpages of this page</a>`, `${subpages} (0 redirects; ${subpages} non-redirects)`),
    ]),
    h2("Edit_history", "edits", "Edit history"),
    table([
      row("mw-pageinfo-firstuser", "Page creator", userWithTools(ctx.wiki, first.user, first.id)),
      row("mw-pageinfo-firsttime", "Date of page creation", at(first)),
      row("mw-pageinfo-lastuser", "Latest editor", userWithTools(ctx.wiki, latest.user, latest.id)),
      row("mw-pageinfo-lasttime", "Date of latest edit", at(latest)),
      row("mw-pageinfo-edits", "Total number of edits", formatNumber(revs.length)),
      row("mw-pageinfo-authors", "Total number of distinct authors", formatNumber(new Set(revs.map((r) => r.user)).size)),
      row("mw-pageinfo-recent-edits", "Recent number of edits (within past 90 days)", formatNumber(recent.length)),
      row("mw-pageinfo-recent-authors", "Recent number of distinct authors", formatNumber(new Set(recent.map((r) => r.user)).size)),
    ]),
    magic.length ? h2("Page_properties", "properties", "Page properties") + table([row("mw-pageinfo-magic-words", `Magic word (${magic.length})`, `<ul>${magic.map((m) => `<li>${m}</li>`).join("")}</ul>`)]) : "",
  ].join("\n");
  return pageProps(ctx, title, "info", { heading: `Information for "${esc(title.full)}"`, docTitle: docTitle(`Information for "${title.full}"`), content });
}
