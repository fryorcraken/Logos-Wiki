const HEADING = /^(={1,6})(.+?)\1[ \t]*$/gm;
const OPAQUE = /<!--[\s\S]*?(?:-->|$)|<(nowiki|pre)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;

function headings(text: string) {
  const masked = text.replace(OPAQUE, (m) => m.replace(/=/g, " "));
  return [...masked.matchAll(HEADING)].map((m) => ({ start: m.index!, level: m[1].length }));
}

function bounds(text: string, n: number) {
  const list = headings(text);
  const heading = list[n - 1];
  if (!heading) return null;
  const next = list.slice(n).find((h) => h.level <= heading.level);
  return [heading.start, next ? next.start : text.length] as const;
}

export function sectionText(text: string, n: number) {
  const range = bounds(text, n);
  return range ? text.slice(range[0], range[1]).replace(/\n+$/, "") : null;
}

export function replaceSection(text: string, n: number, replacement: string) {
  const range = bounds(text, n);
  if (!range) return null;
  const rest = text.slice(range[1]);
  return `${text.slice(0, range[0])}${replacement.replace(/\n+$/, "")}${rest ? `\n\n${rest}` : ""}`;
}

export const appendSection = (text: string, heading: string, body: string) =>
  `${text.replace(/\n+$/, "")}${text.trim() ? "\n\n" : ""}== ${heading} ==\n\n${body.trim()}`;
