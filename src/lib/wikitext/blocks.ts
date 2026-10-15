import { sanitizeAttrs } from "./sanitize.ts";

type TableState = { td: boolean; tr: boolean; openedTr: boolean; tag: string; trAttrs: string };

function cellsOf(line: string, kind: string) {
  const body = kind === "+" ? line.slice(2) : line.slice(1);
  return (kind === "!" ? body.replace(/!!/g, "||") : body).split("||");
}

export function doTables(text: string) {
  const out: string[] = [];
  const stack: (TableState & { indent: number })[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const table = /^(:*)\s*\{\|(.*)$/.exec(line);
    const top = stack[stack.length - 1];
    if (table) {
      stack.push({ td: false, tr: false, openedTr: false, tag: "", trAttrs: "", indent: table[1].length });
      out.push(`${"<dl><dd>".repeat(table[1].length)}<table${sanitizeAttrs(table[2])}>`);
    } else if (!top || !line) {
      out.push(raw);
    } else if (line.startsWith("|}")) {
      stack.pop();
      let html = `</table>${line.slice(2)}`;
      if (!top.openedTr) html = `<tr><td></td></tr>${html}`;
      if (top.tr) html = `</tr>${html}`;
      if (top.td) html = `</${top.tag}>${html}`;
      out.push(html + "</dd></dl>".repeat(top.indent));
    } else if (line.startsWith("|-")) {
      let html = top.tr ? "</tr>" : "";
      if (top.td) html = `</${top.tag}>${html}`;
      Object.assign(top, { trAttrs: sanitizeAttrs(line.replace(/^\|-+/, "")), openedTr: true, tr: false, td: false });
      out.push(html);
    } else if (/^[|!]/.test(line)) {
      const kind = line.startsWith("|+") ? "+" : line[0];
      let html = "";
      for (const cell of cellsOf(line, kind)) {
        let previous = "";
        if (kind !== "+") {
          if (!top.tr) previous = `<tr${top.trAttrs}>\n`;
          Object.assign(top, { tr: true, trAttrs: "", openedTr: true });
        }
        if (top.td) previous = `</${top.tag}>\n${previous}`;
        top.tag = kind === "|" ? "td" : kind === "!" ? "th" : "caption";
        const pipe = cell.indexOf("|");
        const hasAttrs = pipe >= 0 && !cell.slice(0, pipe).includes("[[");
        const attrs = hasAttrs ? sanitizeAttrs(cell.slice(0, pipe)) : "";
        html += `${previous}<${top.tag}${attrs}>${(hasAttrs ? cell.slice(pipe + 1) : cell).trim()}`;
        top.td = true;
      }
      out.push(html);
    } else out.push(raw);
  }
  while (stack.length) {
    const top = stack.pop()!;
    out.push(`${top.td ? `</${top.tag}>` : ""}${top.tr ? "</tr>" : ""}${top.openedTr ? "" : "<tr><td></td></tr>"}</table>`);
  }
  return out.join("\n");
}

const OPEN = /(?:<table|<h[1-6]|<pre|<tr|<p|<ul|<ol|<dl|<li|<\/tr|<\/td|<\/th)\b/i;
const CLOSE =
  /(?:<\/table|<\/h[1-6]|<td|<th|<\/?blockquote|<\/?div|<hr|<\/pre|<\/p|<\/li|<\/ul|<\/ol|<\/dl|<\/?center|<figure|<\/figure)\b|\x7fUNIQ-pre/i;

const LIST_TAG: Record<string, string> = { "*": "ul", "#": "ol", ":": "dl", ";": "dl" };
const ITEM_TAG: Record<string, string> = { "*": "li", "#": "li", ":": "dd", ";": "dt" };

const common = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && (a[i] === b[i] || (a[i] === ";" && b[i] === ":") || (a[i] === ":" && b[i] === ";"))) i++;
  return i;
};

