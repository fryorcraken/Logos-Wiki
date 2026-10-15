import { MAIN_PAGE } from "@/lib/config.ts";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format.ts";
import type { Revision } from "@/lib/state.ts";
import { actionUrl, encodeTitle, makeTitle, pageUrl, parseTitle, type Title } from "@/lib/title.ts";
import type { Context } from "@/server/context.ts";
import { catlinks, comment, esc, link, subpages, titleHeading, userWithTools } from "@/server/html.ts";
import { renderRevision, siteIndex, type Member } from "@/server/site.ts";
import { canEdit, pageProps, type Query, type ViewProps } from "./common.ts";

const HELP = "https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Categories";

function noArticle(ctx: Context, title: Title) {
  const key = encodeTitle(title.full);
  const search = `<a href="/wiki/Special:Search/${key}" title="Special:Search/${esc(title.full)}">search for this page title</a>`;
  const logs = `<span class="plainlinks"><a rel="nofollow" class="external text" href="${esc(`${ctx.origin}/index.php?title=Special:Log&page=${key}`)}">search the related logs</a></span>`;
  const tail = canEdit(ctx, title)
    ? `${logs}, or <a href="${esc(actionUrl(title.full, { action: "edit" }))}" class="external text">create this page</a>`
    : `${logs}, but you do not have permission to create this page`;
  return `<div class="noarticletext mw-content-ltr" dir="ltr" lang="en">\n<p>There is currently no text in this page.\nYou can ${search} in other pages, or ${tail}.\n</p>\n</div>`;
}

function revisionNav(ctx: Context, title: Title, rev: Revision) {
  const revs = ctx.wiki.pages.get(title.full)!.revs;
  const index = revs.findIndex((r) => r.id === rev.id);
  const isLatest = index === revs.length - 1;
  const a = (query: Record<string, string | number>, text: string) => `<a href="${esc(actionUrl(title.full, query))}" title="${esc(title.full)}">${text}</a>`;
  const older = index > 0 ? `(${a({ diff: "prev", oldid: rev.id }, "diff")}) ${a({ direction: "prev", oldid: rev.id }, "← Older revision")}` : "(diff) ← Older revision";
  const latest = isLatest ? "Latest revision (diff)" : `${a({ oldid: revs.at(-1)!.id }, "Latest revision")} (${a({ diff: "cur", oldid: rev.id }, "diff")})`;
  const newer = isLatest ? "Newer revision → (diff)" : `${a({ direction: "next", oldid: rev.id }, "Newer revision →")} (${a({ diff: "next", oldid: rev.id }, "diff")})`;
  const label = isLatest ? "Latest revision as of" : "Revision as of";
  const info = `${label} ${formatDateTime(rev.ts)} by ${userWithTools(ctx.wiki, rev.user, rev.id)}${comment(ctx.wiki, rev.summary, title.full)}`;
  return `<div class="mw-message-box cdx-message cdx-message--block mw-message-box-warning cdx-message--warning mw-revision"><span class="cdx-message__icon"></span><div class="cdx-message__content"><div id="mw-revision-info">${info}</div><div id="mw-revision-nav">${older} | ${latest} | ${newer}</div></div></div>`;
}

const sortKeyOf = (m: Member) => m.sortKey.toUpperCase();

function columns(ctx: Context, members: Member[], label: (m: Member) => string) {
  const sorted = [...members].sort((x, y) => (sortKeyOf(x) < sortKeyOf(y) ? -1 : sortKeyOf(x) > sortKeyOf(y) ? 1 : 0));
  const groups = new Map<string, string[]>();
  for (const member of sorted) {
    const letter = [...sortKeyOf(member)][0] ?? " ";
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(`<li>${link(ctx.wiki, member.page, esc(label(member)))}</li>`);
  }
  const html = [...groups].map(([letter, items]) => `<div class="mw-category-group"><h3>${esc(letter)}</h3>\n<ul>${items.join("\n")}</ul></div>`).join("");
  return `<div lang="en" dir="ltr" class="mw-content-ltr"><div class="mw-category${members.length > 6 ? " mw-category-columns" : ""}">${html}</div></div>`;
}

function categoryListing(ctx: Context, title: Title) {
  const members = siteIndex(ctx.wiki, ctx.version).categories.get(title.text) ?? [];
  const subcats = members.filter((m) => m.page.startsWith("Category:"));
  const pages = members.filter((m) => !m.page.startsWith("Category:"));
  if (!members.length) return `<div class="mw-category-generated" lang="en" dir="ltr"><p><i>This category currently contains no pages or media.</i>\n</p></div>`;
  let html = "";
  if (subcats.length) {
    const n = subcats.length;
    const intro = n === 1 ? "This category has only the following subcategory." : `This category has the following ${n} subcategories, out of ${n} total.`;
    html += `<div id="mw-subcategories">\n<h2>Subcategories</h2>\n<p>${intro}\n</p>${columns(ctx, subcats, (m) => m.page.slice(9))}\n</div>`;
  }
  if (pages.length) {
    const n = pages.length;
    const intro = n === 1 ? "This category contains only the following page." : `The following ${formatNumber(n)} pages are in this category, out of ${formatNumber(n)} total.`;
    html += `<div id="mw-pages">\n<h2>Pages in category "${esc(title.text)}"</h2>\n<p>${intro}\n</p>${columns(ctx, pages, (m) => m.page)}\n</div>`;
  }
  return `<div class="mw-category-generated" lang="en" dir="ltr">${html}</div>`;
}

