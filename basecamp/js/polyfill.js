if (typeof globalThis === "undefined") var globalThis = this;
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
