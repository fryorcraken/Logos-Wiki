import type { Revision, Wiki } from "../lib/state.ts";
import { parseTitle, type Title } from "../lib/title.ts";
import { render, type Rendered } from "../lib/wikitext/index.ts";
import { SPECIAL_PAGES } from "./special-names.ts";

export type Member = { page: string; sortKey: string };
type Index = { version: number; categories: Map<string, Member[]>; links: Map<string, Set<string>>; transclusions: Map<string, Set<string>> };

const renders = new Map<string, Rendered>();
let index: Index | null = null;

export function pageExists(wiki: Wiki, full: string) {
  if (wiki.pages.has(full)) return true;
  const title = parseTitle(full);
  if (title?.ns === -1) return SPECIAL_PAGES.has(title.text.split("/")[0]);
  return title?.ns === 6 && wiki.files.has(title.text);
}

export function renderText(wiki: Wiki, title: Title, text: string, editable = false) {
  const used = new Set<string>();
  const rendered = render(text, {
    title,
    exists: (full) => pageExists(wiki, full),
    template: (full) => {
      used.add(full);
      return wiki.latest(full)?.text ?? null;
    },
    file: (name) => wiki.files.get(name) ?? null,
    stats: wiki.stats(),
    editable,
  });
  return { ...rendered, templates: used };
}

export function renderRevision(wiki: Wiki, version: number, rev: Revision, editable: boolean) {
  const key = `${version}:${rev.id}:${editable}`;
  let hit = renders.get(key);
  if (!hit) {
    if (renders.size > 500) renders.clear();
    hit = renderText(wiki, parseTitle(rev.page)!, rev.text, editable);
    renders.set(key, hit);
  }
  return hit as ReturnType<typeof renderText>;
}

export function siteIndex(wiki: Wiki, version: number) {
  if (index?.version === version) return index;
  const next: Index = { version, categories: new Map(), links: new Map(), transclusions: new Map() };
  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(value);
  };
  for (const page of wiki.pages.values()) {
    const rev = page.revs.at(-1)!;
    const out = renderRevision(wiki, version, rev, false);
    const sortKey = out.sortKey ?? page.title.text;
    for (const { name, sortKey: key } of out.categories) {
      if (!next.categories.has(name)) next.categories.set(name, []);
      next.categories.get(name)!.push({ page: page.title.full, sortKey: key ?? sortKey });
    }
    for (const target of out.links) add(next.links, target, page.title.full);
    if (out.redirect) add(next.links, out.redirect.full, page.title.full);
    for (const target of out.templates) add(next.transclusions, target, page.title.full);
  }
  index = next;
  return next;
}