function fileSection(ctx: Context, title: Title, body: string) {
  const file = ctx.wiki.files.get(title.text);
  if (!file) return body;
  const src = `/files/${encodeURIComponent(file.name)}`;
  const thumbHeight = Math.max(1, Math.round((file.height * 120) / file.width));
  const when = formatDateTime(file.ts);
  const users = siteIndex(ctx.wiki, ctx.version).links.get(title.full) ?? new Set();
  const usage = users.size
    ? `<p>The following ${users.size === 1 ? "page uses" : `${users.size} pages use`} this file:\n</p><ul class="mw-imagepage-linkstoimage">${[...users].sort().map((p) => `<li class="mw-imagepage-linkstoimage-ns${parseTitle(p)?.ns ?? 0}">${link(ctx.wiki, p)}</li>`).join("\n")}</ul>`
    : `<p>There are no pages that use this file.\n</p>`;
  return [
    `<ul id="filetoc" role="navigation"><li><a href="#file">File</a></li>\n<li><a href="#filehistory">File history</a></li>\n<li><a href="#filelinks">File usage</a></li></ul>`,
    `<div class="fullImageLink" id="file"><a href="${src}"><img alt="${esc(title.full)}" src="${src}" decoding="async" width="${file.width}" height="${file.height}" /></a><div class="mw-filepage-resolutioninfo">No higher resolution available.</div></div>`,
    `<div class="mw-content-ltr fullMedia" lang="en" dir="ltr"><p><a href="${src}" class="internal" title="${esc(file.name)}">${esc(file.name)}</a> &#8206;<span class="fileInfo">(${file.width} × ${file.height} pixels, file size: ${formatBytes(file.size)}, MIME type: <span class="mime-type">${file.mime}</span>)</span>\n</p></div>`,
    `<div id="mw-imagepage-content">${body}</div>`,
    `<h2 id="filehistory">File history</h2>\n<div id="mw-imagepage-section-filehistory">\n<p>Click on a date/time to view the file as it appeared at that time.\n</p>\n<table class="wikitable filehistory">\n<tr><th></th><th>Date/Time</th><th>Thumbnail</th><th>Dimensions</th><th>User</th><th>Comment</th></tr>\n<tr><td>current</td><td class="filehistory-selected" style="white-space: nowrap;"><a href="${src}">${when}</a></td><td><a href="${src}"><img alt="Thumbnail for version as of ${when}" src="${src}" decoding="async" loading="lazy" width="120" height="${thumbHeight}" /></a></td><td>${file.width} × ${file.height} <span style="white-space: nowrap;">(${formatBytes(file.size)})</span></td><td>${userWithTools(ctx.wiki, file.user).replace(" <span", '<span style="white-space: nowrap;"> <span')}</span></td><td dir="ltr"></td></tr>\n</table>\n</div>`,
    `<div class="mw-imagepage-upload-links"><p id="mw-imagepage-upload-disallowed">You cannot overwrite this file.</p></div><h2 id="filelinks">File usage</h2>\n<div id="mw-imagepage-section-linkstoimage">\n${usage}\n</div>`,
  ].join("\n");
}

function redirectTarget(ctx: Context, rev: Revision) {
  const out = renderRevision(ctx.wiki, ctx.version, rev, false);
  return out.redirect && ctx.wiki.pages.has(out.redirect.full) ? out.redirect : null;
}

function resolveOldid(ctx: Context, query: Query) {
  const id = Number(query.oldid) || 0;
  const rev = ctx.wiki.revisions[id - 1];
  if (!rev || (query.direction !== "prev" && query.direction !== "next")) return id;
  const revs = ctx.wiki.pages.get(rev.page)!.revs;
  const next = revs[revs.indexOf(rev) + (query.direction === "prev" ? -1 : 1)];
  return next?.id ?? id;
}

export function articleView(ctx: Context, requested: Title, query: Query): ViewProps {
  const oldid = resolveOldid(ctx, query);
  let title = requested;
  let rev = oldid ? ctx.wiki.revisions[oldid - 1] : ctx.wiki.latest(title.full);
  if (rev && oldid) title = parseTitle(rev.page)!;
  let redirectedFrom: Title | null = null;
  if (rev && !oldid && query.redirect !== "no") {
    const target = redirectTarget(ctx, rev);
    if (target) {
      redirectedFrom = title;
      title = makeTitle(target.ns, target.text);
      rev = ctx.wiki.latest(title.full)!;
    }
  }
  const isCategory = title.ns === 14;
  const editable = canEdit(ctx, title);
  const out = rev ? renderRevision(ctx.wiki, ctx.version, rev, editable && !oldid) : null;
  let content = out ? out.html : title.ns === 6 && ctx.wiki.files.has(title.text) ? "" : noArticle(ctx, title);
  if (isCategory) content += categoryListing(ctx, title);
  if (title.ns === 6) content = fileSection(ctx, title, content);
  const subtitle = [
    subpages(ctx.wiki, title),
    redirectedFrom ? `<span class="mw-redirectedfrom">(Redirected from <a href="${esc(actionUrl(redirectedFrom.full, { redirect: "no" }))}" class="mw-redirect" title="${esc(redirectedFrom.full)}">${esc(redirectedFrom.full)}</a>)</span>` : "",
    rev && oldid ? revisionNav(ctx, title, rev) : "",
  ].join("");
  const props = pageProps(ctx, title, "view", {
    heading: titleHeading(title),
    content,
    subtitle,
    siteSub: true,
    mainPage: title.full === MAIN_PAGE,
    indicators: isCategory ? `<div id="mw-indicator-mw-helplink" class="mw-indicator"><a href="${HELP}" target="_blank" class="mw-helplink">Help</a></div>` : "",
    lastmod: rev?.ts,
    toc: out?.toc && out.headings.length >= 4 ? out.headings : [],
    catlinks: out ? catlinks(ctx.wiki, out.categories) : "",
  });
  if (!rev) delete props.lastmod;
  if (redirectedFrom) props.printPath = pageUrl(title.full);
  return props;
}
