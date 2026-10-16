type QmlNode = { tag: string; attrs: string; children: Array<QmlNode | string> };

const VOID: { [tag: string]: boolean } = { br: true, hr: true, img: true, wbr: true };

function parseStyle(raw: string) {
  const out: { [k: string]: string } = {};
  const parts = raw.split(";");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const c = part.indexOf(":");
    if (c < 0) continue;
    const key = part.slice(0, c).trim().toLowerCase();
    if (key) out[key] = part.slice(c + 1).trim();
  }
  return out;
}

function styleFrom(attrs: string) {
  const m = /\bstyle="([^"]*)"/.exec(attrs);
  return m ? parseStyle(m[1]) : {};
}

function colorOf(style: { [k: string]: string }) {
  const v = style["background-color"] || style.background || "";
  const m = /#([0-9a-f]{3,8})\b/i.exec(v);
  if (!m) return "";
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length > 6) h = h.slice(0, 6);
  return "#" + h;
}

function hasBorder(style: { [k: string]: string }) {
  for (const key in style) {
    if (key !== "border" && key.indexOf("border-") !== 0) continue;
    const v = style[key].toLowerCase();
    if (v && v !== "none" && v !== "0" && v !== "0px") return true;
  }
  return false;
}

function isFlex(style: { [k: string]: string }) {
  return (style.display || "").indexOf("flex") >= 0;
}

function parseFragment(html: string): Array<QmlNode | string> {
  const root: QmlNode = { tag: "#root", attrs: "", children: [] };
  const stack = [root];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (match.index > last) stack[stack.length - 1].children.push(html.slice(last, match.index));
    last = match.index + match[0].length;
    const tag = match[1].toLowerCase();
    if (match[0][1] === "/") {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const attrs = match[0].replace(/^<[a-zA-Z][a-zA-Z0-9]*/, "").replace(/\/?>$/, "");
    const node: QmlNode = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!VOID[tag] && !/\/\s*>$/.test(match[0])) stack.push(node);
  }
  if (last < html.length) root.children.push(html.slice(last));
  return root.children;
}

function elements(node: QmlNode) {
  const out: QmlNode[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (typeof child !== "string") out.push(child);
  }
  return out;
}

function box(header: string, headerBg: string, body: string) {
  const head = header
    ? `<tr><td bgcolor="${headerBg || "#eaecf0"}"><p><b>${header}</b></p></td></tr>`
    : "";
  return `<table width="100%" cellspacing="0" cellpadding="8" border="1" bordercolor="#a2a9b1" bgcolor="#ffffff">${head}<tr><td>${body}</td></tr></table><p></p>`;
}

function transform(nodes: Array<QmlNode | string>): string {
  let html = "";
  for (let i = 0; i < nodes.length; i++) html += transformOne(nodes[i]);
  return html;
}

function transformOne(node: QmlNode | string): string {
  if (typeof node === "string") return node;
  const style = styleFrom(node.attrs);
  if (node.tag === "div" && isFlex(style)) {
    const cols = elements(node);
    let cells = "";
    for (let i = 0; i < cols.length; i++) cells += `<td valign="top">${transformOne(cols[i])}</td>`;
    const border = hasBorder(style) ? ` border="1" bordercolor="#c8ccd1"` : "";
    const bg = colorOf(style);
    return `<table width="100%" cellspacing="8" cellpadding="8"${border}${bg ? ` bgcolor="${bg}"` : ""}><tr>${cells}</tr></table><p></p>`;
  }
  if (node.tag === "div" && hasBorder(style)) {
    const kids = elements(node);
    let header = "";
    let headerBg = "#eaecf0";
    let body = node.children;
    if (kids[0] && kids[0].tag === "div" && colorOf(styleFrom(kids[0].attrs))) {
      headerBg = colorOf(styleFrom(kids[0].attrs)) || headerBg;
      header = transform(kids[0].children);
      let idx = 0;
      while (idx < node.children.length && node.children[idx] !== kids[0]) idx++;
      body = node.children.slice(idx + 1);
    }
    return box(header, headerBg, transform(body));
  }
  if (node.tag === "div") {
    let inner = transform(node.children);
    const size = style["font-size"] || "";
    const align = (style["text-align"] || "").toLowerCase();
    const weight = (style["font-weight"] || "").toLowerCase();
    const fg = /#([0-9a-f]{3,6})/i.exec(style.color || "");
    const bg = colorOf(style);
    if (weight === "bold" || Number(weight) >= 600) inner = `<b>${inner}</b>`;
    if (size.indexOf("2em") >= 0) inner = `<h2>${inner}</h2>`;
    else if (size.indexOf("1.1") >= 0 || size.indexOf("1.15") >= 0) inner = `<b>${inner}</b>`;
    if (fg) inner = `<font color="#${fg[1]}">${inner}</font>`;
    const alignAttr = align === "center" || align === "right" ? ` align="${align}"` : "";
    const block = /<(p|ul|ol|table|h[1-6]|div)\b/i.test(inner);
    const wrapped = block ? inner : `<p>${inner}</p>`;
    if (bg) return `<table width="100%" cellspacing="0" cellpadding="6" bgcolor="${bg}"><tr><td${alignAttr}>${wrapped}</td></tr></table>`;
    if (alignAttr) return `<div${alignAttr}>${wrapped}</div>`;
    return wrapped;
  }
  const inner = transform(node.children);
  if (VOID[node.tag]) return `<${node.tag}${node.attrs}>`;
  return `<${node.tag}${node.attrs}>${inner}</${node.tag}>`;
}

export function qmlHtml(html: string) {
  return transform(parseFragment(html));
}