export function doBlockLevels(text: string) {
  const lines = text.split("\n");
  let out = "";
  let last = "";
  let section = "";
  let pending: string | false = false;
  let inBlock = false;
  let inPre = false;
  let dtOpen = false;
  const closeParagraph = () => {
    const html = section ? `</${section}>\n` : "";
    section = "";
    return html;
  };
  const openItem = (char: string) => {
    dtOpen = char === ";";
    return `<${ITEM_TAG[char]}>`;
  };
  const closeItem = (char: string) => (LIST_TAG[char] === "dl" ? (dtOpen ? "</dt>" : "</dd>") : "</li>");
  const openList = (char: string) => `<${LIST_TAG[char]}>${openItem(char)}`;
  const nextItem = (char: string) => `${closeItem(char)}\n${openItem(char)}`;
  const closeList = (char: string) => `${closeItem(char)}</${LIST_TAG[char]}>`;
  const definitionSplit = (text: string) => {
    const colon = text.indexOf(":");
    if (colon < 0) return text;
    dtOpen = false;
    return `${text.slice(0, colon)}</dt><dd>${text.slice(colon + 1).trimStart()}`;
  };
  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const prefix = inPre ? "" : /^[*#:;]*/.exec(line)![0];
    let t = line.slice(prefix.length);
    if (prefix.length) t = t.trimStart();
    if (prefix && last === prefix.replace(/;/g, ":")) {
      out += nextItem(prefix[prefix.length - 1]);
      pending = false;
      if (prefix.endsWith(";")) t = definitionSplit(t);
    } else if (prefix || last) {
      let shared = common(prefix, last);
      pending = false;
      for (let n = last.length; n > shared; n--) out += closeList(last[n - 1]);
      if (prefix.length <= shared && shared > 0) out += nextItem(prefix[shared - 1]);
      if (last && prefix.length > shared) out += "\n";
      for (; prefix.length > shared; shared++) {
        out += closeParagraph() + openList(prefix[shared]);
        if (prefix[shared] === ";") t = definitionSplit(t);
      }
      if (!prefix && last) out += "\n";
      last = prefix.replace(/;/g, ":");
    }
    if (!prefix) {
      if (OPEN.test(t) || CLOSE.test(t)) {
        pending = false;
        out += closeParagraph();
        if (/<pre\b/i.test(t)) inPre = true;
        if (/<\/pre\b/i.test(t)) inPre = false;
        inBlock = !CLOSE.test(t);
      } else if (!inBlock && !inPre) {
        if (t.startsWith(" ") && (section === "pre" || t.trim())) {
          if (section !== "pre") {
            pending = false;
            out += `${closeParagraph()}<pre>`;
            section = "pre";
          }
          t = t.slice(1);
        } else if (!t.trim()) {
          if (pending) {
            out += `${pending}<br />`;
            pending = false;
            section = "p";
          } else if (section !== "p") {
            out += closeParagraph();
            pending = "<p>";
          } else pending = "</p><p>";
        } else if (pending) {
          out += pending;
          pending = false;
          section = "p";
        } else if (section !== "p") {
          out += `${closeParagraph()}<p>`;
          section = "p";
        }
      }
    }
    if (pending === false) {
      out += t;
      if (!prefix && (!isLast || section)) out += "\n";
    }
  });
  for (let n = last.length; n > 0; n--) out += closeList(last[n - 1]);
  return out + closeParagraph();
}

export type Heading = { level: number; text: string; anchor: string; number: string; toclevel: number };

const plain = (html: string) =>
  html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();

const legacyAnchor = (anchor: string) =>
  encodeURIComponent(anchor)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%3A/g, ":")
    .replace(/%/g, ".");

export function doHeadings(text: string) {
  return text.replace(/^(={1,6})(.+)\1[ \t]*$/gm, (_, eq: string, inner: string) => `<h${eq.length}>${inner.trim()}</h${eq.length}>`);
}

export function formatHeadings(html: string, headings: Heading[], editLink?: (section: number, text: string) => string) {
  const used = new Map<string, number>();
  const levels: number[] = [];
  const counters: number[] = [];
  return html.replace(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1\s*>/gi, (_, n: string, attrs = "", inner: string) => {
    const level = Number(n);
    while (levels.length && levels[levels.length - 1] > level) levels.pop();
    if (!levels.length || levels[levels.length - 1] < level) levels.push(level);
    const toclevel = levels.length;
    counters.length = toclevel;
    counters[toclevel - 1] = (counters[toclevel - 1] ?? 0) + 1;
    const text = plain(inner);
    const base = text.replace(/\s+/g, "_");
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    const anchor = count > 1 ? `${base}_${count}` : base;
    headings.push({ level, text, anchor, number: counters.join("."), toclevel });
    const edit = editLink ? editLink(headings.length, text) : "";
    const id = anchor.replace(/"/g, "&quot;");
    const legacy = legacyAnchor(anchor);
    const old = legacy === anchor ? "" : `<span id="${legacy}"></span>`;
    return `<h${n}${attrs}>${old}<span class="mw-headline" id="${id}">${inner}</span>${edit}</h${n}>`;
  });
}
