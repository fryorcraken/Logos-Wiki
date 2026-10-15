import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CreateAccountForm, LoginForm, LogoutForm } from "@/components/account.tsx";
import { TrustedEditorsForm, UploadForm } from "@/components/admin.tsx";
import { Editor } from "@/components/editor.tsx";
import { Skin } from "@/components/skin.tsx";
import { MAIN_PAGE, SITENAME } from "@/lib/config.ts";
import { encodeTitle, parseTitle, type Title } from "@/lib/title.ts";
import { context, type Context } from "@/server/context.ts";
import { esc, helpIndicator, link, userLink } from "@/server/html.ts";
import { renderRevision } from "@/server/site.ts";
import { canonicalSpecial, SPECIAL_TITLES } from "@/server/special-names.ts";
import { diffView, editView, historyView, infoView } from "./actions.ts";
import { articleView } from "./article.ts";
import { finish, specialProps, type Query, type ViewProps } from "./common.ts";
import { contributions, log, recentChanges, recentChangesLinked } from "./special/changes.ts";
import * as lists from "./special/lists.ts";

type Outcome = ViewProps & { children?: ReactNode };
type SpecialView = (ctx: Context, sub: string, query: Query) => Outcome | { redirect: string };

const RECENT_DAYS = 30 * 86_400_000;
const HELP: Record<string, string> = {
  Categories: "Categories",
  Contributions: "User_contributions",
  RecentChanges: "Recent_changes",
  Search: "Searching",
  SpecialPages: "Special_pages",
  WhatLinksHere: "What_links_here",
};

function interfaceText(ctx: Context, name: string) {
  const rev = ctx.wiki.latest(`MediaWiki:${name}`);
  return rev ? renderRevision(ctx.wiki, ctx.version, rev, false).html : "";
}

function login(ctx: Context, _sub: string, query: Query): Outcome {
  const returnto = query.returnto ?? "";
  if (ctx.viewer) return specialProps("Log in", `<p>You are already logged in as ${userLink(ctx.wiki, ctx.viewer.name)}.</p>`);
  return { ...specialProps("Log in", "", { restricted: true }), children: <LoginForm prompt={interfaceText(ctx, "Loginprompt")} sitename={SITENAME} returnto={returnto} /> };
}

function createAccount(ctx: Context, _sub: string, query: Query): Outcome {
  const since = Date.now() - RECENT_DAYS;
  const recent = new Set(ctx.wiki.revisions.filter((r) => r.ts > since).map((r) => r.user)).size;
  const { edits, articles } = ctx.wiki.stats();
  return { ...specialProps("Create account", "", { restricted: true }), children: <CreateAccountForm sitename={SITENAME} returnto={query.returnto ?? ""} stats={{ edits, articles, recent }} /> };
}

function logout(_ctx: Context, _sub: string, query: Query): Outcome {
  return { ...specialProps("Log out", ""), children: <LogoutForm returnto={query.returnto ?? ""} /> };
}

function trustedEditors(ctx: Context): Outcome {
  const { wiki } = ctx;
  const items = wiki.trusted.map((name) => `<li>${userLink(wiki, name)}</li>`).join("");
  const content = `<p>Trusted editors can edit every page except those in the MediaWiki namespace, and can upload files. Other registered users can edit their own user and user talk pages. Only the administrator can change this list.\n</p>${items ? `<ul>${items}</ul>` : "<p><i>There are no trusted editors yet.</i></p>"}`;
  const isAdmin = ctx.viewer?.key === wiki.admin;
  return { ...specialProps("Trusted editors", content), children: isAdmin ? <TrustedEditorsForm editors={wiki.trusted} /> : undefined };
}

