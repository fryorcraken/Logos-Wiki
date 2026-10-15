import { SITENAME } from "../config.ts";
import { actionUrl, NAMESPACES, parseTitle, type Title } from "../title.ts";
import { doBlockLevels, doHeadings, doTables, formatHeadings, type Heading } from "./blocks.ts";
import { doQuotes, externalLinks, internalLinks, linkHtml, type LinkContext } from "./inline.ts";
import { expandTemplates, viewSource, type Meta } from "./preprocess.ts";
import { balanceTags, escapeHtml, fixAmpersands, sanitizeAttrs, sanitizeTags } from "./sanitize.ts";

export type RenderContext = {
  title: Title;
  exists(full: string): boolean;
  template(full: string): string | null;
  file(name: string): { width: number; height: number } | null;
  stats: { articles: number; pages: number; edits: number; users: number };
  editable?: boolean;
};

export type Rendered = {
  html: string;
  categories: { name: string; sortKey?: string }[];
  headings: Heading[];
  links: Set<string>;
  redirect: Title | null;
  sortKey?: string;
  toc: boolean;
};

const SWITCHES = /__(NOTOC|FORCETOC|TOC|NOEDITSECTION|NOGALLERY|NOTITLECONVERT|NOTC|NOCONTENTCONVERT|NOCC|INDEX|NOINDEX|STATICREDIRECT|HIDDENCAT|NEWSECTIONLINK|NONEWSECTIONLINK)__/g;

function strip(text: string, store: string[]) {
  const keep = (kind: string, html: string) => `\x7fUNIQ-${kind}-${store.push(html) - 1}\x7f`;
  return text
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/<nowiki\s*>([\s\S]*?)<\/nowiki\s*>/gi, (_, s: string) => keep("nowiki", fixAmpersands(s.replace(/</g, "&lt;").replace(/>/g, "&gt;"))))
    .replace(/<nowiki\s*\/>/gi, "")
    .replace(/<pre(\s[^>]*)?>([\s\S]*?)<\/pre\s*>/gi, (_, attrs = "", s: string) =>
      keep("pre", `<pre${sanitizeAttrs(attrs)}>${fixAmpersands(s.replace(/^\n/, "").replace(/</g, "&lt;").replace(/>/g, "&gt;"))}</pre>`),
    );
}

const CODE_PAGE = /\.(css|js|json)$/;

export const isCodePage = (title: Title) => (title.ns === 8 || title.ns === 2) && CODE_PAGE.test(title.text);

function codeHtml(source: string, title: Title) {
  const lang = CODE_PAGE.exec(title.text)![1];
  return `<pre class="mw-code mw-${lang === "js" ? "js" : lang}" dir="ltr">\n${escapeHtml(source)}\n</pre>`;
}

function redirectHtml(target: Title, link: LinkContext) {
  return `<div class="redirectMsg"><p>Redirect to:</p><ul class="redirectText"><li>${linkHtml(target, escapeHtml(target.full), link)}</li></ul></div>`;
}

const unstrip = (text: string, store: string[]) => text.replace(/\x7fUNIQ-\w+-(\d+)\x7f/g, (_, i) => store[Number(i)]);

function variables(ctx: RenderContext): Record<string, string> {
  const { title, stats } = ctx;
  const slash = title.text.lastIndexOf("/");
  return {
    PAGENAME: title.text,
    FULLPAGENAME: title.full,
    NAMESPACE: NAMESPACES[title.ns],
    BASEPAGENAME: slash > 0 ? title.text.slice(0, slash) : title.text,
    SUBPAGENAME: slash > 0 ? title.text.slice(slash + 1) : title.text,
    ROOTPAGENAME: title.text.split("/")[0],
    SITENAME,
    NUMBEROFARTICLES: stats.articles.toLocaleString("en"),
    NUMBEROFPAGES: stats.pages.toLocaleString("en"),
    NUMBEROFEDITS: stats.edits.toLocaleString("en"),
    NUMBEROFUSERS: stats.users.toLocaleString("en"),
  };
}

function editSection(ctx: RenderContext) {
  if (!ctx.editable) return undefined;
  return (section: number, text: string) => {
    const href = escapeHtml(actionUrl(ctx.title.full, { action: "edit", section }));
    return `<span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="${href}" title="Edit section: ${escapeHtml(text)}"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span>`;
  };
}

const wrap = (html: string) => `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr">${html}</div>`;

export function render(source: string, ctx: RenderContext): Rendered {
  const link: LinkContext = { title: ctx.title, exists: ctx.exists, file: ctx.file, categories: [], links: new Set() };
  const result = { categories: link.categories, headings: [], links: link.links, redirect: null, toc: false };
  if (isCodePage(ctx.title)) return { ...result, html: wrap(codeHtml(source, ctx.title)) };
  const redirectMatch = /^\s*#REDIRECT\s*:?\s*\[\[([^\]|]+)/i.exec(source);
  const redirect = redirectMatch ? parseTitle(redirectMatch[1]) : null;
  if (redirect) return { ...result, redirect, html: wrap(redirectHtml(redirect, link)) };
  const store: string[] = [];
  const meta: Meta = {};
  const vars = variables(ctx);
  let text = strip(viewSource(source), store);
  const template = (full: string) => {
    const src = ctx.template(full);
    return src === null ? null : strip(src, store);
  };
  text = expandTemplates(text, { title: ctx.title, template, variable: (n) => vars[n] }, meta);
  const toc = !/__NOTOC__/.test(text);
  const noEdit = /__NOEDITSECTION__/.test(text);
  text = text.replace(SWITCHES, "");
  text = fixAmpersands(sanitizeTags(text));
  text = doTables(text);
  text = text.replace(/^-{4,}/gm, "<hr />");
  text = doHeadings(text);
  text = text.split("\n").map(doQuotes).join("\n");
  text = internalLinks(text, link);
  text = externalLinks(text);
  text = doBlockLevels(text);
  const headings: Heading[] = [];
  text = formatHeadings(text, headings, noEdit ? undefined : editSection(ctx));
  text = balanceTags(unstrip(text, store));
  return { ...result, html: wrap(text), headings, sortKey: meta.sortKey, toc };
}
