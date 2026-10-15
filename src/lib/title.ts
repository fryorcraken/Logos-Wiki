import { SITENAME } from "./config.ts";

export const NAMESPACES: Record<number, string> = {
  [-2]: "Media",
  [-1]: "Special",
  0: "",
  1: "Talk",
  2: "User",
  3: "User talk",
  4: SITENAME,
  5: `${SITENAME} talk`,
  6: "File",
  7: "File talk",
  8: "MediaWiki",
  9: "MediaWiki talk",
  10: "Template",
  11: "Template talk",
  12: "Help",
  13: "Help talk",
  14: "Category",
  15: "Category talk",
};

const ALIASES: Record<string, number> = { image: 6, "image talk": 7, project: 4, "project talk": 5 };
const BY_NAME = new Map<string, number>(
  [...Object.entries(NAMESPACES).map(([n, name]) => [name.toLowerCase(), Number(n)] as const), ...Object.entries(ALIASES)],
);

export type Title = { ns: number; text: string; full: string; fragment: string };

const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function makeTitle(ns: number, text: string): Title {
  const prefix = NAMESPACES[ns];
  return { ns, text, full: prefix ? `${prefix}:${text}` : text, fragment: "" };
}

export function parseTitle(raw: string, defaultNs = 0): Title | null {
  let s = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  let fragment = "";
  const hash = s.indexOf("#");
  if (hash >= 0) {
    fragment = s.slice(hash + 1).trim();
    s = s.slice(0, hash).trim();
  }
  let ns = defaultNs;
  if (s.startsWith(":")) {
    ns = 0;
    s = s.slice(1).trim();
  }
  const colon = s.indexOf(":");
  if (colon > 0) {
    const found = BY_NAME.get(s.slice(0, colon).trim().toLowerCase());
    if (found !== undefined) {
      ns = found;
      s = s.slice(colon + 1).trim();
    }
  }
  if (!s && !fragment) return null;
  if (/[<>[\]{}|]/.test(s) || s.length > 255) return null;
  return { ...makeTitle(ns, ucfirst(s)), fragment };
}

export function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export const dbKey = (full: string) => full.replace(/ /g, "_");

export function encodeTitle(full: string) {
  return encodeURIComponent(dbKey(full)).replace(/%(3A|2F|28|29|2C|21|24|3B|40|7E|2A)/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
}

export const pageUrl = (full: string, fragment = "") =>
  `/wiki/${encodeTitle(full)}${fragment ? `#${anchor(fragment)}` : ""}`;

export function actionUrl(full: string, params: Record<string, string | number>) {
  const query = Object.entries(params).map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`);
  return `/index.php?title=${encodeTitle(full)}${query.join("")}`;
}

export const anchor = (text: string) => text.trim().replace(/\s+/g, "_");

export const subjectNs = (ns: number) => (ns >= 0 && ns % 2 === 1 ? ns - 1 : ns);
export const talkNs = (ns: number) => (ns >= 0 && ns % 2 === 0 ? ns + 1 : ns);
