import type { Item } from "@/components/vector.tsx";
import { MAIN_PAGE } from "@/lib/config.ts";
import type { Wiki } from "@/lib/state.ts";
import { actionUrl, encodeTitle, makeTitle, pageUrl, subjectNs, talkNs, type Title } from "@/lib/title.ts";

export type Action = "view" | "edit" | "history" | "info" | "special";

const SUBJECT: Record<number, [string, string, string]> = {
  0: ["main", "Page", "content page"],
  2: ["user", "User page", "user page"],
  4: ["project", "Project page", "project page"],
  6: ["image", "File", "file page"],
  8: ["mediawiki", "Message", "system message"],
  10: ["template", "Template", "template"],
  12: ["help", "Help page", "help page"],
  14: ["category", "Category", "category page"],
};

function tab(id: string, text: string, href: string, selected: boolean, extra: Partial<Item> = {}): Item {
  return { id, text, href, className: `${selected ? "selected " : ""}vector-tab-noicon`, ...extra };
}

const missing = (exists: boolean, title: string) => (exists ? title : `${title} (page does not exist)`);

export function namespaceTabs(wiki: Wiki, title: Title): Item[] {
  const subject = makeTitle(subjectNs(title.ns), title.text);
  const talk = makeTitle(talkNs(title.ns), title.text);
  const [key, label, noun] = SUBJECT[subject.ns] ?? SUBJECT[0];
  const onTalk = title.ns !== subject.ns;
  const href = (t: Title) => (wiki.pages.has(t.full) || (t.ns === 6 && wiki.files.has(t.text)) ? pageUrl(t.full) : actionUrl(t.full, { action: "edit", redlink: 1 }));
  const subjectExists = wiki.pages.has(subject.full);
  const talkExists = wiki.pages.has(talk.full);
  const newClass = (exists: boolean, selected: boolean) => (exists || selected ? "" : "new ");
  const subjectTab = tab(`ca-nstab-${key}`, subject.full === MAIN_PAGE ? MAIN_PAGE : label, href(subject), !onTalk, {
    title: `${missing(subjectExists || !onTalk, `View the ${noun}`)} [c]`,
    accessKey: "c",
  });
  subjectTab.className = newClass(subjectExists, !onTalk) + subjectTab.className;
  const talkTab = tab("ca-talk", "Discussion", href(talk), onTalk, {
    title: `${missing(talkExists || onTalk, "Discussion about the content page")} [t]`,
    accessKey: "t",
    rel: "discussion",
  });
  talkTab.className = newClass(talkExists, onTalk) + talkTab.className;
  return [subjectTab, talkTab];
}

export function viewTabs(wiki: Wiki, title: Title, action: Action, canEdit: boolean): Item[] {
  const exists = wiki.pages.has(title.full);
  const tabs: Item[] = [];
  if (exists) tabs.push(tab("ca-view", "Read", pageUrl(title.full), action === "view"));
  if (canEdit) {
    const text = exists ? "Edit" : "Create";
    tabs.push(tab("ca-edit", text, actionUrl(title.full, { action: "edit" }), action === "edit", { title: `${exists ? "Edit" : "Create"} this page [e]`, accessKey: "e" }));
  } else if (exists) {
    tabs.push(tab("ca-viewsource", "View source", actionUrl(title.full, { action: "edit" }), action === "edit", { title: "This page is protected.\nYou can view its source [e]", accessKey: "e" }));
  }
  if (exists) tabs.push(tab("ca-history", "View history", actionUrl(title.full, { action: "history" }), action === "history", { title: "Past revisions of this page [h]", accessKey: "h" }));
  return tabs;
}

export const SPECIAL_TOOLS: Item[] = [
  { id: "t-specialpages", text: "Special pages", href: "/wiki/Special:SpecialPages", title: "A list of all special pages [q]", accessKey: "q" },
  { id: "t-print", text: "Printable version", href: "#print", rel: "alternate", title: "Printable version of this page [p]", accessKey: "p" },
];

export function pageTools(wiki: Wiki, title: Title, revid?: number): Item[] {
  const key = encodeTitle(title.full);
  const tools: Item[] = [
    { id: "t-whatlinkshere", text: "What links here", href: `/wiki/Special:WhatLinksHere/${key}`, title: "A list of all wiki pages that link here [j]", accessKey: "j" },
    { id: "t-recentchangeslinked", text: "Related changes", href: `/wiki/Special:RecentChangesLinked/${key}`, rel: "nofollow", title: "Recent changes in pages linked from this page [k]", accessKey: "k" },
  ];
  if (title.ns === 2 || title.ns === 3) {
    const user = title.text.split("/")[0];
    if (wiki.accounts.has(user) || wiki.reserved.has(user)) {
      tools.push({ id: "t-contributions", text: "User contributions", href: `/wiki/Special:Contributions/${encodeTitle(user)}`, title: "A list of contributions by this user" });
    }
  }
  tools.push(...SPECIAL_TOOLS);
  if (revid) {
    tools.push(
      { id: "t-permalink", text: "Permanent link", href: actionUrl(title.full, { oldid: revid }), title: "Permanent link to this revision of this page" },
      { id: "t-info", text: "Page information", href: actionUrl(title.full, { action: "info" }), title: "More information about this page" },
    );
  }
  return tools;
}
