import { parseTitle, type Title } from "../title.ts";

type Node = string | { kind: "tpl" | "arg"; parts: Part[] };
type Part = Node[];
type Scan = { parts: Part[]; pos: number; closed: boolean };

export type Source = {
  title: Title;
  template(full: string): string | null;
  variable(name: string): string | undefined;
};

export type Meta = { sortKey?: string };

const MAX_DEPTH = 40;

function scan(s: string, pos: number, closer: "}}" | "}}}" | null, depth: number): Scan {
  const parts: Part[] = [[]];
  let buf = "";
  let links = 0;
  const flush = () => {
    if (buf) parts[parts.length - 1].push(buf);
    buf = "";
  };
  while (pos < s.length) {
    if (closer && !links && s.startsWith(closer, pos)) {
      flush();
      return { parts, pos: pos + closer.length, closed: true };
    }
    if (s.startsWith("{{", pos) && depth < MAX_DEPTH) {
      const node = openBrace(s, pos, depth);
      if (node) {
        flush();
        parts[parts.length - 1].push(node.node);
        pos = node.pos;
        continue;
      }
      buf += s[pos++];
      continue;
    }
    if (closer && s.startsWith("[[", pos)) links++;
    if (closer && links && s.startsWith("]]", pos)) links--;
    if (closer && !links && s[pos] === "|") {
      flush();
      parts.push([]);
      pos++;
      continue;
    }
    buf += s[pos++];
  }
  flush();
  return { parts, pos, closed: closer === null };
}

function openBrace(s: string, pos: number, depth: number): { node: Node; pos: number } | null {
  const kind = s.startsWith("{{{", pos) ? "arg" : "tpl";
  const width = kind === "arg" ? 3 : 2;
  const inner = scan(s, pos + width, kind === "arg" ? "}}}" : "}}", depth + 1);
  return inner.closed ? { node: { kind, parts: inner.parts }, pos: inner.pos } : null;
}

export const viewSource = (src: string) =>
  src.replace(/<includeonly>[\s\S]*?(<\/includeonly>|$)/gi, "").replace(/<\/?(noinclude|onlyinclude)\s*>/gi, "");

function includeSource(src: string) {
  const only = [...src.matchAll(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/gi)];
  if (only.length) return only.map((m) => m[1]).join("");
  return src.replace(/<noinclude>[\s\S]*?(<\/noinclude>|$)/gi, "").replace(/<\/?includeonly\s*>/gi, "");
}

type Frame = { args: Map<string, string> | null; stack: string[] };

export function expandTemplates(text: string, source: Source, meta: Meta) {
  const run = (nodes: Part, frame: Frame): string =>
    nodes.map((n) => (typeof n === "string" ? n : n.kind === "arg" ? arg(n.parts, frame) : tpl(n.parts, frame))).join("");

  const arg = (parts: Part[], frame: Frame) => {
    const name = run(parts[0], frame).trim();
    const value = frame.args?.get(name);
    if (value !== undefined) return value;
    if (parts.length > 1) return parts.slice(1).map((p) => run(p, frame)).join("|");
    return `{{{${parts.map((p) => run(p, frame)).join("|")}}}}`;
  };

  const tpl = (parts: Part[], frame: Frame): string => {
    const literal = () => `{{${parts.map((p) => run(p, frame)).join("|")}}}`;
    const name = run(parts[0], frame).trim().replace(/^(safe)?subst:/i, "");
    const sort = /^DEFAULTSORT(?:KEY)?:([\s\S]*)$/i.exec(name);
    if (sort) {
      meta.sortKey = sort[1].trim();
      return "";
    }
    if (parts.length === 1) {
      const value = source.variable(name);
      if (value !== undefined) return value;
    }
    if (name.startsWith("#")) return literal();
    const title = parseTitle(name, 10);
    if (!title) return literal();
    if (frame.stack.includes(title.full) || frame.stack.length >= MAX_DEPTH)
      return `<span class="error">Template loop detected: [[:${title.full}]]</span>`;
    const src = source.template(title.full);
    if (src === null) return `[[:${title.full}]]`;
    const args = new Map<string, string>();
    let index = 1;
    for (const part of parts.slice(1)) {
      const head = part[0];
      const eq = typeof head === "string" ? head.indexOf("=") : -1;
      if (typeof head === "string" && eq >= 0) {
        const key = head.slice(0, eq).trim();
        args.set(key, run([head.slice(eq + 1), ...part.slice(1)], frame).trim());
      } else args.set(String(index++), run(part, frame));
    }
    return run(scan(includeSource(src), 0, null, 0).parts[0], { args, stack: [...frame.stack, title.full] });
  };

  return run(scan(text, 0, null, 0).parts[0], { args: null, stack: [source.title.full] });
}
