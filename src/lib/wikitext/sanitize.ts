const TAGS = new Set(
  ("b i u s del ins strike big small sub sup tt code kbd samp var cite q dfn abbr span div p br hr center font " +
    "blockquote pre h1 h2 h3 h4 h5 h6 table caption thead tbody tfoot tr td th ul ol li dl dt dd em strong mark " +
    "bdi bdo ruby rt rp wbr data time").split(" "),
);
const VOID = new Set(["br", "hr", "wbr"]);
const ATTRS = new Set(
  ("class id style title lang dir align valign width height colspan rowspan cellpadding cellspacing border " +
    "bgcolor color face size scope start type value reversed datetime").split(" "),
);
const UNSAFE_CSS = /expression|url\s*\(|image-set|attr\s*\(|-moz-binding|behavior\s*:|@import|javascript:|[<>\\]|\/\*/i;

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decodeRefs = (s: string) =>
  s.replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, n: string) =>
    String.fromCodePoint(n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n)),
  );

const ATTR_ESCAPES: [RegExp, string][] = [
  [/\{/g, "&#123;"],
  [/\}/g, "&#125;"],
  [/\[/g, "&#91;"],
  [/\]/g, "&#93;"],
  [/''/g, "&#39;&#39;"],
  [/\|/g, "&#124;"],
  [/__/g, "&#95;_"],
  [/\b(https?|ftp|mailto|irc|news|gopher):/gi, "$1&#58;"],
  [/\n/g, "&#10;"],
  [/\t/g, "&#9;"],
];

const escapeAttr = (s: string) => ATTR_ESCAPES.reduce((v, [re, to]) => v.replace(re, to), escapeHtml(s));

export const fixAmpersands = (s: string) => s.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, "&amp;");

export function sanitizeAttrs(raw: string) {
  let out = "";
  for (const m of raw.matchAll(/([a-zA-Z][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = m[1].toLowerCase();
    let value = decodeRefs(m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!ATTRS.has(name)) continue;
    if (name === "style" && UNSAFE_CSS.test(value)) continue;
    if (name === "id") value = value.replace(/\s+/g, "_");
    out += ` ${name}="${escapeAttr(value)}"`;
  }
  return out;
}

export function sanitizeTags(text: string) {
  return text.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>|<|>/g, (match, close, rawTag, attrs: string) => {
    if (match === ">") return "&gt;";
    const tag = rawTag?.toLowerCase();
    if (!tag || !TAGS.has(tag)) return `&lt;${match.slice(1)}`;
    if (close) return VOID.has(tag) ? "" : `</${tag}>`;
    return `<${tag}${sanitizeAttrs(attrs.replace(/\/\s*$/, ""))}${VOID.has(tag) ? " /" : ""}>`;
  });
}

export function balanceTags(html: string) {
  const stack: string[] = [];
  const out = html.replace(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/g, (match, close, tag: string, selfClose) => {
    if (VOID.has(tag) || selfClose || !(TAGS.has(tag) || tag === "a")) return match;
    if (!close) {
      stack.push(tag);
      return match;
    }
    const at = stack.lastIndexOf(tag);
    if (at < 0) return "";
    const closers = stack.splice(at).reverse().map((t) => `</${t}>`);
    return closers.join("");
  });
  return out + stack.reverse().map((t) => `</${t}>`).join("");
}