function upload(ctx: Context): Outcome {
  if (!ctx.viewer) return specialProps("Login required", `<p>Please <a href="/index.php?title=Special:UserLogin&amp;returnto=Special%3AUpload">log in</a> to upload files.\n</p>`);
  if (!ctx.wiki.canUpload(ctx.viewer.key)) {
    return specialProps("Permission error", `<p>You do not have permission to upload this file, for the following reason:\n</p><div class="permissions-errors">\n<p>The action you have requested is limited to users in the group: <a href="/wiki/Special:TrustedEditors" title="Special:TrustedEditors">Trusted editors</a>.\n</p>\n</div>`);
  }
  const intro = `<div id="uploadtext"><p>Use the form below to upload files.\nTo view or search previously uploaded files go to the <a href="/wiki/Special:ListFiles" title="Special:ListFiles">list of uploaded files</a>.\n</p><p>To include a file in a page, use a link in the form <code>[[File:File.jpg]]</code>.\n</p></div>`;
  return { ...specialProps("Upload file", intro), children: <UploadForm /> };
}

function random(ctx: Context) {
  const pages = [...ctx.wiki.pages.values()].filter((p) => p.title.ns === 0);
  const page = pages[Math.floor(Math.random() * pages.length)];
  return { redirect: `/wiki/${encodeTitle(page?.title.full ?? MAIN_PAGE)}` };
}

const SPECIALS: Record<string, SpecialView> = {
  AllPages: lists.allPages,
  Categories: lists.categories,
  Contributions: contributions,
  CreateAccount: createAccount,
  ListFiles: lists.listFiles,
  ListUsers: lists.listUsers,
  Log: log,
  PrefixIndex: lists.prefixIndex,
  Random: random,
  RecentChanges: recentChanges,
  RecentChangesLinked: recentChangesLinked,
  Search: lists.search,
  SpecialPages: lists.specialPages,
  TrustedEditors: trustedEditors,
  Upload: upload,
  UserLogin: login,
  UserLogout: logout,
  WhatLinksHere: lists.whatLinksHere,
};

function special(ctx: Context, title: Title, query: Query) {
  const [name, ...rest] = title.text.split("/");
  const canonical = canonicalSpecial(name);
  if (!canonical) {
    return specialProps("No such special page", `<p>You have requested an invalid special page.\n</p><p>A list of valid special pages can be found at ${link(ctx.wiki, "Special:SpecialPages", SPECIAL_TITLES.SpecialPages)}.\n</p>`);
  }
  const sub = rest.join("/");
  if (canonical !== name) return { redirect: `/wiki/Special:${canonical}${sub ? `/${encodeTitle(sub)}` : ""}` };
  const outcome = SPECIALS[canonical](ctx, sub, query);
  return HELP[canonical] && !("redirect" in outcome) ? { ...outcome, indicators: helpIndicator(HELP[canonical]) } : outcome;
}

function view(ctx: Context, title: Title, query: Query): Outcome | { redirect: string } {
  if (title.ns === -1) return special(ctx, title, query);
  if (query.action === "raw") return { redirect: `/api/raw?title=${encodeTitle(title.full)}` };
  if (query.diff !== undefined) return diffView(ctx, title, query);
  switch (query.action) {
    case "edit":
    case "submit": {
      const { editor, ...props } = editView(ctx, title, query);
      return editor ? { ...props, children: <Editor state={editor} /> } : props;
    }
    case "history":
      return historyView(ctx, title, query);
    case "info":
      return infoView(ctx, title);
    default:
      return articleView(ctx, title, query);
  }
}

function badTitle(): Outcome {
  return specialProps("Bad title", `<p>The requested page title is empty or contains invalid characters.\n</p><p id="mw-returnto">Return to <a href="/wiki/Main_Page" title="${esc(MAIN_PAGE)}">${esc(MAIN_PAGE)}</a>.</p>`);
}

export async function renderTitle(raw: string, query: Query) {
  const ctx = await context();
  const title = parseTitle(raw);
  const outcome = title ? view(ctx, title, query) : badTitle();
  if ("redirect" in outcome) redirect(outcome.redirect);
  const { children, ...props } = outcome;
  const returnto = title && title.ns !== -1 ? title.full : "";
  return <Skin {...finish(ctx, props, returnto)}>{children}</Skin>;
}

export const firstValue = (params: Record<string, string | string[] | undefined>): Query =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
