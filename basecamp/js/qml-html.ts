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

const LIGHT = {
  paper: "#ffffff",
  wash: "#f8f9fa",
  header: "#eaecf0",
  line: "#a2a9b1",
  lineSoft: "#c8ccd1",
  ink: "#202122",
  muted: "#54595d",
  link: "#3366cc",
  red: "#ba0000",
  mint: "#cef2e0",
  cream: "#fef6e7",
  info: "#cedff2",
  del: "#8f0000",
  ins: "#006400",
};

const DARK = {
  paper: "#101418",
  wash: "#202122",
  header: "#27292d",
  line: "#54595d",
  lineSoft: "#72777d",
  ink: "#eaecf0",
  muted: "#a2a9b1",
  link: "#88a3e8",
  red: "#fd7865",
  mint: "#274a32",
  cream: "#3b3420",
  info: "#233549",
  del: "#fd7865",
  ins: "#80d4a0",
};

const FILL: { [hex: string]: keyof typeof DARK } = {
  "#ffffff": "paper",
  "#fff": "paper",
  "#f8f9fa": "wash",
  "#eaecf0": "header",
  "#a2a9b1": "line",
  "#c8ccd1": "lineSoft",
  "#cef2e0": "mint",
  "#fef6e7": "cream",
  "#eaf3ff": "info",
  "#cedff2": "info",
};

const TEXT: { [hex: string]: keyof typeof DARK } = {
  "#000": "ink",
  "#000000": "ink",
  "#202122": "ink",
  "#333": "ink",
  "#333333": "ink",
  "#54595d": "muted",
  "#3366cc": "link",
  "#ba0000": "red",
};

let theme = LIGHT;

export function setHtmlTheme(dark: boolean) {
  theme = dark ? DARK : LIGHT;
}

export function htmlTheme() {
  return theme;
}

function mapFill(hex: string) {
  if (theme === LIGHT) return hex;
  const key = FILL[hex.toLowerCase()];
  return key ? theme[key] : hex;
}

function mapText(hex: string) {
  if (theme === LIGHT) return hex;
  const key = TEXT[hex.toLowerCase()];
  return key ? theme[key] : hex;
}

function colorOf(style: { [k: string]: string }) {
  const v = style["background-color"] || style.background || "";
  const m = /#([0-9a-f]{3,8})\b/i.exec(v);
  if (!m) return "";
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length > 6) h = h.slice(0, 6);
  return mapFill("#" + h);
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

function hasClass(attrs: string, name: string) {
  const m = /\bclass="([^"]*)"/.exec(attrs);
  return !!m && m[1].split(/\s+/).indexOf(name) >= 0;
}

function box(header: string, headerBg: string, body: string, bg = "") {
  const fill = bg || theme.paper;
  const head = header
    ? `<tr><td bgcolor="${headerBg || theme.header}"><p><font size="4" color="${theme.ink}"><b>${header}</b></font></p></td></tr>`
    : "";
  return `<table width="100%" cellspacing="0" cellpadding="10" border="1" bordercolor="${theme.line}" bgcolor="${fill}">${head}<tr><td><font color="${theme.ink}">${body}</font></td></tr></table><p></p>`;
}

function headingRule() {
  return "<hr />";
}

function wikiRows(node: QmlNode): string {
  let html = "";
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (typeof child === "string") {
      html += child;
      continue;
    }
    if (child.tag === "tr") html += `<tr${child.attrs}>${wikiCells(child)}</tr>`;
    else if (child.tag === "tbody" || child.tag === "thead") html += wikiRows(child);
    else html += transformOne(child);
  }
  return html;
}

function wikiCells(row: QmlNode): string {
  let html = "";
  for (let i = 0; i < row.children.length; i++) {
    const child = row.children[i];
    if (typeof child === "string") {
      html += child;
      continue;
    }
    const inner = transform(child.children);
    if (child.tag === "th") html += `<th bgcolor="${theme.header}" align="center"><font color="${theme.ink}">${inner}</font></th>`;
    else html += `<${child.tag}${child.attrs}><font color="${theme.ink}">${inner}</font></${child.tag}>`;
  }
  return html;
}

function transform(nodes: Array<QmlNode | string>): string {
  let html = "";
  for (let i = 0; i < nodes.length; i++) html += transformOne(nodes[i]);
  return html;
}

