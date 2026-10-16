import { escapeHtml } from "./wikitext/sanitize.ts";

type Op = { kind: "same" | "del" | "add"; text: string };
const MAX_CELLS = 4_000_000;

function sequence(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const head = a.slice(0, start).map((text) => ({ kind: "same" as const, text }));
  const tail = a.slice(endA).map((text) => ({ kind: "same" as const, text }));
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  return [...head, ...middle(x, y), ...tail];
}

function middle(x: string[], y: string[]): Op[] {
  const n = x.length;
  const m = y.length;
  if (n * m > MAX_CELLS) return [...x.map((text) => ({ kind: "del" as const, text })), ...y.map((text) => ({ kind: "add" as const, text }))];
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      ops.push({ kind: "same", text: x[i++] });
      j++;
    } else if (j < m && (i === n || table[i][j + 1] >= table[i + 1][j])) {
      ops.push({ kind: "add", text: y[j++] });
    } else {
      ops.push({ kind: "del", text: x[i++] });
    }
  }
  return ops;
}

const tokens = (s: string) => s.match(/\s+|\w+|[^\s\w]/g) ?? [];

function inline(before: string, after: string) {
  let del = "";
  let ins = "";
  for (const op of sequence(tokens(before), tokens(after))) {
    const text = escapeHtml(op.text);
    if (op.kind !== "add") del += op.kind === "del" ? `<del class="diffchange diffchange-inline">${text}</del>` : text;
    if (op.kind !== "del") ins += op.kind === "add" ? `<ins class="diffchange diffchange-inline">${text}</ins>` : text;
  }
  return [del.replace(/<\/del><del class="diffchange diffchange-inline">/g, ""), ins.replace(/<\/ins><ins class="diffchange diffchange-inline">/g, "")];
}

const cell = (html: string) => `<div>${html}</div>`;
const context = (text: string) => {
  const html = cell(escapeHtml(text));
  return `<tr><td class="diff-marker"></td><td class="diff-context diff-side-deleted">${html}</td><td class="diff-marker"></td><td class="diff-context diff-side-added">${html}</td></tr>`;
};
const deleted = (html: string) => `<td class="diff-marker" data-marker="−"></td><td class="diff-deletedline diff-side-deleted">${cell(html)}</td>`;
const added = (html: string) => `<td class="diff-marker" data-marker="+"></td><td class="diff-addedline diff-side-added">${cell(html)}</td>`;
const emptyLeft = `<td colspan="2" class="diff-empty diff-side-deleted"></td>`;
const emptyRight = `<td colspan="2" class="diff-empty diff-side-added"></td>`;

function changeRows(dels: string[], adds: string[]) {
  const rows: string[] = [];
  for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
    const d = dels[k];
    const a = adds[k];
    if (d !== undefined && a !== undefined) {
      const [left, right] = inline(d, a);
      rows.push(`<tr>${deleted(left)}${added(right)}</tr>`);
    } else if (d !== undefined) rows.push(`<tr>${deleted(escapeHtml(d))}${emptyRight}</tr>`);
    else rows.push(`<tr>${emptyLeft}${added(escapeHtml(a!))}</tr>`);
  }
  return rows;
}

export function diffRows(before: string, after: string, radius = 2) {
  const ops = sequence(before.split("\n"), after.split("\n"));
  const changed = ops.map((op) => op.kind !== "same");
  const near = ops.map((_, k) => changed.slice(Math.max(0, k - radius), k + radius + 1).some(Boolean));
  const rows: string[] = [];
  let lineA = 1;
  let lineB = 1;
  let open = false;
  for (let k = 0; k < ops.length; ) {
    if (!near[k]) {
      if (ops[k].kind !== "add") lineA++;
      if (ops[k].kind !== "del") lineB++;
      open = false;
      k++;
      continue;
    }
    if (!open) {
      rows.push(`<tr><td colspan="2" class="diff-lineno" id="mw-diff-left-l${lineA}">Line ${lineA}:</td><td colspan="2" class="diff-lineno">Line ${lineB}:</td></tr>`);
      open = true;
    }
    if (ops[k].kind === "same") {
      rows.push(context(ops[k].text));
      lineA++;
      lineB++;
      k++;
      continue;
    }
    const dels: string[] = [];
    const adds: string[] = [];
    while (k < ops.length && ops[k].kind !== "same") {
      if (ops[k].kind === "del") {
        dels.push(ops[k].text);
        lineA++;
      } else {
        adds.push(ops[k].text);
        lineB++;
      }
      k++;
    }
    rows.push(...changeRows(dels, adds));
  }
  return rows.join("\n");
}
