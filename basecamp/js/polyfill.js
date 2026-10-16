if (typeof globalThis === "undefined") var globalThis = this;
if (!String.raw) {
  String.raw = function (callSite) {
    var raw = callSite && callSite.raw;
    if (!raw) return "";
    var out = String(raw[0]);
    for (var i = 1; i < raw.length; i++) out += arguments[i] + raw[i];
    return out;
  };
}
if (typeof TextEncoder === "undefined") {
  var TextEncoder = function () {};
  TextEncoder.prototype.encode = function (str) {
    str = String(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new Uint8Array(out);
  };
}
if (globalThis.TextEncoder === undefined) globalThis.TextEncoder = TextEncoder;
if (!Object.hasOwn) {
  Object.hasOwn = function (obj, prop) {
    return Object.prototype.hasOwnProperty.call(Object(obj), prop);
  };
}
if (!Array.prototype.flatMap) {
  Array.prototype.flatMap = function (fn, ctx) {
    var out = [];
    for (var i = 0; i < this.length; i++) {
      var v = fn.call(ctx, this[i], i, this);
      if (Array.isArray(v)) for (var j = 0; j < v.length; j++) out.push(v[j]);
      else out.push(v);
    }
    return out;
  };
}
if (!String.prototype.trimStart) {
  String.prototype.trimStart = function () {
    return String(this).replace(/^\s+/, "");
  };
}
if (!String.prototype.trimEnd) {
  String.prototype.trimEnd = function () {
    return String(this).replace(/\s+$/, "");
  };
}
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (search, replacement) {
    if (search instanceof RegExp) return String(this).replace(search, replacement);
    var out = String(this);
    var find = String(search);
    var idx;
    var next = "";
    while ((idx = out.indexOf(find)) >= 0) {
      next += out.slice(0, idx) + replacement;
      out = out.slice(idx + find.length);
    }
    return next + out;
  };
}
if (!String.prototype.padStart) {
  String.prototype.padStart = function (len, fill) {
    var s = String(this);
    fill = fill === undefined ? " " : String(fill);
    if (!fill) return s;
    while (s.length < len) s = fill + s;
    return s.slice(s.length - len);
  };
}
if (!String.prototype.padEnd) {
  String.prototype.padEnd = function (len, fill) {
    var s = String(this);
    fill = fill === undefined ? " " : String(fill);
    if (!fill) return s;
    while (s.length < len) s += fill;
    return s.slice(0, len);
  };
}
if (!Array.prototype.at) {
  Array.prototype.at = function (n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    return this[n];
  };
}
if (!String.prototype.matchAll) {
  String.prototype.matchAll = function (re) {
    var flags = re.flags.indexOf("g") >= 0 ? re.flags : re.flags + "g";
    var copy = new RegExp(re.source, flags);
    var out = [];
    var match;
    while ((match = copy.exec(this))) out.push(match);
    return out;
  };
}