function transformOne(node: QmlNode | string): string {
  if (typeof node === "string") return node;
  const style = styleFrom(node.attrs);
  if ((style.display || "").toLowerCase() === "none") return "";
  if (/^h[1-6]$/.test(node.tag)) {
    const inner = transform(node.children);
    const size = node.tag === "h1" ? "6" : node.tag === "h2" ? "5" : node.tag === "h3" ? "4" : "3";
    const heading = `<p><font size="${size}"><b>${inner}</b></font></p>`;
    return node.tag === "h1" || node.tag === "h2" ? heading + headingRule() : heading;
  }
  if (node.tag === "table") {
    if (hasClass(node.attrs, "wikitable")) {
      return `<table width="100%" cellspacing="0" cellpadding="4" border="1" bordercolor="${theme.line}" bgcolor="${theme.wash}">${wikiRows(node)}</table><p></p>`;
    }
    return `<table${node.attrs}>${transform(node.children)}</table>`;
  }
  if (node.tag === "a") {
    const inner = transform(node.children);
    const colored = /\bnew\b/.test(node.attrs)
      ? `<font color="${theme.red}">${inner}</font>`
      : `<font color="${theme.link}">${inner}</font>`;
    return `<a${node.attrs}>${colored}</a>`;
  }
  if (node.tag === "div" && isFlex(style)) {
    const cols = elements(node);
    let cells = "";
    for (let i = 0; i < cols.length; i++) cells += `<td valign="top">${transformOne(cols[i])}</td>`;
    const border = hasBorder(style) ? ` border="1" bordercolor="${theme.lineSoft}"` : "";
    const bg = colorOf(style);
    return `<table width="100%" cellspacing="10" cellpadding="10"${border}${bg ? ` bgcolor="${bg}"` : ""}><tr>${cells}</tr></table><p></p>`;
  }
  if (node.tag === "div" && hasBorder(style)) {
    const kids = elements(node);
    let header = "";
    let headerBg = theme.header;
    let body = node.children;
    if (kids[0] && kids[0].tag === "div" && colorOf(styleFrom(kids[0].attrs))) {
      headerBg = colorOf(styleFrom(kids[0].attrs)) || headerBg;
      header = transform(kids[0].children);
      let idx = 0;
      while (idx < node.children.length && node.children[idx] !== kids[0]) idx++;
      body = node.children.slice(idx + 1);
    }
    return box(header, headerBg, transform(body), colorOf(style) || theme.paper);
  }
  if (node.tag === "div") {
    let inner = transform(node.children);
    const size = style["font-size"] || "";
    const align = (style["text-align"] || "").toLowerCase();
    const weight = (style["font-weight"] || "").toLowerCase();
    const fg = /#([0-9a-f]{3,6})/i.exec(style.color || "");
    const bg = colorOf(style);
    if (weight === "bold" || Number(weight) >= 600) inner = `<b>${inner}</b>`;
    if (size.indexOf("2em") >= 0) inner = `<font size="6"><b>${inner}</b></font>`;
    else if (size.indexOf("1.5") >= 0) inner = `<font size="5"><b>${inner}</b></font>`;
    else if (size.indexOf("1.1") >= 0 || size.indexOf("1.15") >= 0) inner = `<font size="4"><b>${inner}</b></font>`;
    if (fg) inner = `<font color="${mapText("#" + (fg[1].length === 3 ? fg[1][0] + fg[1][0] + fg[1][1] + fg[1][1] + fg[1][2] + fg[1][2] : fg[1]))}">${inner}</font>`;
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

function stripStatus(html: string) {
  return html
    .replace(/<div\b[^>]*>[\s\S]{0,500}?Every page carries a status[\s\S]*?<\/div>/gi, "")
    .replace(/<div\b[^>]*>[\s\S]{0,500}?Page status:[\s\S]*?change (?:its|this page'?s) status\.?[\s\S]{0,80}<\/div>/gi, "")
    .replace(/<p\b[^>]*>[\s\S]{0,160}?Every page carries a status[\s\S]*?<\/p>/gi, "")
    .replace(/<p\b[^>]*>[\s\S]{0,160}?Page status:[\s\S]*?change (?:its|this page'?s) status\.?[\s\S]{0,40}<\/p>/gi, "")
    .replace(/Every page carries a status:[\s\S]{0,280}/gi, "")
    .replace(/Page status:\s*(?:<b>[\s\S]*?<\/b>)?[\s\S]{0,220}change (?:its|this page'?s) status\.?/gi, "");
}

export function qmlHtml(html: string) {
  return `<font color="${theme.ink}">${transform(parseFragment(stripStatus(html)))}</font>`;
}
