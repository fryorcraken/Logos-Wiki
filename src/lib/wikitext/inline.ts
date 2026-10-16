import { actionUrl, pageUrl, parseTitle, type Title } from "../title.ts";
import { escapeHtml } from "./sanitize.ts";

export type LinkContext = {
  title: Title;
  exists(full: string): boolean;
  file(name: string): { width: number; height: number } | null;
  categories: { name: string; sortKey?: string }[];
  links: Set<string>;
};

function balanceQuotes(arr: string[]) {
  let italics = 0;
  let bold = 0;
  for (let i = 1; i < arr.length; i += 2) {
    let len = arr[i].length;
    if (len === 4) {
      arr[i - 1] += "'";
      arr[i] = "'''";
      len = 3;
    } else if (len > 5) {
      arr[i - 1] += "'".repeat(len - 5);
      arr[i] = "'''''";
      len = 5;
    }
    if (len === 2 || len === 5) italics++;
    if (len === 3 || len === 5) bold++;
  }
  if (italics % 2 === 0 || bold % 2 === 0) return;
  let single = -1;
  let multi = -1;
  let space = -1;
  for (let i = 1; i < arr.length; i += 2) {
    if (arr[i].length !== 3) continue;
    const x1 = arr[i - 1].slice(-1);
    const x2 = arr[i - 1].slice(-2, -1);
    if (x1 === " ") {
      if (space < 0) space = i;
    } else if (x2 === " ") {
      single = i;
      break;
    } else if (multi < 0) multi = i;
  }
  const at = single >= 0 ? single : multi >= 0 ? multi : space;
  if (at >= 0) {
    arr[at] = "''";
    arr[at - 1] += "'";
  }
}

const QUOTE_STEPS: Record<string, Record<string, [string, string]>> = {
  "2": { i: ["</i>", ""], bi: ["</i>", "b"], ib: ["</b></i><b>", "b"], "": ["<i>", "i"], b: ["<i>", "bi"] },
  "3": { b: ["</b>", ""], bi: ["</i></b><i>", "i"], ib: ["</b>", "i"], "": ["<b>", "b"], i: ["<b>", "ib"] },
  "5": { b: ["</b><i>", "i"], i: ["</i><b>", "b"], bi: ["</i></b>", ""], ib: ["</b></i>", ""], "": ["", "both"] },
};

export function doQuotes(line: string) {
  const arr = line.split(/(''+)/);
  if (arr.length === 1) return line;
  balanceQuotes(arr);
  let out = "";
  let buffer = "";
  let state = "";
  arr.forEach((piece, i) => {
    if (i % 2 === 0) {
      if (state === "both") buffer += piece;
      else out += piece;
      return;
    }
    if (state === "both") {
      const len = piece.length;
      out += len === 2 ? `<b><i>${buffer}</i>` : len === 3 ? `<i><b>${buffer}</b>` : `<i><b>${buffer}</b></i>`;
      state = len === 2 ? "b" : len === 3 ? "i" : "";
      return;
    }
    const [html, next] = QUOTE_STEPS[String(piece.length)][state];
    out += html;
    state = next;
    if (state === "both") buffer = "";
  });
  if (state === "b" || state === "ib") out += "</b>";
  if (state === "i" || state === "bi" || state === "ib") out += "</i>";
  if (state === "bi") out += "</b>";
  if (state === "both" && buffer) out += `<b><i>${buffer}</i></b>`;
  return out;
}

export function linkHtml(t: Title, text: string, ctx: LinkContext) {
  if (!t.text && t.fragment) return `<a href="#${escapeHtml(t.fragment.replace(/ /g, "_"))}">${text}</a>`;
  if (t.full === ctx.title.full && !t.fragment) return `<a class="mw-selflink selflink">${text}</a>`;
  ctx.links.add(t.full);
  const title = escapeHtml(t.full);
  if (ctx.exists(t.full)) return `<a href="${pageUrl(t.full, t.fragment)}" title="${title}">${text}</a>`;
  const href = escapeHtml(actionUrl(t.full, { action: "edit", redlink: 1 }));
  return `<a href="${href}" class="new" title="${title} (page does not exist)">${text}</a>`;
}

function fileHtml(t: Title, options: string[], ctx: LinkContext) {
  const file = ctx.file(t.text);
  if (!file) return linkHtml(t, escapeHtml(t.full), ctx);
  let width = file.width;
  let alt = "";
  let thumb = false;
  let caption = "";
  for (const option of options) {
    const size = /^\s*(\d*)(?:x(\d*))?px\s*$/.exec(option);
    if (size?.[1]) width = Math.min(Number(size[1]), file.width);
    else if (/^\s*alt=/.test(option)) alt = option.replace(/^\s*alt=/, "");
    else if (/^\s*(thumb|thumbnail|frame)\s*$/.test(option)) thumb = true;
    else if (!/^\s*(left|right|center|none|border|frameless|upright.*|link=.*)\s*$/.test(option)) caption = option;
  }
  if (thumb && width === file.width) width = Math.min(250, file.width);
  const height = Math.round((file.height * width) / file.width);
  const img = `<img alt="${escapeHtml(alt)}" src="/files/${encodeURIComponent(t.text)}" decoding="async" width="${width}" height="${height}" class="mw-file-element" />`;
  const link = `<a href="${pageUrl(t.full)}" class="mw-file-description">${img}</a>`;
  ctx.links.add(t.full);
  if (thumb) return `<figure class="mw-default-size" typeof="mw:File/Thumb">${link}<figcaption>${caption}</figcaption></figure>`;
  return `<span typeof="mw:File">${link}</span>`;
}

export function internalLinks(text: string, ctx: LinkContext) {
  const pieces = text.split("[[");
  let out = pieces[0];
  for (const piece of pieces.slice(1)) {
    const m = /^([^[\]|\n]+)(?:\|([\s\S]*?))?\]\]([a-z]*)([\s\S]*)$/.exec(piece);
    const t = m && parseTitle(m[1]);
    if (!m || !t) {
      out += `[[${piece}`;
      continue;
    }
    const [, target, label, trail, rest] = m;
    const colon = target.trim().startsWith(":");
    if (!colon && t.ns === 14) {
      ctx.categories.push({ name: t.text, sortKey: label });
      out = out.trimEnd() + trail + rest;
    } else if (!colon && t.ns === 6) {
      out += fileHtml(t, label?.split("|") ?? [], ctx) + trail + rest;
    } else {
      const text = (label ?? target.trim().replace(/^:/, "")) + trail;
      out += linkHtml(t, text, ctx) + rest;
    }
  }
  return out;
}

const URL = "(?:(?:https?|ftp):)?\\/\\/[^\\s\\]<>\"\\[]+|mailto:[^\\s\\]<>\"\\[]+";

export function externalLinks(text: string) {
  let n = 0;
  const bracketed = text.replace(new RegExp("\\[(" + URL + ")(?:[ \\t]+([^\\]\\n]*))?\\]", "g"), (_, url, label) =>
    label
      ? `<a rel="nofollow" class="external text" href="${url}">${label}</a>`
      : `<a rel="nofollow" class="external autonumber" href="${url}">[${++n}]</a>`,
  );
  return bracketed
    .split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]*>)/)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/\b(?:https?|ftp):\/\/[^\s<>[\]"]+/g, (url) => {
            const trail = (url.includes("(") ? /[.,;:!?]+$/ : /[.,;:!?)]+$/).exec(url)?.[0] ?? "";
            const href = url.slice(0, url.length - trail.length);
            return `<a rel="nofollow" class="external free" href="${href}">${href}</a>${trail}`;
          }),
    )
    .join("");
}
