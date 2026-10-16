.pragma library
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

"use strict";
var WikiEngine = (() => {
var WikiDict = function (pairs) {
  var o = {
    _k: [],
    _v: [],
    size: 0,
    get: function (k) {
      var i = o._k.indexOf(k);
      return i < 0 ? undefined : o._v[i];
    },
    set: function (k, v) {
      var i = o._k.indexOf(k);
      if (i < 0) {
        o._k.push(k);
        o._v.push(v);
      } else o._v[i] = v;
      o.size = o._k.length;
      return o;
    },
    has: function (k) {
      return o._k.indexOf(k) >= 0;
    },
    delete: function (k) {
      var i = o._k.indexOf(k);
      if (i < 0) return false;
      o._k.splice(i, 1);
      o._v.splice(i, 1);
      o.size = o._k.length;
      return true;
    },
    forEach: function (fn, ctx) {
      for (var i = 0; i < o._k.length; i++) fn.call(ctx, o._v[i], o._k[i], o);
    },
    values: function () {
      return o._v.slice();
    },
    keys: function () {
      var arr = o._k.slice();
      var n = 0;
      arr.next = function () {
        if (n >= arr.length) return { done: true, value: undefined };
        return { done: false, value: arr[n++] };
      };
      return arr;
    },
  };
  if (pairs && typeof pairs.length === "number") {
    for (var p = 0; p < pairs.length; p++) {
      if (pairs[p] && pairs[p].length) o.set(pairs[p][0], pairs[p][1]);
    }
  }
  return o;
};
var WikiBag = function (list) {
  var o = {
    _a: [],
    size: 0,
    length: 0,
    add: function (v) {
      if (o._a.indexOf(v) < 0) o._a.push(v);
      o.size = o.length = o._a.length;
      return o;
    },
    has: function (v) {
      return o._a.indexOf(v) >= 0;
    },
    delete: function (v) {
      var i = o._a.indexOf(v);
      if (i < 0) return false;
      o._a.splice(i, 1);
      o.size = o.length = o._a.length;
      return true;
    },
    forEach: function (fn, ctx) {
      for (var i = 0; i < o._a.length; i++) fn.call(ctx, o._a[i], o._a[i], o);
    },
    values: function () {
      return o._a.slice();
    },
    keys: function () {
      return o._a.slice();
    },
    slice: function () {
      return o._a.slice();
    },
  };
  if (typeof Symbol !== "undefined" && Symbol.iterator) {
    o[Symbol.iterator] = function () {
      var a = o._a.slice();
      var i = 0;
      return {
        next: function () {
          if (i >= a.length) return { done: true, value: undefined };
          return { done: false, value: a[i++] };
        },
      };
    };
  }
  if (list && typeof list.length === "number") {
    for (var i = 0; i < list.length; i++) o.add(list[i]);
  }
  return o;
};

  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __pow = Math.pow;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // (disabled):crypto
  var require_crypto = __commonJS({
    "(disabled):crypto"() {
    }
  });

  // basecamp/node_modules/tweetnacl/nacl-fast.js
  var require_nacl_fast = __commonJS({
    "basecamp/node_modules/tweetnacl/nacl-fast.js"(exports, module) {
      (function(nacl2) {
        "use strict";
        var gf = function(init) {
          var i, r = new Float64Array(16);
          if (init) for (i = 0; i < init.length; i++) r[i] = init[i];
          return r;
        };
        var randombytes = function() {
          throw new Error("no PRNG");
        };
        var _0 = new Uint8Array(16);
        var _9 = new Uint8Array(32);
        _9[0] = 9;
        var gf0 = gf(), gf1 = gf([1]), _121665 = gf([56129, 1]), D = gf([30883, 4953, 19914, 30187, 55467, 16705, 2637, 112, 59544, 30585, 16505, 36039, 65139, 11119, 27886, 20995]), D2 = gf([61785, 9906, 39828, 60374, 45398, 33411, 5274, 224, 53552, 61171, 33010, 6542, 64743, 22239, 55772, 9222]), X = gf([54554, 36645, 11616, 51542, 42930, 38181, 51040, 26924, 56412, 64982, 57905, 49316, 21502, 52590, 14035, 8553]), Y = gf([26200, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214, 26214]), I = gf([41136, 18958, 6951, 50414, 58488, 44335, 6150, 12099, 55207, 15867, 153, 11085, 57099, 20417, 9344, 11139]);
        function ts64(x, i, h, l) {
          x[i] = h >> 24 & 255;
          x[i + 1] = h >> 16 & 255;
          x[i + 2] = h >> 8 & 255;
          x[i + 3] = h & 255;
          x[i + 4] = l >> 24 & 255;
          x[i + 5] = l >> 16 & 255;
          x[i + 6] = l >> 8 & 255;
          x[i + 7] = l & 255;
        }
        function vn(x, xi, y, yi, n) {
          var i, d = 0;
          for (i = 0; i < n; i++) d |= x[xi + i] ^ y[yi + i];
          return (1 & d - 1 >>> 8) - 1;
        }
        function crypto_verify_16(x, xi, y, yi) {
          return vn(x, xi, y, yi, 16);
        }
        function crypto_verify_32(x, xi, y, yi) {
          return vn(x, xi, y, yi, 32);
        }
        function core_salsa20(o, p, k, c) {
          var j0 = c[0] & 255 | (c[1] & 255) << 8 | (c[2] & 255) << 16 | (c[3] & 255) << 24, j1 = k[0] & 255 | (k[1] & 255) << 8 | (k[2] & 255) << 16 | (k[3] & 255) << 24, j2 = k[4] & 255 | (k[5] & 255) << 8 | (k[6] & 255) << 16 | (k[7] & 255) << 24, j3 = k[8] & 255 | (k[9] & 255) << 8 | (k[10] & 255) << 16 | (k[11] & 255) << 24, j4 = k[12] & 255 | (k[13] & 255) << 8 | (k[14] & 255) << 16 | (k[15] & 255) << 24, j5 = c[4] & 255 | (c[5] & 255) << 8 | (c[6] & 255) << 16 | (c[7] & 255) << 24, j6 = p[0] & 255 | (p[1] & 255) << 8 | (p[2] & 255) << 16 | (p[3] & 255) << 24, j7 = p[4] & 255 | (p[5] & 255) << 8 | (p[6] & 255) << 16 | (p[7] & 255) << 24, j8 = p[8] & 255 | (p[9] & 255) << 8 | (p[10] & 255) << 16 | (p[11] & 255) << 24, j9 = p[12] & 255 | (p[13] & 255) << 8 | (p[14] & 255) << 16 | (p[15] & 255) << 24, j10 = c[8] & 255 | (c[9] & 255) << 8 | (c[10] & 255) << 16 | (c[11] & 255) << 24, j11 = k[16] & 255 | (k[17] & 255) << 8 | (k[18] & 255) << 16 | (k[19] & 255) << 24, j12 = k[20] & 255 | (k[21] & 255) << 8 | (k[22] & 255) << 16 | (k[23] & 255) << 24, j13 = k[24] & 255 | (k[25] & 255) << 8 | (k[26] & 255) << 16 | (k[27] & 255) << 24, j14 = k[28] & 255 | (k[29] & 255) << 8 | (k[30] & 255) << 16 | (k[31] & 255) << 24, j15 = c[12] & 255 | (c[13] & 255) << 8 | (c[14] & 255) << 16 | (c[15] & 255) << 24;
          var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7, x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14, x15 = j15, u;
          for (var i = 0; i < 20; i += 2) {
            u = x0 + x12 | 0;
            x4 ^= u << 7 | u >>> 32 - 7;
            u = x4 + x0 | 0;
            x8 ^= u << 9 | u >>> 32 - 9;
            u = x8 + x4 | 0;
            x12 ^= u << 13 | u >>> 32 - 13;
            u = x12 + x8 | 0;
            x0 ^= u << 18 | u >>> 32 - 18;
            u = x5 + x1 | 0;
            x9 ^= u << 7 | u >>> 32 - 7;
            u = x9 + x5 | 0;
            x13 ^= u << 9 | u >>> 32 - 9;
            u = x13 + x9 | 0;
            x1 ^= u << 13 | u >>> 32 - 13;
            u = x1 + x13 | 0;
            x5 ^= u << 18 | u >>> 32 - 18;
            u = x10 + x6 | 0;
            x14 ^= u << 7 | u >>> 32 - 7;
            u = x14 + x10 | 0;
            x2 ^= u << 9 | u >>> 32 - 9;
            u = x2 + x14 | 0;
            x6 ^= u << 13 | u >>> 32 - 13;
            u = x6 + x2 | 0;
            x10 ^= u << 18 | u >>> 32 - 18;
            u = x15 + x11 | 0;
            x3 ^= u << 7 | u >>> 32 - 7;
            u = x3 + x15 | 0;
            x7 ^= u << 9 | u >>> 32 - 9;
            u = x7 + x3 | 0;
            x11 ^= u << 13 | u >>> 32 - 13;
            u = x11 + x7 | 0;
            x15 ^= u << 18 | u >>> 32 - 18;
            u = x0 + x3 | 0;
            x1 ^= u << 7 | u >>> 32 - 7;
            u = x1 + x0 | 0;
            x2 ^= u << 9 | u >>> 32 - 9;
            u = x2 + x1 | 0;
            x3 ^= u << 13 | u >>> 32 - 13;
            u = x3 + x2 | 0;
            x0 ^= u << 18 | u >>> 32 - 18;
            u = x5 + x4 | 0;
            x6 ^= u << 7 | u >>> 32 - 7;
            u = x6 + x5 | 0;
            x7 ^= u << 9 | u >>> 32 - 9;
            u = x7 + x6 | 0;
            x4 ^= u << 13 | u >>> 32 - 13;
            u = x4 + x7 | 0;
            x5 ^= u << 18 | u >>> 32 - 18;
            u = x10 + x9 | 0;
            x11 ^= u << 7 | u >>> 32 - 7;
            u = x11 + x10 | 0;
            x8 ^= u << 9 | u >>> 32 - 9;
            u = x8 + x11 | 0;
            x9 ^= u << 13 | u >>> 32 - 13;
            u = x9 + x8 | 0;
            x10 ^= u << 18 | u >>> 32 - 18;
            u = x15 + x14 | 0;
            x12 ^= u << 7 | u >>> 32 - 7;
            u = x12 + x15 | 0;
            x13 ^= u << 9 | u >>> 32 - 9;
            u = x13 + x12 | 0;
            x14 ^= u << 13 | u >>> 32 - 13;
            u = x14 + x13 | 0;
            x15 ^= u << 18 | u >>> 32 - 18;
          }
          x0 = x0 + j0 | 0;
          x1 = x1 + j1 | 0;
          x2 = x2 + j2 | 0;
          x3 = x3 + j3 | 0;
          x4 = x4 + j4 | 0;
          x5 = x5 + j5 | 0;
          x6 = x6 + j6 | 0;
          x7 = x7 + j7 | 0;
          x8 = x8 + j8 | 0;
          x9 = x9 + j9 | 0;
          x10 = x10 + j10 | 0;
          x11 = x11 + j11 | 0;
          x12 = x12 + j12 | 0;
          x13 = x13 + j13 | 0;
          x14 = x14 + j14 | 0;
          x15 = x15 + j15 | 0;
          o[0] = x0 >>> 0 & 255;
          o[1] = x0 >>> 8 & 255;
          o[2] = x0 >>> 16 & 255;
          o[3] = x0 >>> 24 & 255;
          o[4] = x1 >>> 0 & 255;
          o[5] = x1 >>> 8 & 255;
          o[6] = x1 >>> 16 & 255;
          o[7] = x1 >>> 24 & 255;
          o[8] = x2 >>> 0 & 255;
          o[9] = x2 >>> 8 & 255;
          o[10] = x2 >>> 16 & 255;
          o[11] = x2 >>> 24 & 255;
          o[12] = x3 >>> 0 & 255;
          o[13] = x3 >>> 8 & 255;
          o[14] = x3 >>> 16 & 255;
          o[15] = x3 >>> 24 & 255;
          o[16] = x4 >>> 0 & 255;
          o[17] = x4 >>> 8 & 255;
          o[18] = x4 >>> 16 & 255;
          o[19] = x4 >>> 24 & 255;
          o[20] = x5 >>> 0 & 255;
          o[21] = x5 >>> 8 & 255;
          o[22] = x5 >>> 16 & 255;
          o[23] = x5 >>> 24 & 255;
          o[24] = x6 >>> 0 & 255;
          o[25] = x6 >>> 8 & 255;
          o[26] = x6 >>> 16 & 255;
          o[27] = x6 >>> 24 & 255;
          o[28] = x7 >>> 0 & 255;
          o[29] = x7 >>> 8 & 255;
          o[30] = x7 >>> 16 & 255;
          o[31] = x7 >>> 24 & 255;
          o[32] = x8 >>> 0 & 255;
          o[33] = x8 >>> 8 & 255;
          o[34] = x8 >>> 16 & 255;
          o[35] = x8 >>> 24 & 255;
          o[36] = x9 >>> 0 & 255;
          o[37] = x9 >>> 8 & 255;
          o[38] = x9 >>> 16 & 255;
          o[39] = x9 >>> 24 & 255;
          o[40] = x10 >>> 0 & 255;
          o[41] = x10 >>> 8 & 255;
          o[42] = x10 >>> 16 & 255;
          o[43] = x10 >>> 24 & 255;
          o[44] = x11 >>> 0 & 255;
          o[45] = x11 >>> 8 & 255;
          o[46] = x11 >>> 16 & 255;
          o[47] = x11 >>> 24 & 255;
          o[48] = x12 >>> 0 & 255;
          o[49] = x12 >>> 8 & 255;
          o[50] = x12 >>> 16 & 255;
          o[51] = x12 >>> 24 & 255;
          o[52] = x13 >>> 0 & 255;
          o[53] = x13 >>> 8 & 255;
          o[54] = x13 >>> 16 & 255;
          o[55] = x13 >>> 24 & 255;
          o[56] = x14 >>> 0 & 255;
          o[57] = x14 >>> 8 & 255;
          o[58] = x14 >>> 16 & 255;
          o[59] = x14 >>> 24 & 255;
          o[60] = x15 >>> 0 & 255;
          o[61] = x15 >>> 8 & 255;
          o[62] = x15 >>> 16 & 255;
          o[63] = x15 >>> 24 & 255;
        }
        function core_hsalsa20(o, p, k, c) {
          var j0 = c[0] & 255 | (c[1] & 255) << 8 | (c[2] & 255) << 16 | (c[3] & 255) << 24, j1 = k[0] & 255 | (k[1] & 255) << 8 | (k[2] & 255) << 16 | (k[3] & 255) << 24, j2 = k[4] & 255 | (k[5] & 255) << 8 | (k[6] & 255) << 16 | (k[7] & 255) << 24, j3 = k[8] & 255 | (k[9] & 255) << 8 | (k[10] & 255) << 16 | (k[11] & 255) << 24, j4 = k[12] & 255 | (k[13] & 255) << 8 | (k[14] & 255) << 16 | (k[15] & 255) << 24, j5 = c[4] & 255 | (c[5] & 255) << 8 | (c[6] & 255) << 16 | (c[7] & 255) << 24, j6 = p[0] & 255 | (p[1] & 255) << 8 | (p[2] & 255) << 16 | (p[3] & 255) << 24, j7 = p[4] & 255 | (p[5] & 255) << 8 | (p[6] & 255) << 16 | (p[7] & 255) << 24, j8 = p[8] & 255 | (p[9] & 255) << 8 | (p[10] & 255) << 16 | (p[11] & 255) << 24, j9 = p[12] & 255 | (p[13] & 255) << 8 | (p[14] & 255) << 16 | (p[15] & 255) << 24, j10 = c[8] & 255 | (c[9] & 255) << 8 | (c[10] & 255) << 16 | (c[11] & 255) << 24, j11 = k[16] & 255 | (k[17] & 255) << 8 | (k[18] & 255) << 16 | (k[19] & 255) << 24, j12 = k[20] & 255 | (k[21] & 255) << 8 | (k[22] & 255) << 16 | (k[23] & 255) << 24, j13 = k[24] & 255 | (k[25] & 255) << 8 | (k[26] & 255) << 16 | (k[27] & 255) << 24, j14 = k[28] & 255 | (k[29] & 255) << 8 | (k[30] & 255) << 16 | (k[31] & 255) << 24, j15 = c[12] & 255 | (c[13] & 255) << 8 | (c[14] & 255) << 16 | (c[15] & 255) << 24;
          var x0 = j0, x1 = j1, x2 = j2, x3 = j3, x4 = j4, x5 = j5, x6 = j6, x7 = j7, x8 = j8, x9 = j9, x10 = j10, x11 = j11, x12 = j12, x13 = j13, x14 = j14, x15 = j15, u;
          for (var i = 0; i < 20; i += 2) {
            u = x0 + x12 | 0;
            x4 ^= u << 7 | u >>> 32 - 7;
            u = x4 + x0 | 0;
            x8 ^= u << 9 | u >>> 32 - 9;
            u = x8 + x4 | 0;
            x12 ^= u << 13 | u >>> 32 - 13;
            u = x12 + x8 | 0;
            x0 ^= u << 18 | u >>> 32 - 18;
            u = x5 + x1 | 0;
            x9 ^= u << 7 | u >>> 32 - 7;
            u = x9 + x5 | 0;
            x13 ^= u << 9 | u >>> 32 - 9;
            u = x13 + x9 | 0;
            x1 ^= u << 13 | u >>> 32 - 13;
            u = x1 + x13 | 0;
            x5 ^= u << 18 | u >>> 32 - 18;
            u = x10 + x6 | 0;
            x14 ^= u << 7 | u >>> 32 - 7;
            u = x14 + x10 | 0;
            x2 ^= u << 9 | u >>> 32 - 9;
            u = x2 + x14 | 0;
            x6 ^= u << 13 | u >>> 32 - 13;
            u = x6 + x2 | 0;
            x10 ^= u << 18 | u >>> 32 - 18;
            u = x15 + x11 | 0;
            x3 ^= u << 7 | u >>> 32 - 7;
            u = x3 + x15 | 0;
            x7 ^= u << 9 | u >>> 32 - 9;
            u = x7 + x3 | 0;
            x11 ^= u << 13 | u >>> 32 - 13;
            u = x11 + x7 | 0;
            x15 ^= u << 18 | u >>> 32 - 18;
            u = x0 + x3 | 0;
            x1 ^= u << 7 | u >>> 32 - 7;
            u = x1 + x0 | 0;
            x2 ^= u << 9 | u >>> 32 - 9;
            u = x2 + x1 | 0;
            x3 ^= u << 13 | u >>> 32 - 13;
            u = x3 + x2 | 0;
            x0 ^= u << 18 | u >>> 32 - 18;
            u = x5 + x4 | 0;
            x6 ^= u << 7 | u >>> 32 - 7;
            u = x6 + x5 | 0;
            x7 ^= u << 9 | u >>> 32 - 9;
            u = x7 + x6 | 0;
            x4 ^= u << 13 | u >>> 32 - 13;
            u = x4 + x7 | 0;
            x5 ^= u << 18 | u >>> 32 - 18;
            u = x10 + x9 | 0;
            x11 ^= u << 7 | u >>> 32 - 7;
            u = x11 + x10 | 0;
            x8 ^= u << 9 | u >>> 32 - 9;
            u = x8 + x11 | 0;
            x9 ^= u << 13 | u >>> 32 - 13;
            u = x9 + x8 | 0;
            x10 ^= u << 18 | u >>> 32 - 18;
            u = x15 + x14 | 0;
            x12 ^= u << 7 | u >>> 32 - 7;
            u = x12 + x15 | 0;
            x13 ^= u << 9 | u >>> 32 - 9;
            u = x13 + x12 | 0;
            x14 ^= u << 13 | u >>> 32 - 13;
            u = x14 + x13 | 0;
            x15 ^= u << 18 | u >>> 32 - 18;
          }
          o[0] = x0 >>> 0 & 255;
          o[1] = x0 >>> 8 & 255;
          o[2] = x0 >>> 16 & 255;
          o[3] = x0 >>> 24 & 255;
          o[4] = x5 >>> 0 & 255;
          o[5] = x5 >>> 8 & 255;
          o[6] = x5 >>> 16 & 255;
          o[7] = x5 >>> 24 & 255;
          o[8] = x10 >>> 0 & 255;
          o[9] = x10 >>> 8 & 255;
          o[10] = x10 >>> 16 & 255;
          o[11] = x10 >>> 24 & 255;
          o[12] = x15 >>> 0 & 255;
          o[13] = x15 >>> 8 & 255;
          o[14] = x15 >>> 16 & 255;
          o[15] = x15 >>> 24 & 255;
          o[16] = x6 >>> 0 & 255;
          o[17] = x6 >>> 8 & 255;
          o[18] = x6 >>> 16 & 255;
          o[19] = x6 >>> 24 & 255;
          o[20] = x7 >>> 0 & 255;
          o[21] = x7 >>> 8 & 255;
          o[22] = x7 >>> 16 & 255;
          o[23] = x7 >>> 24 & 255;
          o[24] = x8 >>> 0 & 255;
          o[25] = x8 >>> 8 & 255;
          o[26] = x8 >>> 16 & 255;
          o[27] = x8 >>> 24 & 255;
          o[28] = x9 >>> 0 & 255;
          o[29] = x9 >>> 8 & 255;
          o[30] = x9 >>> 16 & 255;
          o[31] = x9 >>> 24 & 255;
        }
        function crypto_core_salsa20(out, inp, k, c) {
          core_salsa20(out, inp, k, c);
        }
        function crypto_core_hsalsa20(out, inp, k, c) {
          core_hsalsa20(out, inp, k, c);
        }
        var sigma = new Uint8Array([101, 120, 112, 97, 110, 100, 32, 51, 50, 45, 98, 121, 116, 101, 32, 107]);
        function crypto_stream_salsa20_xor(c, cpos, m, mpos, b, n, k) {
          var z = new Uint8Array(16), x = new Uint8Array(64);
          var u, i;
          for (i = 0; i < 16; i++) z[i] = 0;
          for (i = 0; i < 8; i++) z[i] = n[i];
          while (b >= 64) {
            crypto_core_salsa20(x, z, k, sigma);
            for (i = 0; i < 64; i++) c[cpos + i] = m[mpos + i] ^ x[i];
            u = 1;
            for (i = 8; i < 16; i++) {
              u = u + (z[i] & 255) | 0;
              z[i] = u & 255;
              u >>>= 8;
            }
            b -= 64;
            cpos += 64;
            mpos += 64;
          }
          if (b > 0) {
            crypto_core_salsa20(x, z, k, sigma);
            for (i = 0; i < b; i++) c[cpos + i] = m[mpos + i] ^ x[i];
          }
          return 0;
        }
        function crypto_stream_salsa20(c, cpos, b, n, k) {
          var z = new Uint8Array(16), x = new Uint8Array(64);
          var u, i;
          for (i = 0; i < 16; i++) z[i] = 0;
          for (i = 0; i < 8; i++) z[i] = n[i];
          while (b >= 64) {
            crypto_core_salsa20(x, z, k, sigma);
            for (i = 0; i < 64; i++) c[cpos + i] = x[i];
            u = 1;
            for (i = 8; i < 16; i++) {
              u = u + (z[i] & 255) | 0;
              z[i] = u & 255;
              u >>>= 8;
            }
            b -= 64;
            cpos += 64;
          }
          if (b > 0) {
            crypto_core_salsa20(x, z, k, sigma);
            for (i = 0; i < b; i++) c[cpos + i] = x[i];
          }
          return 0;
        }
        function crypto_stream(c, cpos, d, n, k) {
          var s = new Uint8Array(32);
          crypto_core_hsalsa20(s, n, k, sigma);
          var sn = new Uint8Array(8);
          for (var i = 0; i < 8; i++) sn[i] = n[i + 16];
          return crypto_stream_salsa20(c, cpos, d, sn, s);
        }
        function crypto_stream_xor(c, cpos, m, mpos, d, n, k) {
          var s = new Uint8Array(32);
          crypto_core_hsalsa20(s, n, k, sigma);
          var sn = new Uint8Array(8);
          for (var i = 0; i < 8; i++) sn[i] = n[i + 16];
          return crypto_stream_salsa20_xor(c, cpos, m, mpos, d, sn, s);
        }
        var poly1305 = function(key) {
          this.buffer = new Uint8Array(16);
          this.r = new Uint16Array(10);
          this.h = new Uint16Array(10);
          this.pad = new Uint16Array(8);
          this.leftover = 0;
          this.fin = 0;
          var t0, t1, t2, t3, t4, t5, t6, t7;
          t0 = key[0] & 255 | (key[1] & 255) << 8;
          this.r[0] = t0 & 8191;
          t1 = key[2] & 255 | (key[3] & 255) << 8;
          this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
          t2 = key[4] & 255 | (key[5] & 255) << 8;
          this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
          t3 = key[6] & 255 | (key[7] & 255) << 8;
          this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
          t4 = key[8] & 255 | (key[9] & 255) << 8;
          this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
          this.r[5] = t4 >>> 1 & 8190;
          t5 = key[10] & 255 | (key[11] & 255) << 8;
          this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
          t6 = key[12] & 255 | (key[13] & 255) << 8;
          this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
          t7 = key[14] & 255 | (key[15] & 255) << 8;
          this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
          this.r[9] = t7 >>> 5 & 127;
          this.pad[0] = key[16] & 255 | (key[17] & 255) << 8;
          this.pad[1] = key[18] & 255 | (key[19] & 255) << 8;
          this.pad[2] = key[20] & 255 | (key[21] & 255) << 8;
          this.pad[3] = key[22] & 255 | (key[23] & 255) << 8;
          this.pad[4] = key[24] & 255 | (key[25] & 255) << 8;
          this.pad[5] = key[26] & 255 | (key[27] & 255) << 8;
          this.pad[6] = key[28] & 255 | (key[29] & 255) << 8;
          this.pad[7] = key[30] & 255 | (key[31] & 255) << 8;
        };
        poly1305.prototype.blocks = function(m, mpos, bytes) {
          var hibit = this.fin ? 0 : 1 << 11;
          var t0, t1, t2, t3, t4, t5, t6, t7, c;
          var d0, d1, d2, d3, d4, d5, d6, d7, d8, d9;
          var h0 = this.h[0], h1 = this.h[1], h2 = this.h[2], h3 = this.h[3], h4 = this.h[4], h5 = this.h[5], h6 = this.h[6], h7 = this.h[7], h8 = this.h[8], h9 = this.h[9];
          var r0 = this.r[0], r1 = this.r[1], r2 = this.r[2], r3 = this.r[3], r4 = this.r[4], r5 = this.r[5], r6 = this.r[6], r7 = this.r[7], r8 = this.r[8], r9 = this.r[9];
          while (bytes >= 16) {
            t0 = m[mpos + 0] & 255 | (m[mpos + 1] & 255) << 8;
            h0 += t0 & 8191;
            t1 = m[mpos + 2] & 255 | (m[mpos + 3] & 255) << 8;
            h1 += (t0 >>> 13 | t1 << 3) & 8191;
            t2 = m[mpos + 4] & 255 | (m[mpos + 5] & 255) << 8;
            h2 += (t1 >>> 10 | t2 << 6) & 8191;
            t3 = m[mpos + 6] & 255 | (m[mpos + 7] & 255) << 8;
            h3 += (t2 >>> 7 | t3 << 9) & 8191;
            t4 = m[mpos + 8] & 255 | (m[mpos + 9] & 255) << 8;
            h4 += (t3 >>> 4 | t4 << 12) & 8191;
            h5 += t4 >>> 1 & 8191;
            t5 = m[mpos + 10] & 255 | (m[mpos + 11] & 255) << 8;
            h6 += (t4 >>> 14 | t5 << 2) & 8191;
            t6 = m[mpos + 12] & 255 | (m[mpos + 13] & 255) << 8;
            h7 += (t5 >>> 11 | t6 << 5) & 8191;
            t7 = m[mpos + 14] & 255 | (m[mpos + 15] & 255) << 8;
            h8 += (t6 >>> 8 | t7 << 8) & 8191;
            h9 += t7 >>> 5 | hibit;
            c = 0;
            d0 = c;
            d0 += h0 * r0;
            d0 += h1 * (5 * r9);
            d0 += h2 * (5 * r8);
            d0 += h3 * (5 * r7);
            d0 += h4 * (5 * r6);
            c = d0 >>> 13;
            d0 &= 8191;
            d0 += h5 * (5 * r5);
            d0 += h6 * (5 * r4);
            d0 += h7 * (5 * r3);
            d0 += h8 * (5 * r2);
            d0 += h9 * (5 * r1);
            c += d0 >>> 13;
            d0 &= 8191;
            d1 = c;
            d1 += h0 * r1;
            d1 += h1 * r0;
            d1 += h2 * (5 * r9);
            d1 += h3 * (5 * r8);
            d1 += h4 * (5 * r7);
            c = d1 >>> 13;
            d1 &= 8191;
            d1 += h5 * (5 * r6);
            d1 += h6 * (5 * r5);
            d1 += h7 * (5 * r4);
            d1 += h8 * (5 * r3);
            d1 += h9 * (5 * r2);
            c += d1 >>> 13;
            d1 &= 8191;
            d2 = c;
            d2 += h0 * r2;
            d2 += h1 * r1;
            d2 += h2 * r0;
            d2 += h3 * (5 * r9);
            d2 += h4 * (5 * r8);
            c = d2 >>> 13;
            d2 &= 8191;
            d2 += h5 * (5 * r7);
            d2 += h6 * (5 * r6);
            d2 += h7 * (5 * r5);
            d2 += h8 * (5 * r4);
            d2 += h9 * (5 * r3);
            c += d2 >>> 13;
            d2 &= 8191;
            d3 = c;
            d3 += h0 * r3;
            d3 += h1 * r2;
            d3 += h2 * r1;
            d3 += h3 * r0;
            d3 += h4 * (5 * r9);
            c = d3 >>> 13;
            d3 &= 8191;
            d3 += h5 * (5 * r8);
            d3 += h6 * (5 * r7);
            d3 += h7 * (5 * r6);
            d3 += h8 * (5 * r5);
            d3 += h9 * (5 * r4);
            c += d3 >>> 13;
            d3 &= 8191;
            d4 = c;
            d4 += h0 * r4;
            d4 += h1 * r3;
            d4 += h2 * r2;
            d4 += h3 * r1;
            d4 += h4 * r0;
            c = d4 >>> 13;
            d4 &= 8191;
            d4 += h5 * (5 * r9);
            d4 += h6 * (5 * r8);
            d4 += h7 * (5 * r7);
            d4 += h8 * (5 * r6);
            d4 += h9 * (5 * r5);
            c += d4 >>> 13;
            d4 &= 8191;
            d5 = c;
            d5 += h0 * r5;
            d5 += h1 * r4;
            d5 += h2 * r3;
            d5 += h3 * r2;
            d5 += h4 * r1;
            c = d5 >>> 13;
            d5 &= 8191;
            d5 += h5 * r0;
            d5 += h6 * (5 * r9);
            d5 += h7 * (5 * r8);
            d5 += h8 * (5 * r7);
            d5 += h9 * (5 * r6);
            c += d5 >>> 13;
            d5 &= 8191;
            d6 = c;
            d6 += h0 * r6;
            d6 += h1 * r5;
            d6 += h2 * r4;
            d6 += h3 * r3;
            d6 += h4 * r2;
            c = d6 >>> 13;
            d6 &= 8191;
            d6 += h5 * r1;
            d6 += h6 * r0;
            d6 += h7 * (5 * r9);
            d6 += h8 * (5 * r8);
            d6 += h9 * (5 * r7);
            c += d6 >>> 13;
            d6 &= 8191;
            d7 = c;
            d7 += h0 * r7;
            d7 += h1 * r6;
            d7 += h2 * r5;
            d7 += h3 * r4;
            d7 += h4 * r3;
            c = d7 >>> 13;
            d7 &= 8191;
            d7 += h5 * r2;
            d7 += h6 * r1;
            d7 += h7 * r0;
            d7 += h8 * (5 * r9);
            d7 += h9 * (5 * r8);
            c += d7 >>> 13;
            d7 &= 8191;
            d8 = c;
            d8 += h0 * r8;
            d8 += h1 * r7;
            d8 += h2 * r6;
            d8 += h3 * r5;
            d8 += h4 * r4;
            c = d8 >>> 13;
            d8 &= 8191;
            d8 += h5 * r3;
            d8 += h6 * r2;
            d8 += h7 * r1;
            d8 += h8 * r0;
            d8 += h9 * (5 * r9);
            c += d8 >>> 13;
            d8 &= 8191;
            d9 = c;
            d9 += h0 * r9;
            d9 += h1 * r8;
            d9 += h2 * r7;
            d9 += h3 * r6;
            d9 += h4 * r5;
            c = d9 >>> 13;
            d9 &= 8191;
            d9 += h5 * r4;
            d9 += h6 * r3;
            d9 += h7 * r2;
            d9 += h8 * r1;
            d9 += h9 * r0;
            c += d9 >>> 13;
            d9 &= 8191;
            c = (c << 2) + c | 0;
            c = c + d0 | 0;
            d0 = c & 8191;
            c = c >>> 13;
            d1 += c;
            h0 = d0;
            h1 = d1;
            h2 = d2;
            h3 = d3;
            h4 = d4;
            h5 = d5;
            h6 = d6;
            h7 = d7;
            h8 = d8;
            h9 = d9;
            mpos += 16;
            bytes -= 16;
          }
          this.h[0] = h0;
          this.h[1] = h1;
          this.h[2] = h2;
          this.h[3] = h3;
          this.h[4] = h4;
          this.h[5] = h5;
          this.h[6] = h6;
          this.h[7] = h7;
          this.h[8] = h8;
          this.h[9] = h9;
        };
        poly1305.prototype.finish = function(mac, macpos) {
          var g = new Uint16Array(10);
          var c, mask, f, i;
          if (this.leftover) {
            i = this.leftover;
            this.buffer[i++] = 1;
            for (; i < 16; i++) this.buffer[i] = 0;
            this.fin = 1;
            this.blocks(this.buffer, 0, 16);
          }
          c = this.h[1] >>> 13;
          this.h[1] &= 8191;
          for (i = 2; i < 10; i++) {
            this.h[i] += c;
            c = this.h[i] >>> 13;
            this.h[i] &= 8191;
          }
          this.h[0] += c * 5;
          c = this.h[0] >>> 13;
          this.h[0] &= 8191;
          this.h[1] += c;
          c = this.h[1] >>> 13;
          this.h[1] &= 8191;
          this.h[2] += c;
          g[0] = this.h[0] + 5;
          c = g[0] >>> 13;
          g[0] &= 8191;
          for (i = 1; i < 10; i++) {
            g[i] = this.h[i] + c;
            c = g[i] >>> 13;
            g[i] &= 8191;
          }
          g[9] -= 1 << 13;
          mask = (c ^ 1) - 1;
          for (i = 0; i < 10; i++) g[i] &= mask;
          mask = ~mask;
          for (i = 0; i < 10; i++) this.h[i] = this.h[i] & mask | g[i];
          this.h[0] = (this.h[0] | this.h[1] << 13) & 65535;
          this.h[1] = (this.h[1] >>> 3 | this.h[2] << 10) & 65535;
          this.h[2] = (this.h[2] >>> 6 | this.h[3] << 7) & 65535;
          this.h[3] = (this.h[3] >>> 9 | this.h[4] << 4) & 65535;
          this.h[4] = (this.h[4] >>> 12 | this.h[5] << 1 | this.h[6] << 14) & 65535;
          this.h[5] = (this.h[6] >>> 2 | this.h[7] << 11) & 65535;
          this.h[6] = (this.h[7] >>> 5 | this.h[8] << 8) & 65535;
          this.h[7] = (this.h[8] >>> 8 | this.h[9] << 5) & 65535;
          f = this.h[0] + this.pad[0];
          this.h[0] = f & 65535;
          for (i = 1; i < 8; i++) {
            f = (this.h[i] + this.pad[i] | 0) + (f >>> 16) | 0;
            this.h[i] = f & 65535;
          }
          mac[macpos + 0] = this.h[0] >>> 0 & 255;
          mac[macpos + 1] = this.h[0] >>> 8 & 255;
          mac[macpos + 2] = this.h[1] >>> 0 & 255;
          mac[macpos + 3] = this.h[1] >>> 8 & 255;
          mac[macpos + 4] = this.h[2] >>> 0 & 255;
          mac[macpos + 5] = this.h[2] >>> 8 & 255;
          mac[macpos + 6] = this.h[3] >>> 0 & 255;
          mac[macpos + 7] = this.h[3] >>> 8 & 255;
          mac[macpos + 8] = this.h[4] >>> 0 & 255;
          mac[macpos + 9] = this.h[4] >>> 8 & 255;
          mac[macpos + 10] = this.h[5] >>> 0 & 255;
          mac[macpos + 11] = this.h[5] >>> 8 & 255;
          mac[macpos + 12] = this.h[6] >>> 0 & 255;
          mac[macpos + 13] = this.h[6] >>> 8 & 255;
          mac[macpos + 14] = this.h[7] >>> 0 & 255;
          mac[macpos + 15] = this.h[7] >>> 8 & 255;
        };
        poly1305.prototype.update = function(m, mpos, bytes) {
          var i, want;
          if (this.leftover) {
            want = 16 - this.leftover;
            if (want > bytes)
              want = bytes;
            for (i = 0; i < want; i++)
              this.buffer[this.leftover + i] = m[mpos + i];
            bytes -= want;
            mpos += want;
            this.leftover += want;
            if (this.leftover < 16)
              return;
            this.blocks(this.buffer, 0, 16);
            this.leftover = 0;
          }
          if (bytes >= 16) {
            want = bytes - bytes % 16;
            this.blocks(m, mpos, want);
            mpos += want;
            bytes -= want;
          }
          if (bytes) {
            for (i = 0; i < bytes; i++)
              this.buffer[this.leftover + i] = m[mpos + i];
            this.leftover += bytes;
          }
        };
        function crypto_onetimeauth(out, outpos, m, mpos, n, k) {
          var s = new poly1305(k);
          s.update(m, mpos, n);
          s.finish(out, outpos);
          return 0;
        }
        function crypto_onetimeauth_verify(h, hpos, m, mpos, n, k) {
          var x = new Uint8Array(16);
          crypto_onetimeauth(x, 0, m, mpos, n, k);
          return crypto_verify_16(h, hpos, x, 0);
        }
        function crypto_secretbox(c, m, d, n, k) {
          var i;
          if (d < 32) return -1;
          crypto_stream_xor(c, 0, m, 0, d, n, k);
          crypto_onetimeauth(c, 16, c, 32, d - 32, c);
          for (i = 0; i < 16; i++) c[i] = 0;
          return 0;
        }
        function crypto_secretbox_open(m, c, d, n, k) {
          var i;
          var x = new Uint8Array(32);
          if (d < 32) return -1;
          crypto_stream(x, 0, 32, n, k);
          if (crypto_onetimeauth_verify(c, 16, c, 32, d - 32, x) !== 0) return -1;
          crypto_stream_xor(m, 0, c, 0, d, n, k);
          for (i = 0; i < 32; i++) m[i] = 0;
          return 0;
        }
        function set25519(r, a) {
          var i;
          for (i = 0; i < 16; i++) r[i] = a[i] | 0;
        }
        function car25519(o) {
          var i, v, c = 1;
          for (i = 0; i < 16; i++) {
            v = o[i] + c + 65535;
            c = Math.floor(v / 65536);
            o[i] = v - c * 65536;
          }
          o[0] += c - 1 + 37 * (c - 1);
        }
        function sel25519(p, q, b) {
          var t, c = ~(b - 1);
          for (var i = 0; i < 16; i++) {
            t = c & (p[i] ^ q[i]);
            p[i] ^= t;
            q[i] ^= t;
          }
        }
        function pack25519(o, n) {
          var i, j, b;
          var m = gf(), t = gf();
          for (i = 0; i < 16; i++) t[i] = n[i];
          car25519(t);
          car25519(t);
          car25519(t);
          for (j = 0; j < 2; j++) {
            m[0] = t[0] - 65517;
            for (i = 1; i < 15; i++) {
              m[i] = t[i] - 65535 - (m[i - 1] >> 16 & 1);
              m[i - 1] &= 65535;
            }
            m[15] = t[15] - 32767 - (m[14] >> 16 & 1);
            b = m[15] >> 16 & 1;
            m[14] &= 65535;
            sel25519(t, m, 1 - b);
          }
          for (i = 0; i < 16; i++) {
            o[2 * i] = t[i] & 255;
            o[2 * i + 1] = t[i] >> 8;
          }
        }
        function neq25519(a, b) {
          var c = new Uint8Array(32), d = new Uint8Array(32);
          pack25519(c, a);
          pack25519(d, b);
          return crypto_verify_32(c, 0, d, 0);
        }
        function par25519(a) {
          var d = new Uint8Array(32);
          pack25519(d, a);
          return d[0] & 1;
        }
        function unpack25519(o, n) {
          var i;
          for (i = 0; i < 16; i++) o[i] = n[2 * i] + (n[2 * i + 1] << 8);
          o[15] &= 32767;
        }
        function A(o, a, b) {
          for (var i = 0; i < 16; i++) o[i] = a[i] + b[i];
        }
        function Z(o, a, b) {
          for (var i = 0; i < 16; i++) o[i] = a[i] - b[i];
        }
        function M(o, a, b) {
          var v, c, t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0, t7 = 0, t8 = 0, t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0, t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0, t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0, b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7], b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11], b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15];
          v = a[0];
          t0 += v * b0;
          t1 += v * b1;
          t2 += v * b2;
          t3 += v * b3;
          t4 += v * b4;
          t5 += v * b5;
          t6 += v * b6;
          t7 += v * b7;
          t8 += v * b8;
          t9 += v * b9;
          t10 += v * b10;
          t11 += v * b11;
          t12 += v * b12;
          t13 += v * b13;
          t14 += v * b14;
          t15 += v * b15;
          v = a[1];
          t1 += v * b0;
          t2 += v * b1;
          t3 += v * b2;
          t4 += v * b3;
          t5 += v * b4;
          t6 += v * b5;
          t7 += v * b6;
          t8 += v * b7;
          t9 += v * b8;
          t10 += v * b9;
          t11 += v * b10;
          t12 += v * b11;
          t13 += v * b12;
          t14 += v * b13;
          t15 += v * b14;
          t16 += v * b15;
          v = a[2];
          t2 += v * b0;
          t3 += v * b1;
          t4 += v * b2;
          t5 += v * b3;
          t6 += v * b4;
          t7 += v * b5;
          t8 += v * b6;
          t9 += v * b7;
          t10 += v * b8;
          t11 += v * b9;
          t12 += v * b10;
          t13 += v * b11;
          t14 += v * b12;
          t15 += v * b13;
          t16 += v * b14;
          t17 += v * b15;
          v = a[3];
          t3 += v * b0;
          t4 += v * b1;
          t5 += v * b2;
          t6 += v * b3;
          t7 += v * b4;
          t8 += v * b5;
          t9 += v * b6;
          t10 += v * b7;
          t11 += v * b8;
          t12 += v * b9;
          t13 += v * b10;
          t14 += v * b11;
          t15 += v * b12;
          t16 += v * b13;
          t17 += v * b14;
          t18 += v * b15;
          v = a[4];
          t4 += v * b0;
          t5 += v * b1;
          t6 += v * b2;
          t7 += v * b3;
          t8 += v * b4;
          t9 += v * b5;
          t10 += v * b6;
          t11 += v * b7;
          t12 += v * b8;
          t13 += v * b9;
          t14 += v * b10;
          t15 += v * b11;
          t16 += v * b12;
          t17 += v * b13;
          t18 += v * b14;
          t19 += v * b15;
          v = a[5];
          t5 += v * b0;
          t6 += v * b1;
          t7 += v * b2;
          t8 += v * b3;
          t9 += v * b4;
          t10 += v * b5;
          t11 += v * b6;
          t12 += v * b7;
          t13 += v * b8;
          t14 += v * b9;
          t15 += v * b10;
          t16 += v * b11;
          t17 += v * b12;
          t18 += v * b13;
          t19 += v * b14;
          t20 += v * b15;
          v = a[6];
          t6 += v * b0;
          t7 += v * b1;
          t8 += v * b2;
          t9 += v * b3;
          t10 += v * b4;
          t11 += v * b5;
          t12 += v * b6;
          t13 += v * b7;
          t14 += v * b8;
          t15 += v * b9;
          t16 += v * b10;
          t17 += v * b11;
          t18 += v * b12;
          t19 += v * b13;
          t20 += v * b14;
          t21 += v * b15;
          v = a[7];
          t7 += v * b0;
          t8 += v * b1;
          t9 += v * b2;
          t10 += v * b3;
          t11 += v * b4;
          t12 += v * b5;
          t13 += v * b6;
          t14 += v * b7;
          t15 += v * b8;
          t16 += v * b9;
          t17 += v * b10;
          t18 += v * b11;
          t19 += v * b12;
          t20 += v * b13;
          t21 += v * b14;
          t22 += v * b15;
          v = a[8];
          t8 += v * b0;
          t9 += v * b1;
          t10 += v * b2;
          t11 += v * b3;
          t12 += v * b4;
          t13 += v * b5;
          t14 += v * b6;
          t15 += v * b7;
          t16 += v * b8;
          t17 += v * b9;
          t18 += v * b10;
          t19 += v * b11;
          t20 += v * b12;
          t21 += v * b13;
          t22 += v * b14;
          t23 += v * b15;
          v = a[9];
          t9 += v * b0;
          t10 += v * b1;
          t11 += v * b2;
          t12 += v * b3;
          t13 += v * b4;
          t14 += v * b5;
          t15 += v * b6;
          t16 += v * b7;
          t17 += v * b8;
          t18 += v * b9;
          t19 += v * b10;
          t20 += v * b11;
          t21 += v * b12;
          t22 += v * b13;
          t23 += v * b14;
          t24 += v * b15;
          v = a[10];
          t10 += v * b0;
          t11 += v * b1;
          t12 += v * b2;
          t13 += v * b3;
          t14 += v * b4;
          t15 += v * b5;
          t16 += v * b6;
          t17 += v * b7;
          t18 += v * b8;
          t19 += v * b9;
          t20 += v * b10;
          t21 += v * b11;
          t22 += v * b12;
          t23 += v * b13;
          t24 += v * b14;
          t25 += v * b15;
          v = a[11];
          t11 += v * b0;
          t12 += v * b1;
          t13 += v * b2;
          t14 += v * b3;
          t15 += v * b4;
          t16 += v * b5;
          t17 += v * b6;
          t18 += v * b7;
          t19 += v * b8;
          t20 += v * b9;
          t21 += v * b10;
          t22 += v * b11;
          t23 += v * b12;
          t24 += v * b13;
          t25 += v * b14;
          t26 += v * b15;
          v = a[12];
          t12 += v * b0;
          t13 += v * b1;
          t14 += v * b2;
          t15 += v * b3;
          t16 += v * b4;
          t17 += v * b5;
          t18 += v * b6;
          t19 += v * b7;
          t20 += v * b8;
          t21 += v * b9;
          t22 += v * b10;
          t23 += v * b11;
          t24 += v * b12;
          t25 += v * b13;
          t26 += v * b14;
          t27 += v * b15;
          v = a[13];
          t13 += v * b0;
          t14 += v * b1;
          t15 += v * b2;
          t16 += v * b3;
          t17 += v * b4;
          t18 += v * b5;
          t19 += v * b6;
          t20 += v * b7;
          t21 += v * b8;
          t22 += v * b9;
          t23 += v * b10;
          t24 += v * b11;
          t25 += v * b12;
          t26 += v * b13;
          t27 += v * b14;
          t28 += v * b15;
          v = a[14];
          t14 += v * b0;
          t15 += v * b1;
          t16 += v * b2;
          t17 += v * b3;
          t18 += v * b4;
          t19 += v * b5;
          t20 += v * b6;
          t21 += v * b7;
          t22 += v * b8;
          t23 += v * b9;
          t24 += v * b10;
          t25 += v * b11;
          t26 += v * b12;
          t27 += v * b13;
          t28 += v * b14;
          t29 += v * b15;
          v = a[15];
          t15 += v * b0;
          t16 += v * b1;
          t17 += v * b2;
          t18 += v * b3;
          t19 += v * b4;
          t20 += v * b5;
          t21 += v * b6;
          t22 += v * b7;
          t23 += v * b8;
          t24 += v * b9;
          t25 += v * b10;
          t26 += v * b11;
          t27 += v * b12;
          t28 += v * b13;
          t29 += v * b14;
          t30 += v * b15;
          t0 += 38 * t16;
          t1 += 38 * t17;
          t2 += 38 * t18;
          t3 += 38 * t19;
          t4 += 38 * t20;
          t5 += 38 * t21;
          t6 += 38 * t22;
          t7 += 38 * t23;
          t8 += 38 * t24;
          t9 += 38 * t25;
          t10 += 38 * t26;
          t11 += 38 * t27;
          t12 += 38 * t28;
          t13 += 38 * t29;
          t14 += 38 * t30;
          c = 1;
          v = t0 + c + 65535;
          c = Math.floor(v / 65536);
          t0 = v - c * 65536;
          v = t1 + c + 65535;
          c = Math.floor(v / 65536);
          t1 = v - c * 65536;
          v = t2 + c + 65535;
          c = Math.floor(v / 65536);
          t2 = v - c * 65536;
          v = t3 + c + 65535;
          c = Math.floor(v / 65536);
          t3 = v - c * 65536;
          v = t4 + c + 65535;
          c = Math.floor(v / 65536);
          t4 = v - c * 65536;
          v = t5 + c + 65535;
          c = Math.floor(v / 65536);
          t5 = v - c * 65536;
          v = t6 + c + 65535;
          c = Math.floor(v / 65536);
          t6 = v - c * 65536;
          v = t7 + c + 65535;
          c = Math.floor(v / 65536);
          t7 = v - c * 65536;
          v = t8 + c + 65535;
          c = Math.floor(v / 65536);
          t8 = v - c * 65536;
          v = t9 + c + 65535;
          c = Math.floor(v / 65536);
          t9 = v - c * 65536;
          v = t10 + c + 65535;
          c = Math.floor(v / 65536);
          t10 = v - c * 65536;
          v = t11 + c + 65535;
          c = Math.floor(v / 65536);
          t11 = v - c * 65536;
          v = t12 + c + 65535;
          c = Math.floor(v / 65536);
          t12 = v - c * 65536;
          v = t13 + c + 65535;
          c = Math.floor(v / 65536);
          t13 = v - c * 65536;
          v = t14 + c + 65535;
          c = Math.floor(v / 65536);
          t14 = v - c * 65536;
          v = t15 + c + 65535;
          c = Math.floor(v / 65536);
          t15 = v - c * 65536;
          t0 += c - 1 + 37 * (c - 1);
          c = 1;
          v = t0 + c + 65535;
          c = Math.floor(v / 65536);
          t0 = v - c * 65536;
          v = t1 + c + 65535;
          c = Math.floor(v / 65536);
          t1 = v - c * 65536;
          v = t2 + c + 65535;
          c = Math.floor(v / 65536);
          t2 = v - c * 65536;
          v = t3 + c + 65535;
          c = Math.floor(v / 65536);
          t3 = v - c * 65536;
          v = t4 + c + 65535;
          c = Math.floor(v / 65536);
          t4 = v - c * 65536;
          v = t5 + c + 65535;
          c = Math.floor(v / 65536);
          t5 = v - c * 65536;
          v = t6 + c + 65535;
          c = Math.floor(v / 65536);
          t6 = v - c * 65536;
          v = t7 + c + 65535;
          c = Math.floor(v / 65536);
          t7 = v - c * 65536;
          v = t8 + c + 65535;
          c = Math.floor(v / 65536);
          t8 = v - c * 65536;
          v = t9 + c + 65535;
          c = Math.floor(v / 65536);
          t9 = v - c * 65536;
          v = t10 + c + 65535;
          c = Math.floor(v / 65536);
          t10 = v - c * 65536;
          v = t11 + c + 65535;
          c = Math.floor(v / 65536);
          t11 = v - c * 65536;
          v = t12 + c + 65535;
          c = Math.floor(v / 65536);
          t12 = v - c * 65536;
          v = t13 + c + 65535;
          c = Math.floor(v / 65536);
          t13 = v - c * 65536;
          v = t14 + c + 65535;
          c = Math.floor(v / 65536);
          t14 = v - c * 65536;
          v = t15 + c + 65535;
          c = Math.floor(v / 65536);
          t15 = v - c * 65536;
          t0 += c - 1 + 37 * (c - 1);
          o[0] = t0;
          o[1] = t1;
          o[2] = t2;
          o[3] = t3;
          o[4] = t4;
          o[5] = t5;
          o[6] = t6;
          o[7] = t7;
          o[8] = t8;
          o[9] = t9;
          o[10] = t10;
          o[11] = t11;
          o[12] = t12;
          o[13] = t13;
          o[14] = t14;
          o[15] = t15;
        }
        function S(o, a) {
          M(o, a, a);
        }
        function inv25519(o, i) {
          var c = gf();
          var a;
          for (a = 0; a < 16; a++) c[a] = i[a];
          for (a = 253; a >= 0; a--) {
            S(c, c);
            if (a !== 2 && a !== 4) M(c, c, i);
          }
          for (a = 0; a < 16; a++) o[a] = c[a];
        }
        function pow2523(o, i) {
          var c = gf();
          var a;
          for (a = 0; a < 16; a++) c[a] = i[a];
          for (a = 250; a >= 0; a--) {
            S(c, c);
            if (a !== 1) M(c, c, i);
          }
          for (a = 0; a < 16; a++) o[a] = c[a];
        }
        function crypto_scalarmult(q, n, p) {
          var z = new Uint8Array(32);
          var x = new Float64Array(80), r, i;
          var a = gf(), b = gf(), c = gf(), d = gf(), e = gf(), f = gf();
          for (i = 0; i < 31; i++) z[i] = n[i];
          z[31] = n[31] & 127 | 64;
          z[0] &= 248;
          unpack25519(x, p);
          for (i = 0; i < 16; i++) {
            b[i] = x[i];
            d[i] = a[i] = c[i] = 0;
          }
          a[0] = d[0] = 1;
          for (i = 254; i >= 0; --i) {
            r = z[i >>> 3] >>> (i & 7) & 1;
            sel25519(a, b, r);
            sel25519(c, d, r);
            A(e, a, c);
            Z(a, a, c);
            A(c, b, d);
            Z(b, b, d);
            S(d, e);
            S(f, a);
            M(a, c, a);
            M(c, b, e);
            A(e, a, c);
            Z(a, a, c);
            S(b, a);
            Z(c, d, f);
            M(a, c, _121665);
            A(a, a, d);
            M(c, c, a);
            M(a, d, f);
            M(d, b, x);
            S(b, e);
            sel25519(a, b, r);
            sel25519(c, d, r);
          }
          for (i = 0; i < 16; i++) {
            x[i + 16] = a[i];
            x[i + 32] = c[i];
            x[i + 48] = b[i];
            x[i + 64] = d[i];
          }
          var x32 = x.subarray(32);
          var x16 = x.subarray(16);
          inv25519(x32, x32);
          M(x16, x16, x32);
          pack25519(q, x16);
          return 0;
        }
        function crypto_scalarmult_base(q, n) {
          return crypto_scalarmult(q, n, _9);
        }
        function crypto_box_keypair(y, x) {
          randombytes(x, 32);
          return crypto_scalarmult_base(y, x);
        }
        function crypto_box_beforenm(k, y, x) {
          var s = new Uint8Array(32);
          crypto_scalarmult(s, x, y);
          return crypto_core_hsalsa20(k, _0, s, sigma);
        }
        var crypto_box_afternm = crypto_secretbox;
        var crypto_box_open_afternm = crypto_secretbox_open;
        function crypto_box(c, m, d, n, y, x) {
          var k = new Uint8Array(32);
          crypto_box_beforenm(k, y, x);
          return crypto_box_afternm(c, m, d, n, k);
        }
        function crypto_box_open(m, c, d, n, y, x) {
          var k = new Uint8Array(32);
          crypto_box_beforenm(k, y, x);
          return crypto_box_open_afternm(m, c, d, n, k);
        }
        var K = [
          1116352408,
          3609767458,
          1899447441,
          602891725,
          3049323471,
          3964484399,
          3921009573,
          2173295548,
          961987163,
          4081628472,
          1508970993,
          3053834265,
          2453635748,
          2937671579,
          2870763221,
          3664609560,
          3624381080,
          2734883394,
          310598401,
          1164996542,
          607225278,
          1323610764,
          1426881987,
          3590304994,
          1925078388,
          4068182383,
          2162078206,
          991336113,
          2614888103,
          633803317,
          3248222580,
          3479774868,
          3835390401,
          2666613458,
          4022224774,
          944711139,
          264347078,
          2341262773,
          604807628,
          2007800933,
          770255983,
          1495990901,
          1249150122,
          1856431235,
          1555081692,
          3175218132,
          1996064986,
          2198950837,
          2554220882,
          3999719339,
          2821834349,
          766784016,
          2952996808,
          2566594879,
          3210313671,
          3203337956,
          3336571891,
          1034457026,
          3584528711,
          2466948901,
          113926993,
          3758326383,
          338241895,
          168717936,
          666307205,
          1188179964,
          773529912,
          1546045734,
          1294757372,
          1522805485,
          1396182291,
          2643833823,
          1695183700,
          2343527390,
          1986661051,
          1014477480,
          2177026350,
          1206759142,
          2456956037,
          344077627,
          2730485921,
          1290863460,
          2820302411,
          3158454273,
          3259730800,
          3505952657,
          3345764771,
          106217008,
          3516065817,
          3606008344,
          3600352804,
          1432725776,
          4094571909,
          1467031594,
          275423344,
          851169720,
          430227734,
          3100823752,
          506948616,
          1363258195,
          659060556,
          3750685593,
          883997877,
          3785050280,
          958139571,
          3318307427,
          1322822218,
          3812723403,
          1537002063,
          2003034995,
          1747873779,
          3602036899,
          1955562222,
          1575990012,
          2024104815,
          1125592928,
          2227730452,
          2716904306,
          2361852424,
          442776044,
          2428436474,
          593698344,
          2756734187,
          3733110249,
          3204031479,
          2999351573,
          3329325298,
          3815920427,
          3391569614,
          3928383900,
          3515267271,
          566280711,
          3940187606,
          3454069534,
          4118630271,
          4000239992,
          116418474,
          1914138554,
          174292421,
          2731055270,
          289380356,
          3203993006,
          460393269,
          320620315,
          685471733,
          587496836,
          852142971,
          1086792851,
          1017036298,
          365543100,
          1126000580,
          2618297676,
          1288033470,
          3409855158,
          1501505948,
          4234509866,
          1607167915,
          987167468,
          1816402316,
          1246189591
        ];
        function crypto_hashblocks_hl(hh, hl, m, n) {
          var wh = new Int32Array(16), wl = new Int32Array(16), bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7, bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7, th, tl, i, j, h, l, a, b, c, d;
          var ah0 = hh[0], ah1 = hh[1], ah2 = hh[2], ah3 = hh[3], ah4 = hh[4], ah5 = hh[5], ah6 = hh[6], ah7 = hh[7], al0 = hl[0], al1 = hl[1], al2 = hl[2], al3 = hl[3], al4 = hl[4], al5 = hl[5], al6 = hl[6], al7 = hl[7];
          var pos = 0;
          while (n >= 128) {
            for (i = 0; i < 16; i++) {
              j = 8 * i + pos;
              wh[i] = m[j + 0] << 24 | m[j + 1] << 16 | m[j + 2] << 8 | m[j + 3];
              wl[i] = m[j + 4] << 24 | m[j + 5] << 16 | m[j + 6] << 8 | m[j + 7];
            }
            for (i = 0; i < 80; i++) {
              bh0 = ah0;
              bh1 = ah1;
              bh2 = ah2;
              bh3 = ah3;
              bh4 = ah4;
              bh5 = ah5;
              bh6 = ah6;
              bh7 = ah7;
              bl0 = al0;
              bl1 = al1;
              bl2 = al2;
              bl3 = al3;
              bl4 = al4;
              bl5 = al5;
              bl6 = al6;
              bl7 = al7;
              h = ah7;
              l = al7;
              a = l & 65535;
              b = l >>> 16;
              c = h & 65535;
              d = h >>> 16;
              h = (ah4 >>> 14 | al4 << 32 - 14) ^ (ah4 >>> 18 | al4 << 32 - 18) ^ (al4 >>> 41 - 32 | ah4 << 32 - (41 - 32));
              l = (al4 >>> 14 | ah4 << 32 - 14) ^ (al4 >>> 18 | ah4 << 32 - 18) ^ (ah4 >>> 41 - 32 | al4 << 32 - (41 - 32));
              a += l & 65535;
              b += l >>> 16;
              c += h & 65535;
              d += h >>> 16;
              h = ah4 & ah5 ^ ~ah4 & ah6;
              l = al4 & al5 ^ ~al4 & al6;
              a += l & 65535;
              b += l >>> 16;
              c += h & 65535;
              d += h >>> 16;
              h = K[i * 2];
              l = K[i * 2 + 1];
              a += l & 65535;
              b += l >>> 16;
              c += h & 65535;
              d += h >>> 16;
              h = wh[i % 16];
              l = wl[i % 16];
              a += l & 65535;
              b += l >>> 16;
              c += h & 65535;
              d += h >>> 16;
              b += a >>> 16;
              c += b >>> 16;
              d += c >>> 16;
              th = c & 65535 | d << 16;
              tl = a & 65535 | b << 16;
              h = th;
              l = tl;
              a = l & 65535;
              b = l >>> 16;
              c = h & 65535;
              d = h >>> 16;
              h = (ah0 >>> 28 | al0 << 32 - 28) ^ (al0 >>> 34 - 32 | ah0 << 32 - (34 - 32)) ^ (al0 >>> 39 - 32 | ah0 << 32 - (39 - 32));
              l = (al0 >>> 28 | ah0 << 32 - 28) ^ (ah0 >>> 34 - 32 | al0 << 32 - (34 - 32)) ^ (ah0 >>> 39 - 32 | al0 << 32 - (39 - 32));
              a += l & 65535;
              b += l >>> 16;
              c += h & 65535;
              d += h >>> 16;
              h = ah0 & ah1 ^ ah0 & ah2 ^ ah1 & ah2;
              l = al0 & al1 ^ al0 & al2 ^ al1 & al2;
              a += l & 65535;
              b += l >>> 16;
              c += h & 65535;
              d += h >>> 16;
              b += a >>> 16;
              c += b >>> 16;
              d += c >>> 16;
              bh7 = c & 65535 | d << 16;
              bl7 = a & 65535 | b << 16;
              h = bh3;
              l = bl3;
              a = l & 65535;
              b = l >>> 16;
              c = h & 65535;
              d = h >>> 16;
              h = th;
              l = tl;
              a += l & 65535;
              b += l >>> 16;
              c += h & 65535;
              d += h >>> 16;
              b += a >>> 16;
              c += b >>> 16;
              d += c >>> 16;
              bh3 = c & 65535 | d << 16;
              bl3 = a & 65535 | b << 16;
              ah1 = bh0;
              ah2 = bh1;
              ah3 = bh2;
              ah4 = bh3;
              ah5 = bh4;
              ah6 = bh5;
              ah7 = bh6;
              ah0 = bh7;
              al1 = bl0;
              al2 = bl1;
              al3 = bl2;
              al4 = bl3;
              al5 = bl4;
              al6 = bl5;
              al7 = bl6;
              al0 = bl7;
              if (i % 16 === 15) {
                for (j = 0; j < 16; j++) {
                  h = wh[j];
                  l = wl[j];
                  a = l & 65535;
                  b = l >>> 16;
                  c = h & 65535;
                  d = h >>> 16;
                  h = wh[(j + 9) % 16];
                  l = wl[(j + 9) % 16];
                  a += l & 65535;
                  b += l >>> 16;
                  c += h & 65535;
                  d += h >>> 16;
                  th = wh[(j + 1) % 16];
                  tl = wl[(j + 1) % 16];
                  h = (th >>> 1 | tl << 32 - 1) ^ (th >>> 8 | tl << 32 - 8) ^ th >>> 7;
                  l = (tl >>> 1 | th << 32 - 1) ^ (tl >>> 8 | th << 32 - 8) ^ (tl >>> 7 | th << 32 - 7);
                  a += l & 65535;
                  b += l >>> 16;
                  c += h & 65535;
                  d += h >>> 16;
                  th = wh[(j + 14) % 16];
                  tl = wl[(j + 14) % 16];
                  h = (th >>> 19 | tl << 32 - 19) ^ (tl >>> 61 - 32 | th << 32 - (61 - 32)) ^ th >>> 6;
                  l = (tl >>> 19 | th << 32 - 19) ^ (th >>> 61 - 32 | tl << 32 - (61 - 32)) ^ (tl >>> 6 | th << 32 - 6);
                  a += l & 65535;
                  b += l >>> 16;
                  c += h & 65535;
                  d += h >>> 16;
                  b += a >>> 16;
                  c += b >>> 16;
                  d += c >>> 16;
                  wh[j] = c & 65535 | d << 16;
                  wl[j] = a & 65535 | b << 16;
                }
              }
            }
            h = ah0;
            l = al0;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[0];
            l = hl[0];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[0] = ah0 = c & 65535 | d << 16;
            hl[0] = al0 = a & 65535 | b << 16;
            h = ah1;
            l = al1;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[1];
            l = hl[1];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[1] = ah1 = c & 65535 | d << 16;
            hl[1] = al1 = a & 65535 | b << 16;
            h = ah2;
            l = al2;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[2];
            l = hl[2];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[2] = ah2 = c & 65535 | d << 16;
            hl[2] = al2 = a & 65535 | b << 16;
            h = ah3;
            l = al3;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[3];
            l = hl[3];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[3] = ah3 = c & 65535 | d << 16;
            hl[3] = al3 = a & 65535 | b << 16;
            h = ah4;
            l = al4;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[4];
            l = hl[4];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[4] = ah4 = c & 65535 | d << 16;
            hl[4] = al4 = a & 65535 | b << 16;
            h = ah5;
            l = al5;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[5];
            l = hl[5];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[5] = ah5 = c & 65535 | d << 16;
            hl[5] = al5 = a & 65535 | b << 16;
            h = ah6;
            l = al6;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[6];
            l = hl[6];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[6] = ah6 = c & 65535 | d << 16;
            hl[6] = al6 = a & 65535 | b << 16;
            h = ah7;
            l = al7;
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = hh[7];
            l = hl[7];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            hh[7] = ah7 = c & 65535 | d << 16;
            hl[7] = al7 = a & 65535 | b << 16;
            pos += 128;
            n -= 128;
          }
          return n;
        }
        function crypto_hash(out, m, n) {
          var hh = new Int32Array(8), hl = new Int32Array(8), x = new Uint8Array(256), i, b = n;
          hh[0] = 1779033703;
          hh[1] = 3144134277;
          hh[2] = 1013904242;
          hh[3] = 2773480762;
          hh[4] = 1359893119;
          hh[5] = 2600822924;
          hh[6] = 528734635;
          hh[7] = 1541459225;
          hl[0] = 4089235720;
          hl[1] = 2227873595;
          hl[2] = 4271175723;
          hl[3] = 1595750129;
          hl[4] = 2917565137;
          hl[5] = 725511199;
          hl[6] = 4215389547;
          hl[7] = 327033209;
          crypto_hashblocks_hl(hh, hl, m, n);
          n %= 128;
          for (i = 0; i < n; i++) x[i] = m[b - n + i];
          x[n] = 128;
          n = 256 - 128 * (n < 112 ? 1 : 0);
          x[n - 9] = 0;
          ts64(x, n - 8, b / 536870912 | 0, b << 3);
          crypto_hashblocks_hl(hh, hl, x, n);
          for (i = 0; i < 8; i++) ts64(out, 8 * i, hh[i], hl[i]);
          return 0;
        }
        function add(p, q) {
          var a = gf(), b = gf(), c = gf(), d = gf(), e = gf(), f = gf(), g = gf(), h = gf(), t = gf();
          Z(a, p[1], p[0]);
          Z(t, q[1], q[0]);
          M(a, a, t);
          A(b, p[0], p[1]);
          A(t, q[0], q[1]);
          M(b, b, t);
          M(c, p[3], q[3]);
          M(c, c, D2);
          M(d, p[2], q[2]);
          A(d, d, d);
          Z(e, b, a);
          Z(f, d, c);
          A(g, d, c);
          A(h, b, a);
          M(p[0], e, f);
          M(p[1], h, g);
          M(p[2], g, f);
          M(p[3], e, h);
        }
        function cswap(p, q, b) {
          var i;
          for (i = 0; i < 4; i++) {
            sel25519(p[i], q[i], b);
          }
        }
        function pack(r, p) {
          var tx = gf(), ty = gf(), zi = gf();
          inv25519(zi, p[2]);
          M(tx, p[0], zi);
          M(ty, p[1], zi);
          pack25519(r, ty);
          r[31] ^= par25519(tx) << 7;
        }
        function scalarmult(p, q, s) {
          var b, i;
          set25519(p[0], gf0);
          set25519(p[1], gf1);
          set25519(p[2], gf1);
          set25519(p[3], gf0);
          for (i = 255; i >= 0; --i) {
            b = s[i / 8 | 0] >> (i & 7) & 1;
            cswap(p, q, b);
            add(q, p);
            add(p, p);
            cswap(p, q, b);
          }
        }
        function scalarbase(p, s) {
          var q = [gf(), gf(), gf(), gf()];
          set25519(q[0], X);
          set25519(q[1], Y);
          set25519(q[2], gf1);
          M(q[3], X, Y);
          scalarmult(p, q, s);
        }
        function crypto_sign_keypair(pk, sk, seeded) {
          var d = new Uint8Array(64);
          var p = [gf(), gf(), gf(), gf()];
          var i;
          if (!seeded) randombytes(sk, 32);
          crypto_hash(d, sk, 32);
          d[0] &= 248;
          d[31] &= 127;
          d[31] |= 64;
          scalarbase(p, d);
          pack(pk, p);
          for (i = 0; i < 32; i++) sk[i + 32] = pk[i];
          return 0;
        }
        var L = new Float64Array([237, 211, 245, 92, 26, 99, 18, 88, 214, 156, 247, 162, 222, 249, 222, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16]);
        function modL(r, x) {
          var carry, i, j, k;
          for (i = 63; i >= 32; --i) {
            carry = 0;
            for (j = i - 32, k = i - 12; j < k; ++j) {
              x[j] += carry - 16 * x[i] * L[j - (i - 32)];
              carry = Math.floor((x[j] + 128) / 256);
              x[j] -= carry * 256;
            }
            x[j] += carry;
            x[i] = 0;
          }
          carry = 0;
          for (j = 0; j < 32; j++) {
            x[j] += carry - (x[31] >> 4) * L[j];
            carry = x[j] >> 8;
            x[j] &= 255;
          }
          for (j = 0; j < 32; j++) x[j] -= carry * L[j];
          for (i = 0; i < 32; i++) {
            x[i + 1] += x[i] >> 8;
            r[i] = x[i] & 255;
          }
        }
        function reduce(r) {
          var x = new Float64Array(64), i;
          for (i = 0; i < 64; i++) x[i] = r[i];
          for (i = 0; i < 64; i++) r[i] = 0;
          modL(r, x);
        }
        function crypto_sign(sm, m, n, sk) {
          var d = new Uint8Array(64), h = new Uint8Array(64), r = new Uint8Array(64);
          var i, j, x = new Float64Array(64);
          var p = [gf(), gf(), gf(), gf()];
          crypto_hash(d, sk, 32);
          d[0] &= 248;
          d[31] &= 127;
          d[31] |= 64;
          var smlen = n + 64;
          for (i = 0; i < n; i++) sm[64 + i] = m[i];
          for (i = 0; i < 32; i++) sm[32 + i] = d[32 + i];
          crypto_hash(r, sm.subarray(32), n + 32);
          reduce(r);
          scalarbase(p, r);
          pack(sm, p);
          for (i = 32; i < 64; i++) sm[i] = sk[i];
          crypto_hash(h, sm, n + 64);
          reduce(h);
          for (i = 0; i < 64; i++) x[i] = 0;
          for (i = 0; i < 32; i++) x[i] = r[i];
          for (i = 0; i < 32; i++) {
            for (j = 0; j < 32; j++) {
              x[i + j] += h[i] * d[j];
            }
          }
          modL(sm.subarray(32), x);
          return smlen;
        }
        function unpackneg(r, p) {
          var t = gf(), chk = gf(), num = gf(), den = gf(), den2 = gf(), den4 = gf(), den6 = gf();
          set25519(r[2], gf1);
          unpack25519(r[1], p);
          S(num, r[1]);
          M(den, num, D);
          Z(num, num, r[2]);
          A(den, r[2], den);
          S(den2, den);
          S(den4, den2);
          M(den6, den4, den2);
          M(t, den6, num);
          M(t, t, den);
          pow2523(t, t);
          M(t, t, num);
          M(t, t, den);
          M(t, t, den);
          M(r[0], t, den);
          S(chk, r[0]);
          M(chk, chk, den);
          if (neq25519(chk, num)) M(r[0], r[0], I);
          S(chk, r[0]);
          M(chk, chk, den);
          if (neq25519(chk, num)) return -1;
          if (par25519(r[0]) === p[31] >> 7) Z(r[0], gf0, r[0]);
          M(r[3], r[0], r[1]);
          return 0;
        }
        function crypto_sign_open(m, sm, n, pk) {
          var i;
          var t = new Uint8Array(32), h = new Uint8Array(64);
          var p = [gf(), gf(), gf(), gf()], q = [gf(), gf(), gf(), gf()];
          if (n < 64) return -1;
          if (unpackneg(q, pk)) return -1;
          for (i = 0; i < n; i++) m[i] = sm[i];
          for (i = 0; i < 32; i++) m[i + 32] = pk[i];
          crypto_hash(h, m, n);
          reduce(h);
          scalarmult(p, q, h);
          scalarbase(q, sm.subarray(32));
          add(p, q);
          pack(t, p);
          n -= 64;
          if (crypto_verify_32(sm, 0, t, 0)) {
            for (i = 0; i < n; i++) m[i] = 0;
            return -1;
          }
          for (i = 0; i < n; i++) m[i] = sm[i + 64];
          return n;
        }
        var crypto_secretbox_KEYBYTES = 32, crypto_secretbox_NONCEBYTES = 24, crypto_secretbox_ZEROBYTES = 32, crypto_secretbox_BOXZEROBYTES = 16, crypto_scalarmult_BYTES = 32, crypto_scalarmult_SCALARBYTES = 32, crypto_box_PUBLICKEYBYTES = 32, crypto_box_SECRETKEYBYTES = 32, crypto_box_BEFORENMBYTES = 32, crypto_box_NONCEBYTES = crypto_secretbox_NONCEBYTES, crypto_box_ZEROBYTES = crypto_secretbox_ZEROBYTES, crypto_box_BOXZEROBYTES = crypto_secretbox_BOXZEROBYTES, crypto_sign_BYTES = 64, crypto_sign_PUBLICKEYBYTES = 32, crypto_sign_SECRETKEYBYTES = 64, crypto_sign_SEEDBYTES = 32, crypto_hash_BYTES = 64;
        nacl2.lowlevel = {
          crypto_core_hsalsa20,
          crypto_stream_xor,
          crypto_stream,
          crypto_stream_salsa20_xor,
          crypto_stream_salsa20,
          crypto_onetimeauth,
          crypto_onetimeauth_verify,
          crypto_verify_16,
          crypto_verify_32,
          crypto_secretbox,
          crypto_secretbox_open,
          crypto_scalarmult,
          crypto_scalarmult_base,
          crypto_box_beforenm,
          crypto_box_afternm,
          crypto_box,
          crypto_box_open,
          crypto_box_keypair,
          crypto_hash,
          crypto_sign,
          crypto_sign_keypair,
          crypto_sign_open,
          crypto_secretbox_KEYBYTES,
          crypto_secretbox_NONCEBYTES,
          crypto_secretbox_ZEROBYTES,
          crypto_secretbox_BOXZEROBYTES,
          crypto_scalarmult_BYTES,
          crypto_scalarmult_SCALARBYTES,
          crypto_box_PUBLICKEYBYTES,
          crypto_box_SECRETKEYBYTES,
          crypto_box_BEFORENMBYTES,
          crypto_box_NONCEBYTES,
          crypto_box_ZEROBYTES,
          crypto_box_BOXZEROBYTES,
          crypto_sign_BYTES,
          crypto_sign_PUBLICKEYBYTES,
          crypto_sign_SECRETKEYBYTES,
          crypto_sign_SEEDBYTES,
          crypto_hash_BYTES,
          gf,
          D,
          L,
          pack25519,
          unpack25519,
          M,
          A,
          S,
          Z,
          pow2523,
          add,
          set25519,
          modL,
          scalarmult,
          scalarbase
        };
        function checkLengths(k, n) {
          if (k.length !== crypto_secretbox_KEYBYTES) throw new Error("bad key size");
          if (n.length !== crypto_secretbox_NONCEBYTES) throw new Error("bad nonce size");
        }
        function checkBoxLengths(pk, sk) {
          if (pk.length !== crypto_box_PUBLICKEYBYTES) throw new Error("bad public key size");
          if (sk.length !== crypto_box_SECRETKEYBYTES) throw new Error("bad secret key size");
        }
        function checkArrayTypes() {
          for (var i = 0; i < arguments.length; i++) {
            if (!(arguments[i] instanceof Uint8Array))
              throw new TypeError("unexpected type, use Uint8Array");
          }
        }
        function cleanup(arr) {
          for (var i = 0; i < arr.length; i++) arr[i] = 0;
        }
        nacl2.randomBytes = function(n) {
          var b = new Uint8Array(n);
          randombytes(b, n);
          return b;
        };
        nacl2.secretbox = function(msg, nonce, key) {
          checkArrayTypes(msg, nonce, key);
          checkLengths(key, nonce);
          var m = new Uint8Array(crypto_secretbox_ZEROBYTES + msg.length);
          var c = new Uint8Array(m.length);
          for (var i = 0; i < msg.length; i++) m[i + crypto_secretbox_ZEROBYTES] = msg[i];
          crypto_secretbox(c, m, m.length, nonce, key);
          return c.subarray(crypto_secretbox_BOXZEROBYTES);
        };
        nacl2.secretbox.open = function(box2, nonce, key) {
          checkArrayTypes(box2, nonce, key);
          checkLengths(key, nonce);
          var c = new Uint8Array(crypto_secretbox_BOXZEROBYTES + box2.length);
          var m = new Uint8Array(c.length);
          for (var i = 0; i < box2.length; i++) c[i + crypto_secretbox_BOXZEROBYTES] = box2[i];
          if (c.length < 32) return null;
          if (crypto_secretbox_open(m, c, c.length, nonce, key) !== 0) return null;
          return m.subarray(crypto_secretbox_ZEROBYTES);
        };
        nacl2.secretbox.keyLength = crypto_secretbox_KEYBYTES;
        nacl2.secretbox.nonceLength = crypto_secretbox_NONCEBYTES;
        nacl2.secretbox.overheadLength = crypto_secretbox_BOXZEROBYTES;
        nacl2.scalarMult = function(n, p) {
          checkArrayTypes(n, p);
          if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error("bad n size");
          if (p.length !== crypto_scalarmult_BYTES) throw new Error("bad p size");
          var q = new Uint8Array(crypto_scalarmult_BYTES);
          crypto_scalarmult(q, n, p);
          return q;
        };
        nacl2.scalarMult.base = function(n) {
          checkArrayTypes(n);
          if (n.length !== crypto_scalarmult_SCALARBYTES) throw new Error("bad n size");
          var q = new Uint8Array(crypto_scalarmult_BYTES);
          crypto_scalarmult_base(q, n);
          return q;
        };
        nacl2.scalarMult.scalarLength = crypto_scalarmult_SCALARBYTES;
        nacl2.scalarMult.groupElementLength = crypto_scalarmult_BYTES;
        nacl2.box = function(msg, nonce, publicKey2, secretKey) {
          var k = nacl2.box.before(publicKey2, secretKey);
          return nacl2.secretbox(msg, nonce, k);
        };
        nacl2.box.before = function(publicKey2, secretKey) {
          checkArrayTypes(publicKey2, secretKey);
          checkBoxLengths(publicKey2, secretKey);
          var k = new Uint8Array(crypto_box_BEFORENMBYTES);
          crypto_box_beforenm(k, publicKey2, secretKey);
          return k;
        };
        nacl2.box.after = nacl2.secretbox;
        nacl2.box.open = function(msg, nonce, publicKey2, secretKey) {
          var k = nacl2.box.before(publicKey2, secretKey);
          return nacl2.secretbox.open(msg, nonce, k);
        };
        nacl2.box.open.after = nacl2.secretbox.open;
        nacl2.box.keyPair = function() {
          var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
          var sk = new Uint8Array(crypto_box_SECRETKEYBYTES);
          crypto_box_keypair(pk, sk);
          return { publicKey: pk, secretKey: sk };
        };
        nacl2.box.keyPair.fromSecretKey = function(secretKey) {
          checkArrayTypes(secretKey);
          if (secretKey.length !== crypto_box_SECRETKEYBYTES)
            throw new Error("bad secret key size");
          var pk = new Uint8Array(crypto_box_PUBLICKEYBYTES);
          crypto_scalarmult_base(pk, secretKey);
          return { publicKey: pk, secretKey: new Uint8Array(secretKey) };
        };
        nacl2.box.publicKeyLength = crypto_box_PUBLICKEYBYTES;
        nacl2.box.secretKeyLength = crypto_box_SECRETKEYBYTES;
        nacl2.box.sharedKeyLength = crypto_box_BEFORENMBYTES;
        nacl2.box.nonceLength = crypto_box_NONCEBYTES;
        nacl2.box.overheadLength = nacl2.secretbox.overheadLength;
        nacl2.sign = function(msg, secretKey) {
          checkArrayTypes(msg, secretKey);
          if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
            throw new Error("bad secret key size");
          var signedMsg = new Uint8Array(crypto_sign_BYTES + msg.length);
          crypto_sign(signedMsg, msg, msg.length, secretKey);
          return signedMsg;
        };
        nacl2.sign.open = function(signedMsg, publicKey2) {
          checkArrayTypes(signedMsg, publicKey2);
          if (publicKey2.length !== crypto_sign_PUBLICKEYBYTES)
            throw new Error("bad public key size");
          var tmp = new Uint8Array(signedMsg.length);
          var mlen = crypto_sign_open(tmp, signedMsg, signedMsg.length, publicKey2);
          if (mlen < 0) return null;
          var m = new Uint8Array(mlen);
          for (var i = 0; i < m.length; i++) m[i] = tmp[i];
          return m;
        };
        nacl2.sign.detached = function(msg, secretKey) {
          var signedMsg = nacl2.sign(msg, secretKey);
          var sig = new Uint8Array(crypto_sign_BYTES);
          for (var i = 0; i < sig.length; i++) sig[i] = signedMsg[i];
          return sig;
        };
        nacl2.sign.detached.verify = function(msg, sig, publicKey2) {
          checkArrayTypes(msg, sig, publicKey2);
          if (sig.length !== crypto_sign_BYTES)
            throw new Error("bad signature size");
          if (publicKey2.length !== crypto_sign_PUBLICKEYBYTES)
            throw new Error("bad public key size");
          var sm = new Uint8Array(crypto_sign_BYTES + msg.length);
          var m = new Uint8Array(crypto_sign_BYTES + msg.length);
          var i;
          for (i = 0; i < crypto_sign_BYTES; i++) sm[i] = sig[i];
          for (i = 0; i < msg.length; i++) sm[i + crypto_sign_BYTES] = msg[i];
          return crypto_sign_open(m, sm, sm.length, publicKey2) >= 0;
        };
        nacl2.sign.keyPair = function() {
          var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
          var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
          crypto_sign_keypair(pk, sk);
          return { publicKey: pk, secretKey: sk };
        };
        nacl2.sign.keyPair.fromSecretKey = function(secretKey) {
          checkArrayTypes(secretKey);
          if (secretKey.length !== crypto_sign_SECRETKEYBYTES)
            throw new Error("bad secret key size");
          var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
          for (var i = 0; i < pk.length; i++) pk[i] = secretKey[32 + i];
          return { publicKey: pk, secretKey: new Uint8Array(secretKey) };
        };
        nacl2.sign.keyPair.fromSeed = function(seed) {
          checkArrayTypes(seed);
          if (seed.length !== crypto_sign_SEEDBYTES)
            throw new Error("bad seed size");
          var pk = new Uint8Array(crypto_sign_PUBLICKEYBYTES);
          var sk = new Uint8Array(crypto_sign_SECRETKEYBYTES);
          for (var i = 0; i < 32; i++) sk[i] = seed[i];
          crypto_sign_keypair(pk, sk, true);
          return { publicKey: pk, secretKey: sk };
        };
        nacl2.sign.publicKeyLength = crypto_sign_PUBLICKEYBYTES;
        nacl2.sign.secretKeyLength = crypto_sign_SECRETKEYBYTES;
        nacl2.sign.seedLength = crypto_sign_SEEDBYTES;
        nacl2.sign.signatureLength = crypto_sign_BYTES;
        nacl2.hash = function(msg) {
          checkArrayTypes(msg);
          var h = new Uint8Array(crypto_hash_BYTES);
          crypto_hash(h, msg, msg.length);
          return h;
        };
        nacl2.hash.hashLength = crypto_hash_BYTES;
        nacl2.verify = function(x, y) {
          checkArrayTypes(x, y);
          if (x.length === 0 || y.length === 0) return false;
          if (x.length !== y.length) return false;
          return vn(x, 0, y, 0, x.length) === 0 ? true : false;
        };
        nacl2.setPRNG = function(fn) {
          randombytes = fn;
        };
        (function() {
          var crypto = typeof self !== "undefined" ? self.crypto || self.msCrypto : null;
          if (crypto && crypto.getRandomValues) {
            var QUOTA = 65536;
            nacl2.setPRNG(function(x, n) {
              var i, v = new Uint8Array(n);
              for (i = 0; i < n; i += QUOTA) {
                crypto.getRandomValues(v.subarray(i, i + Math.min(n - i, QUOTA)));
              }
              for (i = 0; i < n; i++) x[i] = v[i];
              cleanup(v);
            });
          } else if (typeof __require !== "undefined") {
            crypto = require_crypto();
            if (crypto && crypto.randomBytes) {
              nacl2.setPRNG(function(x, n) {
                var i, v = crypto.randomBytes(n);
                for (i = 0; i < n; i++) x[i] = v[i];
                cleanup(v);
              });
            }
          }
        })();
      })(typeof module !== "undefined" && module.exports ? module.exports : self.nacl = self.nacl || {});
    }
  });

  // basecamp/js/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    ADMIN_KEY: () => ADMIN_KEY,
    MAIN_PAGE: () => MAIN_PAGE,
    MAX_TEXT: () => MAX_TEXT,
    PRESET: () => PRESET,
    SITENAME: () => SITENAME,
    SNAPSHOT_CID: () => SNAPSHOT_CID,
    TOPIC: () => TOPIC,
    Wiki: () => Wiki,
    accountName: () => accountName,
    appendSection: () => appendSection,
    bytesToHex: () => bytesToHex2,
    canEditPage: () => canEditPage,
    canonicalTitle: () => canonicalTitle,
    createWiki: () => createWiki,
    decodeMessage: () => decodeMessage,
    deriveSeed: () => deriveSeed,
    diffRows: () => diffRows,
    engineAccountName: () => engineAccountName,
    engineAccountTaken: () => engineAccountTaken,
    engineCanEdit: () => engineCanEdit,
    engineDiff: () => engineDiff,
    engineFollowRedirect: () => engineFollowRedirect,
    engineHas: () => engineHas,
    engineIsAdmin: () => engineIsAdmin,
    engineLatestText: () => engineLatestText,
    enginePageExists: () => enginePageExists,
    enginePreview: () => enginePreview,
    engineRecent: () => engineRecent,
    engineRenderPage: () => engineRenderPage,
    engineRevisions: () => engineRevisions,
    engineStats: () => engineStats,
    engineTitles: () => engineTitles,
    engineTrusted: () => engineTrusted,
    followRedirect: () => followRedirect,
    formatDate: () => formatDate,
    formatDateTime: () => formatDateTime,
    formatNumber: () => formatNumber,
    formatTime: () => formatTime,
    hexToBytes: () => hexToBytes2,
    ingest: () => ingest,
    ingestEnvelope: () => ingestEnvelope,
    ingestEvents: () => ingestEvents,
    ingestSnapshotEvents: () => ingestSnapshotEvents,
    joinBase64Chunks: () => joinBase64Chunks,
    latestText: () => latestText,
    normalizeUsername: () => normalizeUsername,
    pageTitles: () => pageTitles,
    parseTitle: () => parseTitle,
    parseWikiHref: () => parseWikiHref,
    parseWikiLink: () => parseWikiLink,
    publicKey: () => publicKey,
    publishBody: () => publishBody,
    recent: () => recent,
    render: () => render,
    renderPage: () => renderPage,
    replaceSection: () => replaceSection,
    resetEngine: () => resetEngine,
    richText: () => richText,
    sectionText: () => sectionText,
    sign: () => sign,
    validUsername: () => validUsername,
    verify: () => verify
  });

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle = (title) => title ? `"${title}" ` : "";
  function anumber(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abytes(value, length, title = "") {
    if (isBytes(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber(length, "length");
    const bytes = isBytes(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  function ahash(h) {
    if (typeof h !== "function" || typeof h.create !== "function")
      throw new TypeError("expected hash wrapped by utils.createHasher");
    anumber(h.outputLen);
    anumber(h.blockLen);
    if (h.outputLen < 1 || h.blockLen < 1)
      throw new Error("hash blockLen / outputLen must be >= 1");
  }
  var aobject = (value, label) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
  };
  var aopts = (value, label) => {
    aobject(value, label);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
      throw new TypeError(`"${label}" expected plain object`);
    if (Object.hasOwn(value, "__proto__"))
      throw new TypeError(`"${label}.__proto__" is not allowed`);
  };
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  function rotl(word, shift) {
    return word << shift | word >>> 32 - shift >>> 0;
  }
  var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
  function byteSwap(word) {
    return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  }
  function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = byteSwap(arr[i]);
    }
    return arr;
  }
  var swap32IfBE = isLE ? (u) => u : byteSwap32;
  var hasHexBuiltin = /* @__PURE__ */ (() => (
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
  ))();
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  function asciiToBase16(ch) {
    return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    if (hasHexBuiltin) {
      try {
        return Uint8Array.fromHex(hex);
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new RangeError(error.message);
        throw error;
      }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new RangeError("hex string expected, got unpadded hex of length " + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2;
    }
    return array;
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new TypeError("string expected");
    const encoded = new TextEncoder().encode(str);
    try {
      return new Uint8Array(encoded);
    } finally {
      clean(encoded);
    }
  }
  function kdfInputToBytes(data, errorTitle = "") {
    if (typeof data === "string")
      return utf8ToBytes(data);
    return abytes(data, void 0, errorTitle);
  }
  function checkOpts(defaults, opts, title = "opts") {
    aopts(defaults, "defaults");
    if (opts !== void 0)
      aopts(opts, title);
    const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== "function")
      throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, "info");
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/hashes/hmac.js
  var _HMAC = class {
    constructor(hash, key) {
      __publicField(this, "oHash");
      __publicField(this, "iHash");
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "canXOF", false);
      __publicField(this, "finished", false);
      __publicField(this, "destroyed", false);
      ahash(hash);
      abytes(key, void 0, "key");
      this.iHash = hash.create();
      if (typeof this.iHash.update !== "function")
        throw new Error("expected Hash instance");
      this.blockLen = this.iHash.blockLen;
      this.outputLen = this.iHash.outputLen;
      const blockLen = this.blockLen;
      const pad2 = new Uint8Array(blockLen);
      pad2.set(key.length > blockLen ? hash.create().update(key).digest() : key);
      for (let i = 0; i < pad2.length; i++)
        pad2[i] ^= 54;
      this.iHash.update(pad2);
      this.oHash = hash.create();
      for (let i = 0; i < pad2.length; i++)
        pad2[i] ^= 54 ^ 92;
      this.oHash.update(pad2);
      clean(pad2);
    }
    update(buf) {
      aexists(this);
      this.iHash.update(buf);
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const buf = out.subarray(0, this.outputLen);
      this.iHash.digestInto(buf);
      this.oHash.update(buf);
      this.oHash.digestInto(buf);
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.oHash.outputLen);
      this.digestInto(out);
      return out;
    }
    _cloneInto(to) {
      to || (to = Object.create(Object.getPrototypeOf(this), {}));
      const { oHash, iHash, finished, destroyed, blockLen, outputLen, canXOF } = this;
      to = to;
      to.finished = finished;
      to.destroyed = destroyed;
      to.blockLen = blockLen;
      to.outputLen = outputLen;
      to.canXOF = canXOF;
      to.oHash = oHash._cloneInto(to.oHash);
      to.iHash = iHash._cloneInto(to.iHash);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
    destroy() {
      this.destroyed = true;
      this.oHash.destroy();
      this.iHash.destroy();
    }
  };
  var hmac = /* @__PURE__ */ (() => {
    const hmac_ = ((hash, key, message) => new _HMAC(hash, key).update(message).digest());
    hmac_.create = (hash, key) => new _HMAC(hash, key);
    return hmac_;
  })();

  // node_modules/@noble/hashes/pbkdf2.js
  function pbkdf2Init(hash, _password, _salt, _opts) {
    ahash(hash);
    const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
    const { c, dkLen, asyncTick } = opts;
    anumber(c, "c");
    anumber(dkLen, "dkLen");
    anumber(asyncTick, "asyncTick");
    if (c < 1)
      throw new Error('"c" (iterations) must be >= 1');
    if (dkLen < 1)
      throw new Error('"dkLen" must be >= 1');
    if (dkLen > (__pow(2, 32) - 1) * hash.outputLen)
      throw new Error("derived key too long");
    const p = kdfInputToBytes(_password, "password");
    try {
      const s = kdfInputToBytes(_salt, "salt");
      try {
        const DK = new Uint8Array(dkLen);
        const { iHash, oHash, outputLen } = hmac.create(hash, p);
        const u = new Uint8Array(outputLen);
        const eng = pbkdf2Engine(iHash, oHash, s, u);
        return { c, dkLen, asyncTick, DK, outputLen, eng };
      } finally {
        if (typeof _salt === "string")
          clean(s);
      }
    } finally {
      if (typeof _password === "string")
        clean(p);
    }
  }
  function pbkdf2Engine(iHash, oHash, salt, u) {
    const counter = new Uint8Array(4);
    const view = createView(counter);
    const salted = iHash._cloneInto().update(salt);
    const work = oHash._cloneInto();
    const iClone = iHash._cloneInto;
    const oClone = oHash._cloneInto;
    return {
      u1: (ti, Ti) => {
        view.setInt32(0, ti, false);
        salted._cloneInto(work).update(counter).digestInto(u);
        oHash._cloneInto(work).update(u).digestInto(u);
        Ti.set(u.subarray(0, Ti.length));
      },
      // Whole `F` inner loop for the sync variant: one optimized function owns the hot loop.
      rounds: (c, Ti) => {
        for (let ui = 1; ui < c; ui++) {
          iClone.call(iHash, work).update(u).digestInto(u);
          oClone.call(oHash, work).update(u).digestInto(u);
          for (let i = 0; i < Ti.length; i++)
            Ti[i] ^= u[i];
        }
      },
      output: (DK) => {
        iHash.destroy();
        oHash.destroy();
        salted.destroy();
        work.destroy();
        clean(u);
        return DK;
      }
    };
  }
  function pbkdf2(hash, password, salt, opts) {
    const { c, dkLen, DK, outputLen, eng } = pbkdf2Init(hash, password, salt, opts);
    for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += outputLen) {
      const Ti = DK.subarray(pos, pos + outputLen);
      eng.u1(ti, Ti);
      eng.rounds(c, Ti);
    }
    return eng.output(DK);
  }

  // node_modules/@noble/hashes/_u64.js
  var fromNumH = (n) => n / __pow(2, 32) | 0;
  var fromNumL = (n) => n >>> 0;
  function setU64FromNum(view, byteOffset, n, isLE2) {
    const h = fromNumH(n);
    const l = fromNumL(n);
    view.setUint32(byteOffset, isLE2 ? l : h, isLE2);
    view.setUint32(byteOffset + 4, isLE2 ? h : l, isLE2);
  }

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    constructor(blockLen, outputLen, padOffset, isLE2) {
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "canXOF", false);
      __publicField(this, "padOffset");
      __publicField(this, "isLE");
      // For partial updates less than block size
      __publicField(this, "buffer");
      __publicField(this, "view");
      __publicField(this, "finished", false);
      __publicField(this, "length", 0);
      __publicField(this, "pos", 0);
      __publicField(this, "destroyed", false);
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE2;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      let processed = false;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          processed = true;
          continue;
        }
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
          processed = true;
        }
      }
      this.length += data.length;
      if (processed)
        this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE: isLE2 } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      buffer.fill(0, pos);
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        buffer.fill(0);
      }
      setU64FromNum(view, blockLen - 8, this.length * 8, isLE2);
      this.process(view, 0);
      this.roundClean();
      const oview = out === buffer ? view : createView(out);
      const len = this.outputLen;
      const outLen = len / 4;
      const state = this.get();
      if (len % 4 || outLen > state.length)
        throw new Error("invalid outputLen");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE2);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneIntoMeta(to) {
      const { buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (pos)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);

  // node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    constructor(outputLen, IV) {
      super(64, outputLen, 8, false);
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      // Numeric initializers matter: starting the fields as `undefined` changes
      // V8's field representation and makes sha256 3x slower (measured).
      __publicField(this, "A", 0);
      __publicField(this, "B", 0);
      __publicField(this, "C", 0);
      __publicField(this, "D", 0);
      __publicField(this, "E", 0);
      __publicField(this, "F", 0);
      __publicField(this, "G", 0);
      __publicField(this, "H", 0);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    _cloneInto(to) {
      (to || (to = new this.constructor())).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    constructor() {
      super(32, SHA256_IV);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );

  // node_modules/@noble/hashes/scrypt.js
  function XorAndSalsa(prev, pi, input, ii, out, oi) {
    let y00 = prev[pi++] ^ input[ii++], y01 = prev[pi++] ^ input[ii++];
    let y02 = prev[pi++] ^ input[ii++], y03 = prev[pi++] ^ input[ii++];
    let y04 = prev[pi++] ^ input[ii++], y05 = prev[pi++] ^ input[ii++];
    let y06 = prev[pi++] ^ input[ii++], y07 = prev[pi++] ^ input[ii++];
    let y08 = prev[pi++] ^ input[ii++], y09 = prev[pi++] ^ input[ii++];
    let y10 = prev[pi++] ^ input[ii++], y11 = prev[pi++] ^ input[ii++];
    let y12 = prev[pi++] ^ input[ii++], y13 = prev[pi++] ^ input[ii++];
    let y14 = prev[pi++] ^ input[ii++], y15 = prev[pi++] ^ input[ii++];
    let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
    for (let i = 0; i < 8; i += 2) {
      x04 ^= rotl(x00 + x12 | 0, 7);
      x08 ^= rotl(x04 + x00 | 0, 9);
      x12 ^= rotl(x08 + x04 | 0, 13);
      x00 ^= rotl(x12 + x08 | 0, 18);
      x09 ^= rotl(x05 + x01 | 0, 7);
      x13 ^= rotl(x09 + x05 | 0, 9);
      x01 ^= rotl(x13 + x09 | 0, 13);
      x05 ^= rotl(x01 + x13 | 0, 18);
      x14 ^= rotl(x10 + x06 | 0, 7);
      x02 ^= rotl(x14 + x10 | 0, 9);
      x06 ^= rotl(x02 + x14 | 0, 13);
      x10 ^= rotl(x06 + x02 | 0, 18);
      x03 ^= rotl(x15 + x11 | 0, 7);
      x07 ^= rotl(x03 + x15 | 0, 9);
      x11 ^= rotl(x07 + x03 | 0, 13);
      x15 ^= rotl(x11 + x07 | 0, 18);
      x01 ^= rotl(x00 + x03 | 0, 7);
      x02 ^= rotl(x01 + x00 | 0, 9);
      x03 ^= rotl(x02 + x01 | 0, 13);
      x00 ^= rotl(x03 + x02 | 0, 18);
      x06 ^= rotl(x05 + x04 | 0, 7);
      x07 ^= rotl(x06 + x05 | 0, 9);
      x04 ^= rotl(x07 + x06 | 0, 13);
      x05 ^= rotl(x04 + x07 | 0, 18);
      x11 ^= rotl(x10 + x09 | 0, 7);
      x08 ^= rotl(x11 + x10 | 0, 9);
      x09 ^= rotl(x08 + x11 | 0, 13);
      x10 ^= rotl(x09 + x08 | 0, 18);
      x12 ^= rotl(x15 + x14 | 0, 7);
      x13 ^= rotl(x12 + x15 | 0, 9);
      x14 ^= rotl(x13 + x12 | 0, 13);
      x15 ^= rotl(x14 + x13 | 0, 18);
    }
    out[oi++] = y00 + x00 | 0;
    out[oi++] = y01 + x01 | 0;
    out[oi++] = y02 + x02 | 0;
    out[oi++] = y03 + x03 | 0;
    out[oi++] = y04 + x04 | 0;
    out[oi++] = y05 + x05 | 0;
    out[oi++] = y06 + x06 | 0;
    out[oi++] = y07 + x07 | 0;
    out[oi++] = y08 + x08 | 0;
    out[oi++] = y09 + x09 | 0;
    out[oi++] = y10 + x10 | 0;
    out[oi++] = y11 + x11 | 0;
    out[oi++] = y12 + x12 | 0;
    out[oi++] = y13 + x13 | 0;
    out[oi++] = y14 + x14 | 0;
    out[oi++] = y15 + x15 | 0;
  }
  function BlockMix(input, ii, out, oi, r) {
    let head = oi + 0;
    let tail = oi + 16 * r;
    for (let i = 0; i < 16; i++)
      out[tail + i] = input[ii + (2 * r - 1) * 16 + i];
    for (let i = 0; i < r; i++, head += 16, ii += 16) {
      XorAndSalsa(out, tail, input, ii, out, head);
      if (i > 0)
        tail += 16;
      XorAndSalsa(out, head, input, ii += 16, out, tail);
    }
  }
  var SCRYPT_DEFAULT_MAXMEM = 128 * 8 * (__pow(2, 20) + 1 + 1);
  function scryptInit(password, salt, _opts) {
    const opts = checkOpts({
      dkLen: 32,
      asyncTick: 10,
      maxmem: SCRYPT_DEFAULT_MAXMEM
    }, _opts);
    const { N, r, p, dkLen, asyncTick, maxmem, onProgress } = opts;
    anumber(N, "N");
    anumber(r, "r");
    anumber(p, "p");
    anumber(dkLen, "dkLen");
    anumber(asyncTick, "asyncTick");
    anumber(maxmem, "maxmem");
    if (onProgress !== void 0 && typeof onProgress !== "function")
      throw new Error('"onProgress" must be a function');
    if (r < 1)
      throw new Error('"r" expected integer >= 1');
    const blockSize = 128 * r;
    const blockSize32 = blockSize / 4;
    const pow32 = Math.pow(2, 32);
    if (N <= 1 || (N & N - 1) !== 0 || N > pow32)
      throw new Error('"N" expected a power of 2, and 2^1 <= N <= 2^32');
    if (p < 1 || p > (pow32 - 1) * 32 / blockSize)
      throw new Error('"p" expected integer 1..((2^32 - 1) * 32) / (128 * r)');
    if (dkLen < 1 || dkLen > (pow32 - 1) * 32)
      throw new Error('"dkLen" expected integer 1..(2^32 - 1) * 32');
    const memUsed = blockSize * (N + p + 1);
    if (memUsed > maxmem)
      throw new Error('"maxmem" limit was hit: memUsed(128*r*(N+p+1))=' + memUsed + ", maxmem=" + maxmem);
    const B = pbkdf2(sha256, password, salt, { c: 1, dkLen: blockSize * p });
    const B32 = u32(B);
    const V = u32(new Uint8Array(blockSize * N));
    const tmp = u32(new Uint8Array(blockSize));
    let blockMixCb = () => {
    };
    if (onProgress) {
      const totalBlockMix = 2 * N * p;
      const callbackPer = Math.max(Math.floor(totalBlockMix / 1e4), 1);
      let blockMixCnt = 0;
      blockMixCb = () => {
        blockMixCnt++;
        if (onProgress && (!(blockMixCnt % callbackPer) || blockMixCnt === totalBlockMix)) {
          try {
            onProgress(blockMixCnt / totalBlockMix);
          } catch (e) {
            clean(B, V, tmp);
            throw e;
          }
        }
      };
    }
    return { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb, asyncTick };
  }
  function scryptOutput(password, dkLen, B, V, tmp) {
    const res = pbkdf2(sha256, password, B, { c: 1, dkLen });
    clean(B, V, tmp);
    return res;
  }
  function scrypt(password, salt, opts) {
    const { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb } = scryptInit(password, salt, opts);
    swap32IfBE(B32);
    for (let pi = 0; pi < p; pi++) {
      const Pi = blockSize32 * pi;
      for (let i = 0; i < blockSize32; i++)
        V[i] = B32[Pi + i];
      for (let i = 0, pos = 0; i < N - 1; i++) {
        BlockMix(V, pos, V, pos += blockSize32, r);
        blockMixCb();
      }
      BlockMix(V, (N - 1) * blockSize32, B32, Pi, r);
      blockMixCb();
      for (let i = 0; i < N; i++) {
        const j = (B32[Pi + blockSize32 - 16] & N - 1) >>> 0;
        for (let k = 0; k < blockSize32; k++)
          tmp[k] = B32[Pi + k] ^ V[j * blockSize32 + k];
        BlockMix(tmp, 0, B32, Pi, r);
        blockMixCb();
      }
    }
    swap32IfBE(B32);
    return scryptOutput(password, dkLen, B, V, tmp);
  }

  // basecamp/js/config.ts
  var SITENAME = "Local Area Network";
  var MAIN_PAGE = "Main Page";
  var ADMIN_KEY = "ee7a5fc7ab70a820df10a4d3ba12f2e3f830c3f486b0d645eded9e8ff729ce08";
  var TOPIC = "/logos-wiki/1/lan/json";
  var PRESET = "logos.dev";
  var MAX_TEXT = 12e4;
  var SNAPSHOT_CID = "";

  // src/lib/title.ts
  var NAMESPACES = {
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
    15: "Category talk"
  };
  var ALIASES = { image: 6, "image talk": 7, project: 4, "project talk": 5 };
  var BY_NAME = new WikiDict(
    [...Object.entries(NAMESPACES).map(([n, name]) => [name.toLowerCase(), Number(n)]), ...Object.entries(ALIASES)]
  );
  var ucfirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function makeTitle(ns, text) {
    const prefix = NAMESPACES[ns];
    return { ns, text, full: prefix ? `${prefix}:${text}` : text, fragment: "" };
  }
  function parseTitle(raw, defaultNs = 0) {
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
      if (found !== void 0) {
        ns = found;
        s = s.slice(colon + 1).trim();
      }
    }
    if (!s && !fragment) return null;
    if (/[<>[\]{}|]/.test(s) || s.length > 255) return null;
    return __spreadProps(__spreadValues({}, makeTitle(ns, ucfirst(s))), { fragment });
  }
  var dbKey = (full) => full.replace(/ /g, "_");
  function encodeTitle(full) {
    return encodeURIComponent(dbKey(full)).replace(
      /%(3A|2F|28|29|2C|21|24|3B|40|7E|2A)/g,
      (_, h) => String.fromCharCode(parseInt(h, 16))
    );
  }
  var pageUrl = (full, fragment = "") => `/wiki/${encodeTitle(full)}${fragment ? `#${anchor(fragment)}` : ""}`;
  function actionUrl(full, params) {
    const query = Object.entries(params).map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`);
    return `/index.php?title=${encodeTitle(full)}${query.join("")}`;
  }
  var anchor = (text) => text.trim().replace(/\s+/g, "_");

  // src/lib/state.ts
  var IMAGE_TYPES = new WikiBag(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  var CID = /^z[1-9A-HJ-NP-Za-km-z]{20,100}$/;
  var MAX_FILE = 50 * 1024 * 1024;
  var MAX_PENDING = 1e3;
  var order = (a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  var isInt = (n, max) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  function validUsername(raw) {
    if (typeof raw !== "string") return null;
    const title = parseTitle(raw, 2);
    if (!title || title.ns !== 2 || title.fragment || title.text.length > 85) return null;
    if (/[/@:#]/.test(title.text) || /^\d{1,3}(\.\d{1,3}){3}$/.test(title.text)) return null;
    return title.text;
  }
  function canonicalTitle(raw) {
    if (typeof raw !== "string") return null;
    const title = parseTitle(raw);
    return title && title.ns >= 0 && !title.fragment && title.full === raw ? title : null;
  }
  var Wiki = class {
    constructor(admin = ADMIN_KEY) {
      __publicField(this, "log", []);
      __publicField(this, "pages", new WikiDict());
      __publicField(this, "revisions", []);
      __publicField(this, "accounts", new WikiDict());
      __publicField(this, "names", new WikiDict());
      __publicField(this, "trusted", []);
      __publicField(this, "files", new WikiDict());
      __publicField(this, "reserved", new WikiBag());
      __publicField(this, "ids", new WikiBag());
      __publicField(this, "pending", new WikiDict());
      __publicField(this, "admin");
      this.admin = admin;
    }
    has(id) {
      return this.ids.has(id);
    }
    isPending(id) {
      return this.pending.has(id);
    }
    add(event) {
      if (this.ids.has(event.id) || this.pending.has(event.id)) return false;
      const last = this.log.at(-1);
      const reserves = "as" in event && event.as && !this.reserved.has(event.as);
      if ((!last || order(last, event) < 0) && !reserves) {
        if (!this.attempt(event)) return false;
        this.drain();
        return true;
      }
      this.rebuild([...this.log, ...this.pending.values(), event]);
      return this.ids.has(event.id);
    }
    rebuild(events) {
      Object.assign(this, {
        log: [],
        pages: new WikiDict(),
        revisions: [],
        accounts: new WikiDict(),
        names: new WikiDict(),
        trusted: [],
        files: new WikiDict(),
        ids: new WikiBag(),
        pending: new WikiDict()
      });
      this.reserved = new WikiBag(events.flatMap((e) => "as" in e && e.as && e.by === this.admin ? [e.as] : []));
      for (const event of [...events].sort(order)) if (!this.ids.has(event.id)) this.attempt(event);
    }
    canEdit(key, title) {
      if (key === this.admin) return true;
      const user = this.names.get(key);
      if (!user || title.ns === 8 || title.ns === 9) return false;
      if ((title.ns === 2 || title.ns === 3) && title.text.split("/")[0] === user) return true;
      return this.trusted.includes(user);
    }
    canUpload(key) {
      const user = this.names.get(key);
      return key === this.admin || !!user && this.trusted.includes(user);
    }
    isAdmin(name) {
      var _a;
      return ((_a = this.accounts.get(name)) == null ? void 0 : _a.key) === this.admin;
    }
    latest(full) {
      var _a;
      return (_a = this.pages.get(full)) == null ? void 0 : _a.revs.at(-1);
    }
    stats() {
      let articles = 0;
      this.pages.forEach((page) => {
        const text = page.revs.at(-1).text;
        if (page.title.ns === 0 && !/^\s*#redirect/i.test(text) && text.includes("[[")) articles++;
      });
      const users = new WikiBag(this.accounts.keys());
      this.reserved.forEach((name) => users.add(name));
      users.delete("MediaWiki default");
      return { articles, pages: this.pages.size, edits: this.revisions.length, users: users.size };
    }
    keep(event) {
      this.log.push(event);
      this.ids.add(event.id);
    }
    attempt(event) {
      if (this.apply(event)) {
        this.pending.delete(event.id);
        this.keep(event);
        return true;
      }
      if (event.t !== "account" && !this.names.has(event.by)) this.park(event);
      return false;
    }
    park(event) {
      this.pending.set(event.id, event);
      if (this.pending.size > MAX_PENDING) this.pending.delete(this.pending.keys().next().value);
    }
    drain() {
      for (let progress = true; progress; ) {
        progress = false;
        for (const event of [...this.pending.values()].sort(order)) {
          if (order(this.log.at(-1), event) < 0 && this.apply(event)) {
            this.pending.delete(event.id);
            this.keep(event);
            progress = true;
          }
        }
      }
    }
    author(event) {
      if (event.as === void 0) return this.names.get(event.by);
      return event.by === this.admin && validUsername(event.as) === event.as ? event.as : void 0;
    }
    apply(event) {
      switch (event.t) {
        case "account":
          return this.applyAccount(event);
        case "edit":
          return this.applyEdit(event);
        case "trust":
          return this.applyTrust(event);
        case "file":
          return this.applyFile(event);
      }
    }
    applyAccount(event) {
      const name = validUsername(event.name);
      if (!name || name !== event.name || this.names.has(event.by) || this.accounts.has(name)) return false;
      if (this.reserved.has(name) && event.by !== this.admin) return false;
      this.accounts.set(name, { name, key: event.by, ts: event.ts });
      this.names.set(event.by, name);
      return true;
    }
    applyEdit(event) {
      var _a, _b, _c, _d;
      const user = this.author(event);
      const title = canonicalTitle(event.title);
      const { text, summary } = event;
      if (!user || !title || typeof text !== "string" || typeof summary !== "string") return false;
      if (text.length > MAX_TEXT || summary.length > 500 || !this.canEdit(event.by, title)) return false;
      const page = (_a = this.pages.get(title.full)) != null ? _a : { title, revs: [] };
      if (((_b = page.revs.at(-1)) == null ? void 0 : _b.text) === text) return false;
      const rev = {
        id: this.revisions.length + 1,
        event: event.id,
        page: title.full,
        ts: event.ts,
        user,
        summary,
        minor: event.minor === true,
        text,
        parent: (_d = (_c = page.revs.at(-1)) == null ? void 0 : _c.id) != null ? _d : 0
      };
      page.revs.push(rev);
      this.revisions.push(rev);
      this.pages.set(title.full, page);
      return true;
    }
    applyTrust(event) {
      if (event.by !== this.admin || !Array.isArray(event.editors) || event.editors.length > 1e3) return false;
      const names = [];
      for (let i = 0; i < event.editors.length; i++) {
        const n = validUsername(event.editors[i]);
        if (n && names.indexOf(n) < 0) names.push(n);
      }
      this.trusted = names;
      return true;
    }
    applyFile(event) {
      const user = this.author(event);
      const title = parseTitle(String(event.name), 6);
      const { cid, mime, size, sha, width, height } = event;
      if (!user || !title || title.ns !== 6 || title.text !== event.name || !this.canUpload(event.by)) return false;
      if (typeof cid !== "string" || !CID.test(cid) || !IMAGE_TYPES.has(mime) || typeof sha !== "string") return false;
      if (!/^[0-9a-f]{64}$/.test(sha) || !isInt(size, MAX_FILE) || !isInt(width, 1e5) || !isInt(height, 1e5)) return false;
      this.files.set(title.text, { name: title.text, cid, mime, size, sha, width, height, user, ts: event.ts });
      return true;
    }
  };

  // basecamp/js/shims/ed25519.ts
  var import_tweetnacl = __toESM(require_nacl_fast(), 1);
  var pair = (seed) => import_tweetnacl.default.sign.keyPair.fromSeed(seed);
  var ed25519 = {
    getPublicKey: (seed) => pair(seed).publicKey,
    sign: (message, seed) => import_tweetnacl.default.sign.detached(message, pair(seed).secretKey),
    verify: (signature, message, publicKey2) => {
      try {
        return import_tweetnacl.default.sign.detached.verify(message, signature, publicKey2);
      } catch (e) {
        return false;
      }
    }
  };

  // src/lib/events.ts
  var KINDS = new WikiBag(["account", "edit", "trust", "file"]);
  var sha256Hex = (bytes) => bytesToHex(sha256(bytes));
  var publicKey = (seed) => bytesToHex(ed25519.getPublicKey(seed));
  function sign(seed, body, ts = Date.now()) {
    const data = JSON.stringify(__spreadValues({ v: 1, by: publicKey(seed), ts }, body));
    return { data, sig: bytesToHex(ed25519.sign(utf8ToBytes(data), seed)) };
  }
  function verify(envelope) {
    if (!envelope || typeof envelope !== "object") return null;
    const { data, sig } = envelope;
    if (typeof data !== "string" || typeof sig !== "string" || !/^[0-9a-f]{128}$/.test(sig)) return null;
    let event;
    try {
      event = JSON.parse(data);
    } catch (e) {
      return null;
    }
    if ((event == null ? void 0 : event.v) !== 1 || !KINDS.has(event.t) || !Number.isSafeInteger(event.ts)) return null;
    if (typeof event.by !== "string" || !/^[0-9a-f]{64}$/.test(event.by)) return null;
    const bytes = utf8ToBytes(data);
    try {
      if (!ed25519.verify(hexToBytes(sig), bytes, hexToBytes(event.by))) return null;
    } catch (e) {
      return null;
    }
    return __spreadProps(__spreadValues({}, event), { id: sha256Hex(bytes) });
  }

  // src/lib/format.ts
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var at = (ts) => new Date(ts);
  var pad = (n) => String(n).padStart(2, "0");
  var formatDate = (ts) => `${at(ts).getUTCDate()} ${MONTHS[at(ts).getUTCMonth()]} ${at(ts).getUTCFullYear()}`;
  var formatTime = (ts) => `${pad(at(ts).getUTCHours())}:${pad(at(ts).getUTCMinutes())}`;
  var formatDateTime = (ts) => `${formatTime(ts)}, ${formatDate(ts)}`;
  var formatNumber = (n) => {
    const sign2 = n < 0 ? "-" : "";
    const [whole, frac] = Math.abs(n).toString().split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign2 + grouped + (frac ? "." + frac : "");
  };

  // src/lib/wikitext/sanitize.ts
  var TAGS = new WikiBag(
    "b i u s del ins strike big small sub sup tt code kbd samp var cite q dfn abbr span div p br hr center font blockquote pre h1 h2 h3 h4 h5 h6 table caption thead tbody tfoot tr td th ul ol li dl dt dd em strong mark bdi bdo ruby rt rp wbr data time".split(" ")
  );
  var VOID = new WikiBag(["br", "hr", "wbr"]);
  var ATTRS = new WikiBag(
    "class id style title lang dir align valign width height colspan rowspan cellpadding cellspacing border bgcolor color face size scope start type value reversed datetime".split(" ")
  );
  var UNSAFE_CSS = /expression|url\s*\(|image-set|attr\s*\(|-moz-binding|behavior\s*:|@import|javascript:|[<>\\]|\/\*/i;
  var escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  var decodeRefs = (s) => s.replace(
    /&#(x[0-9a-f]+|\d+);?/gi,
    (_, n) => String.fromCodePoint(n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n))
  );
  var ATTR_ESCAPES = [
    [/\{/g, "&#123;"],
    [/\}/g, "&#125;"],
    [/\[/g, "&#91;"],
    [/\]/g, "&#93;"],
    [/''/g, "&#39;&#39;"],
    [/\|/g, "&#124;"],
    [/__/g, "&#95;_"],
    [/\b(https?|ftp|mailto|irc|news|gopher):/gi, "$1&#58;"],
    [/\n/g, "&#10;"],
    [/\t/g, "&#9;"]
  ];
  var escapeAttr = (s) => ATTR_ESCAPES.reduce((v, [re, to]) => v.replace(re, to), escapeHtml(s));
  var fixAmpersands = (s) => s.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, "&amp;");
  function sanitizeAttrs(raw) {
    var _a, _b, _c;
    let out = "";
    for (const m of raw.matchAll(/([a-zA-Z][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      const name = m[1].toLowerCase();
      let value = decodeRefs((_c = (_b = (_a = m[2]) != null ? _a : m[3]) != null ? _b : m[4]) != null ? _c : "").trim();
      if (!ATTRS.has(name)) continue;
      if (name === "style" && UNSAFE_CSS.test(value)) continue;
      if (name === "id") value = value.replace(/\s+/g, "_");
      out += ` ${name}="${escapeAttr(value)}"`;
    }
    return out;
  }
  function sanitizeTags(text) {
    return text.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^<>]*)>|<|>/g, (match, close, rawTag, attrs) => {
      if (match === ">") return "&gt;";
      const tag = rawTag == null ? void 0 : rawTag.toLowerCase();
      if (!tag || !TAGS.has(tag)) return `&lt;${match.slice(1)}`;
      if (close) return VOID.has(tag) ? "" : `</${tag}>`;
      return `<${tag}${sanitizeAttrs(attrs.replace(/\/\s*$/, ""))}${VOID.has(tag) ? " /" : ""}>`;
    });
  }
  function balanceTags(html) {
    const stack = [];
    const out = html.replace(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/g, (match, close, tag, selfClose) => {
      if (VOID.has(tag) || selfClose || !(TAGS.has(tag) || tag === "a")) return match;
      if (!close) {
        stack.push(tag);
        return match;
      }
      const at2 = stack.lastIndexOf(tag);
      if (at2 < 0) return "";
      const closers = stack.splice(at2).reverse().map((t) => `</${t}>`);
      return closers.join("");
    });
    return out + stack.reverse().map((t) => `</${t}>`).join("");
  }

  // src/lib/wikitext/blocks.ts
  function cellsOf(line, kind) {
    const body = kind === "+" ? line.slice(2) : line.slice(1);
    return (kind === "!" ? body.replace(/!!/g, "||") : body).split("||");
  }
  function doTables(text) {
    const out = [];
    const stack = [];
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
        for (const cell2 of cellsOf(line, kind)) {
          let previous = "";
          if (kind !== "+") {
            if (!top.tr) previous = `<tr${top.trAttrs}>
`;
            Object.assign(top, { tr: true, trAttrs: "", openedTr: true });
          }
          if (top.td) previous = `</${top.tag}>
${previous}`;
          top.tag = kind === "|" ? "td" : kind === "!" ? "th" : "caption";
          const pipe = cell2.indexOf("|");
          const hasAttrs = pipe >= 0 && !cell2.slice(0, pipe).includes("[[");
          const attrs = hasAttrs ? sanitizeAttrs(cell2.slice(0, pipe)) : "";
          html += `${previous}<${top.tag}${attrs}>${(hasAttrs ? cell2.slice(pipe + 1) : cell2).trim()}`;
          top.td = true;
        }
        out.push(html);
      } else out.push(raw);
    }
    while (stack.length) {
      const top = stack.pop();
      out.push(`${top.td ? `</${top.tag}>` : ""}${top.tr ? "</tr>" : ""}${top.openedTr ? "" : "<tr><td></td></tr>"}</table>`);
    }
    return out.join("\n");
  }
  var OPEN = /(?:<table|<h[1-6]|<pre|<tr|<p|<ul|<ol|<dl|<li|<\/tr|<\/td|<\/th)\b/i;
  var CLOSE = /(?:<\/table|<\/h[1-6]|<td|<th|<\/?blockquote|<\/?div|<hr|<\/pre|<\/p|<\/li|<\/ul|<\/ol|<\/dl|<\/?center|<figure|<\/figure)\b|\x7fUNIQ-pre/i;
  var LIST_TAG = { "*": "ul", "#": "ol", ":": "dl", ";": "dl" };
  var ITEM_TAG = { "*": "li", "#": "li", ":": "dd", ";": "dt" };
  var common = (a, b) => {
    let i = 0;
    while (i < a.length && i < b.length && (a[i] === b[i] || a[i] === ";" && b[i] === ":" || a[i] === ":" && b[i] === ";")) i++;
    return i;
  };
  function doBlockLevels(text) {
    const lines = text.split("\n");
    let out = "";
    let last = "";
    let section = "";
    let pending = false;
    let inBlock = false;
    let inPre = false;
    let dtOpen = false;
    const closeParagraph = () => {
      const html = section ? `</${section}>
` : "";
      section = "";
      return html;
    };
    const openItem = (char) => {
      dtOpen = char === ";";
      return `<${ITEM_TAG[char]}>`;
    };
    const closeItem = (char) => LIST_TAG[char] === "dl" ? dtOpen ? "</dt>" : "</dd>" : "</li>";
    const openList = (char) => `<${LIST_TAG[char]}>${openItem(char)}`;
    const nextItem = (char) => `${closeItem(char)}
${openItem(char)}`;
    const closeList = (char) => `${closeItem(char)}</${LIST_TAG[char]}>`;
    const definitionSplit = (text2) => {
      const colon = text2.indexOf(":");
      if (colon < 0) return text2;
      dtOpen = false;
      return `${text2.slice(0, colon)}</dt><dd>${text2.slice(colon + 1).trimStart()}`;
    };
    lines.forEach((line, index) => {
      const isLast = index === lines.length - 1;
      const prefix = inPre ? "" : /^[*#:;]*/.exec(line)[0];
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
  var plain = (html) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
  var legacyAnchor = (anchor2) => encodeURIComponent(anchor2).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%3A/g, ":").replace(/%/g, ".");
  function doHeadings(text) {
    return text.replace(/^(={1,6})(.+)\1[ \t]*$/gm, (_, eq, inner) => `<h${eq.length}>${inner.trim()}</h${eq.length}>`);
  }
  function formatHeadings(html, headings2, editLink) {
    const used = new WikiDict();
    const levels = [];
    const counters = [];
    return html.replace(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1\s*>/gi, (_, n, attrs = "", inner) => {
      var _a, _b;
      const level = Number(n);
      while (levels.length && levels[levels.length - 1] > level) levels.pop();
      if (!levels.length || levels[levels.length - 1] < level) levels.push(level);
      const toclevel = levels.length;
      counters.length = toclevel;
      counters[toclevel - 1] = ((_a = counters[toclevel - 1]) != null ? _a : 0) + 1;
      const text = plain(inner);
      const base = text.replace(/\s+/g, "_");
      const count = ((_b = used.get(base)) != null ? _b : 0) + 1;
      used.set(base, count);
      const anchor2 = count > 1 ? `${base}_${count}` : base;
      headings2.push({ level, text, anchor: anchor2, number: counters.join("."), toclevel });
      const edit = editLink ? editLink(headings2.length, text) : "";
      const id = anchor2.replace(/"/g, "&quot;");
      const legacy = legacyAnchor(anchor2);
      const old = legacy === anchor2 ? "" : `<span id="${legacy}"></span>`;
      return `<h${n}${attrs}>${old}<span class="mw-headline" id="${id}">${inner}</span>${edit}</h${n}>`;
    });
  }

  // src/lib/wikitext/inline.ts
  function balanceQuotes(arr) {
    let italics = 0;
    let bold = 0;
    for (let i = 1; i < arr.length; i += 2) {
      let len = arr[i].length;
      if (len === 4) {
        arr[i - 1] += "'";
        arr[i] = "'''";
        len = 3;
      } else if (len > 5) {
        arr[i - 1] += "'".repeat(len - 5);
        arr[i] = "'''''";
        len = 5;
      }
      if (len === 2 || len === 5) italics++;
      if (len === 3 || len === 5) bold++;
    }
    if (italics % 2 === 0 || bold % 2 === 0) return;
    let single = -1;
    let multi = -1;
    let space = -1;
    for (let i = 1; i < arr.length; i += 2) {
      if (arr[i].length !== 3) continue;
      const x1 = arr[i - 1].slice(-1);
      const x2 = arr[i - 1].slice(-2, -1);
      if (x1 === " ") {
        if (space < 0) space = i;
      } else if (x2 === " ") {
        single = i;
        break;
      } else if (multi < 0) multi = i;
    }
    const at2 = single >= 0 ? single : multi >= 0 ? multi : space;
    if (at2 >= 0) {
      arr[at2] = "''";
      arr[at2 - 1] += "'";
    }
  }
  var QUOTE_STEPS = {
    "2": { i: ["</i>", ""], bi: ["</i>", "b"], ib: ["</b></i><b>", "b"], "": ["<i>", "i"], b: ["<i>", "bi"] },
    "3": { b: ["</b>", ""], bi: ["</i></b><i>", "i"], ib: ["</b>", "i"], "": ["<b>", "b"], i: ["<b>", "ib"] },
    "5": { b: ["</b><i>", "i"], i: ["</i><b>", "b"], bi: ["</i></b>", ""], ib: ["</b></i>", ""], "": ["", "both"] }
  };
  function doQuotes(line) {
    const arr = line.split(/(''+)/);
    if (arr.length === 1) return line;
    balanceQuotes(arr);
    let out = "";
    let buffer = "";
    let state = "";
    arr.forEach((piece, i) => {
      if (i % 2 === 0) {
        if (state === "both") buffer += piece;
        else out += piece;
        return;
      }
      if (state === "both") {
        const len = piece.length;
        out += len === 2 ? `<b><i>${buffer}</i>` : len === 3 ? `<i><b>${buffer}</b>` : `<i><b>${buffer}</b></i>`;
        state = len === 2 ? "b" : len === 3 ? "i" : "";
        return;
      }
      const [html, next] = QUOTE_STEPS[String(piece.length)][state];
      out += html;
      state = next;
      if (state === "both") buffer = "";
    });
    if (state === "b" || state === "ib") out += "</b>";
    if (state === "i" || state === "bi" || state === "ib") out += "</i>";
    if (state === "bi") out += "</b>";
    if (state === "both" && buffer) out += `<b><i>${buffer}</i></b>`;
    return out;
  }
  function linkHtml(t, text, ctx) {
    if (!t.text && t.fragment) return `<a href="#${escapeHtml(t.fragment.replace(/ /g, "_"))}">${text}</a>`;
    if (t.full === ctx.title.full && !t.fragment) return `<a class="mw-selflink selflink">${text}</a>`;
    ctx.links.add(t.full);
    const title = escapeHtml(t.full);
    if (ctx.exists(t.full)) return `<a href="${pageUrl(t.full, t.fragment)}" title="${title}">${text}</a>`;
    const href = escapeHtml(actionUrl(t.full, { action: "edit", redlink: 1 }));
    return `<a href="${href}" class="new" title="${title} (page does not exist)">${text}</a>`;
  }
  function fileHtml(t, options, ctx) {
    const file = ctx.file(t.text);
    if (!file) return linkHtml(t, escapeHtml(t.full), ctx);
    let width = file.width;
    let alt = "";
    let thumb = false;
    let caption = "";
    for (const option of options) {
      const size = /^\s*(\d*)(?:x(\d*))?px\s*$/.exec(option);
      if (size == null ? void 0 : size[1]) width = Math.min(Number(size[1]), file.width);
      else if (/^\s*alt=/.test(option)) alt = option.replace(/^\s*alt=/, "");
      else if (/^\s*(thumb|thumbnail|frame)\s*$/.test(option)) thumb = true;
      else if (!/^\s*(left|right|center|none|border|frameless|upright.*|link=.*)\s*$/.test(option)) caption = option;
    }
    if (thumb && width === file.width) width = Math.min(250, file.width);
    const height = Math.round(file.height * width / file.width);
    const img = `<img alt="${escapeHtml(alt)}" src="/files/${encodeURIComponent(t.text)}" decoding="async" width="${width}" height="${height}" class="mw-file-element" />`;
    const link = `<a href="${pageUrl(t.full)}" class="mw-file-description">${img}</a>`;
    ctx.links.add(t.full);
    if (thumb) return `<figure class="mw-default-size" typeof="mw:File/Thumb">${link}<figcaption>${caption}</figcaption></figure>`;
    return `<span typeof="mw:File">${link}</span>`;
  }
  function internalLinks(text, ctx) {
    var _a;
    const pieces = text.split("[[");
    let out = pieces[0];
    for (const piece of pieces.slice(1)) {
      const m = /^([^[\]|\n]+)(?:\|([\s\S]*?))?\]\]([a-z]*)([\s\S]*)$/.exec(piece);
      const t = m && parseTitle(m[1]);
      if (!m || !t) {
        out += `[[${piece}`;
        continue;
      }
      const [, target, label, trail, rest] = m;
      const colon = target.trim().startsWith(":");
      if (!colon && t.ns === 14) {
        ctx.categories.push({ name: t.text, sortKey: label });
        out = out.trimEnd() + trail + rest;
      } else if (!colon && t.ns === 6) {
        out += fileHtml(t, (_a = label == null ? void 0 : label.split("|")) != null ? _a : [], ctx) + trail + rest;
      } else {
        const text2 = (label != null ? label : target.trim().replace(/^:/, "")) + trail;
        out += linkHtml(t, text2, ctx) + rest;
      }
    }
    return out;
  }
  var URL = '(?:(?:https?|ftp):)?\\/\\/[^\\s\\]<>"\\[]+|mailto:[^\\s\\]<>"\\[]+';
  function externalLinks(text) {
    let n = 0;
    const bracketed = text.replace(
      new RegExp("\\[(" + URL + ")(?:[ \\t]+([^\\]\\n]*))?\\]", "g"),
      (_, url, label) => label ? `<a rel="nofollow" class="external text" href="${url}">${label}</a>` : `<a rel="nofollow" class="external autonumber" href="${url}">[${++n}]</a>`
    );
    return bracketed.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]*>)/).map(
      (part, i) => i % 2 ? part : part.replace(/\b(?:https?|ftp):\/\/[^\s<>[\]"]+/g, (url) => {
        var _a, _b;
        const trail = (_b = (_a = (url.includes("(") ? /[.,;:!?]+$/ : /[.,;:!?)]+$/).exec(url)) == null ? void 0 : _a[0]) != null ? _b : "";
        const href = url.slice(0, url.length - trail.length);
        return `<a rel="nofollow" class="external free" href="${href}">${href}</a>${trail}`;
      })
    ).join("");
  }

  // src/lib/wikitext/preprocess.ts
  var MAX_DEPTH = 40;
  function scan(s, pos, closer, depth) {
    const parts = [[]];
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
  function openBrace(s, pos, depth) {
    const kind = s.startsWith("{{{", pos) ? "arg" : "tpl";
    const width = kind === "arg" ? 3 : 2;
    const inner = scan(s, pos + width, kind === "arg" ? "}}}" : "}}", depth + 1);
    return inner.closed ? { node: { kind, parts: inner.parts }, pos: inner.pos } : null;
  }
  var viewSource = (src) => src.replace(/<includeonly>[\s\S]*?(<\/includeonly>|$)/gi, "").replace(/<\/?(noinclude|onlyinclude)\s*>/gi, "");
  function includeSource(src) {
    const only = [...src.matchAll(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/gi)];
    if (only.length) return only.map((m) => m[1]).join("");
    return src.replace(/<noinclude>[\s\S]*?(<\/noinclude>|$)/gi, "").replace(/<\/?includeonly\s*>/gi, "");
  }
  function expandTemplates(text, source, meta) {
    const run = (nodes, frame) => nodes.map((n) => typeof n === "string" ? n : n.kind === "arg" ? arg(n.parts, frame) : tpl(n.parts, frame)).join("");
    const arg = (parts, frame) => {
      var _a;
      const name = run(parts[0], frame).trim();
      const value = (_a = frame.args) == null ? void 0 : _a.get(name);
      if (value !== void 0) return value;
      if (parts.length > 1) return parts.slice(1).map((p) => run(p, frame)).join("|");
      return `{{{${parts.map((p) => run(p, frame)).join("|")}}}}`;
    };
    const tpl = (parts, frame) => {
      const literal = () => `{{${parts.map((p) => run(p, frame)).join("|")}}}`;
      const name = run(parts[0], frame).trim().replace(/^(safe)?subst:/i, "");
      const sort = /^DEFAULTSORT(?:KEY)?:([\s\S]*)$/i.exec(name);
      if (sort) {
        meta.sortKey = sort[1].trim();
        return "";
      }
      if (parts.length === 1) {
        const value = source.variable(name);
        if (value !== void 0) return value;
      }
      if (name.startsWith("#")) return literal();
      const title = parseTitle(name, 10);
      if (!title) return literal();
      if (frame.stack.includes(title.full) || frame.stack.length >= MAX_DEPTH)
        return `<span class="error">Template loop detected: [[:${title.full}]]</span>`;
      const src = source.template(title.full);
      if (src === null) return `[[:${title.full}]]`;
      const args = new WikiDict();
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

  // src/lib/wikitext/index.ts
  var SWITCHES = /__(NOTOC|FORCETOC|TOC|NOEDITSECTION|NOGALLERY|NOTITLECONVERT|NOTC|NOCONTENTCONVERT|NOCC|INDEX|NOINDEX|STATICREDIRECT|HIDDENCAT|NEWSECTIONLINK|NONEWSECTIONLINK)__/g;
  function strip(text, store) {
    const keep = (kind, html) => `\x7FUNIQ-${kind}-${store.push(html) - 1}\x7F`;
    return text.replace(/<!--[\s\S]*?(-->|$)/g, "").replace(/<nowiki\s*>([\s\S]*?)<\/nowiki\s*>/gi, (_, s) => keep("nowiki", fixAmpersands(s.replace(/</g, "&lt;").replace(/>/g, "&gt;")))).replace(/<nowiki\s*\/>/gi, "").replace(
      /<pre(\s[^>]*)?>([\s\S]*?)<\/pre\s*>/gi,
      (_, attrs = "", s) => keep("pre", `<pre${sanitizeAttrs(attrs)}>${fixAmpersands(s.replace(/^\n/, "").replace(/</g, "&lt;").replace(/>/g, "&gt;"))}</pre>`)
    );
  }
  var CODE_PAGE = /\.(css|js|json)$/;
  var isCodePage = (title) => (title.ns === 8 || title.ns === 2) && CODE_PAGE.test(title.text);
  function codeHtml(source, title) {
    const lang = CODE_PAGE.exec(title.text)[1];
    return `<pre class="mw-code mw-${lang === "js" ? "js" : lang}" dir="ltr">
${escapeHtml(source)}
</pre>`;
  }
  function redirectHtml(target, link) {
    return `<div class="redirectMsg"><p>Redirect to:</p><ul class="redirectText"><li>${linkHtml(target, escapeHtml(target.full), link)}</li></ul></div>`;
  }
  var unstrip = (text, store) => text.replace(/\x7fUNIQ-\w+-(\d+)\x7f/g, (_, i) => store[Number(i)]);
  function variables(ctx) {
    const { title, stats } = ctx;
    const slash = title.text.lastIndexOf("/");
    return {
      PAGENAME: title.text,
      FULLPAGENAME: title.full,
      NAMESPACE: NAMESPACES[title.ns],
      BASEPAGENAME: slash > 0 ? title.text.slice(0, slash) : title.text,
      SUBPAGENAME: slash > 0 ? title.text.slice(slash + 1) : title.text,
      ROOTPAGENAME: title.text.split("/")[0],
      SITENAME,
      NUMBEROFARTICLES: formatNumber(stats.articles),
      NUMBEROFPAGES: formatNumber(stats.pages),
      NUMBEROFEDITS: formatNumber(stats.edits),
      NUMBEROFUSERS: formatNumber(stats.users)
    };
  }
  function editSection(ctx) {
    if (!ctx.editable) return void 0;
    return (section, text) => {
      const href = escapeHtml(actionUrl(ctx.title.full, { action: "edit", section }));
      return `<span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="${href}" title="Edit section: ${escapeHtml(text)}"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span>`;
    };
  }
  var wrap = (html) => `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr">${html}</div>`;
  function render(source, ctx) {
    const link = { title: ctx.title, exists: ctx.exists, file: ctx.file, categories: [], links: new WikiBag() };
    const result = { categories: link.categories, headings: [], links: link.links, redirect: null, toc: false };
    if (isCodePage(ctx.title)) return __spreadProps(__spreadValues({}, result), { html: wrap(codeHtml(source, ctx.title)) });
    const redirectMatch = /^\s*#REDIRECT\s*:?\s*\[\[([^\]|]+)/i.exec(source);
    const redirect = redirectMatch ? parseTitle(redirectMatch[1]) : null;
    if (redirect) return __spreadProps(__spreadValues({}, result), { redirect, html: wrap(redirectHtml(redirect, link)) });
    const store = [];
    const meta = {};
    const vars = variables(ctx);
    let text = strip(viewSource(source), store);
    const template = (full) => {
      const src = ctx.template(full);
      return src === null ? null : strip(src, store);
    };
    text = expandTemplates(text, { title: ctx.title, template, variable: (n) => vars[n] }, meta);
    const toc = !/__NOTOC__/.test(text);
    const noEdit = /__NOEDITSECTION__/.test(text);
    text = text.replace(SWITCHES, "");
    text = fixAmpersands(sanitizeTags(text));
    text = doTables(text);
    text = text.replace(/^-{4,}/gm, "<hr />");
    text = doHeadings(text);
    text = text.split("\n").map(doQuotes).join("\n");
    text = internalLinks(text, link);
    text = externalLinks(text);
    text = doBlockLevels(text);
    const headings2 = [];
    text = formatHeadings(text, headings2, noEdit ? void 0 : editSection(ctx));
    text = balanceTags(unstrip(text, store));
    return __spreadProps(__spreadValues({}, result), { html: wrap(text), headings: headings2, sortKey: meta.sortKey, toc });
  }

  // src/lib/diff.ts
  var MAX_CELLS = 4e6;
  function sequence(a, b) {
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let endA = a.length;
    let endB = b.length;
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
      endA--;
      endB--;
    }
    const head = a.slice(0, start).map((text) => ({ kind: "same", text }));
    const tail = a.slice(endA).map((text) => ({ kind: "same", text }));
    const x = a.slice(start, endA);
    const y = b.slice(start, endB);
    return [...head, ...middle(x, y), ...tail];
  }
  function middle(x, y) {
    const n = x.length;
    const m = y.length;
    if (n * m > MAX_CELLS) return [...x.map((text) => ({ kind: "del", text })), ...y.map((text) => ({ kind: "add", text }))];
    const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i2 = n - 1; i2 >= 0; i2--) {
      for (let j2 = m - 1; j2 >= 0; j2--) table[i2][j2] = x[i2] === y[j2] ? table[i2 + 1][j2 + 1] + 1 : Math.max(table[i2 + 1][j2], table[i2][j2 + 1]);
    }
    const ops = [];
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
  var tokens = (s) => {
    var _a;
    return (_a = s.match(/\s+|\w+|[^\s\w]/g)) != null ? _a : [];
  };
  function inline(before, after) {
    let del = "";
    let ins = "";
    for (const op of sequence(tokens(before), tokens(after))) {
      const text = escapeHtml(op.text);
      if (op.kind !== "add") del += op.kind === "del" ? `<del class="diffchange diffchange-inline">${text}</del>` : text;
      if (op.kind !== "del") ins += op.kind === "add" ? `<ins class="diffchange diffchange-inline">${text}</ins>` : text;
    }
    return [del.replace(/<\/del><del class="diffchange diffchange-inline">/g, ""), ins.replace(/<\/ins><ins class="diffchange diffchange-inline">/g, "")];
  }
  var cell = (html) => `<div>${html}</div>`;
  var context = (text) => {
    const html = cell(escapeHtml(text));
    return `<tr><td class="diff-marker"></td><td class="diff-context diff-side-deleted">${html}</td><td class="diff-marker"></td><td class="diff-context diff-side-added">${html}</td></tr>`;
  };
  var deleted = (html) => `<td class="diff-marker" data-marker="\u2212"></td><td class="diff-deletedline diff-side-deleted">${cell(html)}</td>`;
  var added = (html) => `<td class="diff-marker" data-marker="+"></td><td class="diff-addedline diff-side-added">${cell(html)}</td>`;
  var emptyLeft = `<td colspan="2" class="diff-empty diff-side-deleted"></td>`;
  var emptyRight = `<td colspan="2" class="diff-empty diff-side-added"></td>`;
  function changeRows(dels, adds) {
    const rows = [];
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
      const d = dels[k];
      const a = adds[k];
      if (d !== void 0 && a !== void 0) {
        const [left, right] = inline(d, a);
        rows.push(`<tr>${deleted(left)}${added(right)}</tr>`);
      } else if (d !== void 0) rows.push(`<tr>${deleted(escapeHtml(d))}${emptyRight}</tr>`);
      else rows.push(`<tr>${emptyLeft}${added(escapeHtml(a))}</tr>`);
    }
    return rows;
  }
  function diffRows(before, after, radius = 2) {
    const ops = sequence(before.split("\n"), after.split("\n"));
    const changed = ops.map((op) => op.kind !== "same");
    const near = ops.map((_, k) => changed.slice(Math.max(0, k - radius), k + radius + 1).some(Boolean));
    const rows = [];
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
      const dels = [];
      const adds = [];
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

  // src/lib/sections.ts
  var HEADING = /^(={1,6})(.+?)\1[ \t]*$/gm;
  var OPAQUE = /<!--[\s\S]*?(?:-->|$)|<(nowiki|pre)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;
  function headings(text) {
    const masked = text.replace(OPAQUE, (m) => m.replace(/=/g, " "));
    return [...masked.matchAll(HEADING)].map((m) => ({ start: m.index, level: m[1].length }));
  }
  function bounds(text, n) {
    const list = headings(text);
    const heading = list[n - 1];
    if (!heading) return null;
    const next = list.slice(n).find((h) => h.level <= heading.level);
    return [heading.start, next ? next.start : text.length];
  }
  function sectionText(text, n) {
    const range = bounds(text, n);
    return range ? text.slice(range[0], range[1]).replace(/\n+$/, "") : null;
  }
  function replaceSection(text, n, replacement) {
    const range = bounds(text, n);
    if (!range) return null;
    const rest = text.slice(range[1]);
    return `${text.slice(0, range[0])}${replacement.replace(/\n+$/, "")}${rest ? `

${rest}` : ""}`;
  }
  var appendSection = (text, heading, body) => `${text.replace(/\n+$/, "")}${text.trim() ? "\n\n" : ""}== ${heading} ==

${body.trim()}`;

  // basecamp/js/shims/utils.ts
  function bytesToHex2(bytes) {
    let hex = "";
    for (let i = 0; i < bytes.length; i++) hex += (bytes[i] + 256).toString(16).slice(1);
    return hex;
  }
  function hexToBytes2(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  function utf8FromBytes(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; ) {
      const b = bytes[i++];
      let c = b;
      if (b >= 240) {
        c = (b & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
      } else if (b >= 224) {
        c = (b & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
      } else if (b >= 192) {
        c = (b & 31) << 6 | bytes[i++] & 63;
      }
      out += c >= 65536 ? String.fromCharCode(55296 + (c - 65536 >> 10), 56320 + (c - 65536 & 1023)) : String.fromCharCode(c);
    }
    return out;
  }

  // basecamp/js/bytes.ts
  var TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function base64ToBytes(text) {
    const clean2 = text.replace(/[^A-Za-z0-9+/_-]/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const pad2 = clean2.length % 4 === 0 ? clean2 : clean2 + "=".repeat(4 - clean2.length % 4);
    const out = [];
    for (let i = 0; i < pad2.length; i += 4) {
      const n = TABLE.indexOf(pad2[i]) << 18 | TABLE.indexOf(pad2[i + 1]) << 12 | (pad2[i + 2] === "=" ? 0 : TABLE.indexOf(pad2[i + 2])) << 6 | (pad2[i + 3] === "=" ? 0 : TABLE.indexOf(pad2[i + 3]));
      out.push(n >> 16 & 255);
      if (pad2[i + 2] !== "=") out.push(n >> 8 & 255);
      if (pad2[i + 3] !== "=") out.push(n & 255);
    }
    return new Uint8Array(out);
  }
  function joinBase64Chunks(chunks) {
    let total = 0;
    const parts = chunks.map((c) => {
      const bytes = base64ToBytes(c);
      total += bytes.length;
      return bytes;
    });
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return utf8FromBytes(out);
  }
  function decodeMessage(raw) {
    if (raw == null) return null;
    if (typeof raw === "string") {
      if (raw.charAt(0) === "{" || raw.charAt(0) === "[") return raw;
      try {
        return utf8FromBytes(base64ToBytes(raw));
      } catch (e) {
        return raw;
      }
    }
    if (typeof raw === "object") {
      const bytes = raw._bytes;
      if (typeof bytes === "string") return utf8FromBytes(base64ToBytes(bytes));
    }
    return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
  }

  // basecamp/js/qml-html.ts
  var VOID2 = { br: true, hr: true, img: true, wbr: true };
  function parseStyle(raw) {
    const out = {};
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
  function styleFrom(attrs) {
    const m = /\bstyle="([^"]*)"/.exec(attrs);
    return m ? parseStyle(m[1]) : {};
  }
  function colorOf(style) {
    const v = style["background-color"] || style.background || "";
    const m = /#([0-9a-f]{3,8})\b/i.exec(v);
    if (!m) return "";
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length > 6) h = h.slice(0, 6);
    return "#" + h;
  }
  function hasBorder(style) {
    for (const key in style) {
      if (key !== "border" && key.indexOf("border-") !== 0) continue;
      const v = style[key].toLowerCase();
      if (v && v !== "none" && v !== "0" && v !== "0px") return true;
    }
    return false;
  }
  function isFlex(style) {
    return (style.display || "").indexOf("flex") >= 0;
  }
  function parseFragment(html) {
    const root = { tag: "#root", attrs: "", children: [] };
    const stack = [root];
    const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    let last = 0;
    let match;
    while (match = re.exec(html)) {
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
      const node = { tag, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!VOID2[tag] && !/\/\s*>$/.test(match[0])) stack.push(node);
    }
    if (last < html.length) root.children.push(html.slice(last));
    return root.children;
  }
  function elements(node) {
    const out = [];
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (typeof child !== "string") out.push(child);
    }
    return out;
  }
  function box(header, headerBg, body) {
    const head = header ? `<tr><td bgcolor="${headerBg || "#eaecf0"}"><p><font size="4"><b>${header}</b></font></p></td></tr>` : "";
    return `<table width="100%" cellspacing="0" cellpadding="10" border="1" bordercolor="#a2a9b1" bgcolor="#ffffff">${head}<tr><td>${body}</td></tr></table><p></p>`;
  }
  function transform(nodes) {
    let html = "";
    for (let i = 0; i < nodes.length; i++) html += transformOne(nodes[i]);
    return html;
  }
  function transformOne(node) {
    if (typeof node === "string") return node;
    const style = styleFrom(node.attrs);
    if (/^h[1-6]$/.test(node.tag)) {
      const inner2 = transform(node.children);
      const size = node.tag === "h1" ? "6" : node.tag === "h2" ? "5" : node.tag === "h3" ? "4" : "3";
      return `<p><font size="${size}"><b>${inner2}</b></font></p>`;
    }
    if (node.tag === "a") {
      const inner2 = transform(node.children);
      const colored = /\bnew\b/.test(node.attrs) ? `<font color="#ba0000">${inner2}</font>` : inner2;
      return `<a${node.attrs}>${colored}</a>`;
    }
    if (node.tag === "div" && isFlex(style)) {
      const cols = elements(node);
      let cells = "";
      for (let i = 0; i < cols.length; i++) cells += `<td valign="top">${transformOne(cols[i])}</td>`;
      const border = hasBorder(style) ? ` border="1" bordercolor="#c8ccd1"` : "";
      const bg = colorOf(style);
      return `<table width="100%" cellspacing="10" cellpadding="10"${border}${bg ? ` bgcolor="${bg}"` : ""}><tr>${cells}</tr></table><p></p>`;
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
      let inner2 = transform(node.children);
      const size = style["font-size"] || "";
      const align = (style["text-align"] || "").toLowerCase();
      const weight = (style["font-weight"] || "").toLowerCase();
      const fg = /#([0-9a-f]{3,6})/i.exec(style.color || "");
      const bg = colorOf(style);
      if (weight === "bold" || Number(weight) >= 600) inner2 = `<b>${inner2}</b>`;
      if (size.indexOf("2em") >= 0) inner2 = `<font size="6"><b>${inner2}</b></font>`;
      else if (size.indexOf("1.5") >= 0) inner2 = `<font size="5"><b>${inner2}</b></font>`;
      else if (size.indexOf("1.1") >= 0 || size.indexOf("1.15") >= 0) inner2 = `<font size="4"><b>${inner2}</b></font>`;
      if (fg) inner2 = `<font color="#${fg[1]}">${inner2}</font>`;
      const alignAttr = align === "center" || align === "right" ? ` align="${align}"` : "";
      const block = /<(p|ul|ol|table|h[1-6]|div)\b/i.test(inner2);
      const wrapped = block ? inner2 : `<p>${inner2}</p>`;
      if (bg) return `<table width="100%" cellspacing="0" cellpadding="6" bgcolor="${bg}"><tr><td${alignAttr}>${wrapped}</td></tr></table>`;
      if (alignAttr) return `<div${alignAttr}>${wrapped}</div>`;
      return wrapped;
    }
    const inner = transform(node.children);
    if (VOID2[node.tag]) return `<${node.tag}${node.attrs}>`;
    return `<${node.tag}${node.attrs}>${inner}</${node.tag}>`;
  }
  function stripStatus(html) {
    return html.replace(/<div\b[^>]*>[\s\S]{0,500}?Every page carries a status[\s\S]*?<\/div>/gi, "").replace(/<div\b[^>]*>[\s\S]{0,500}?Page status:[\s\S]*?change (?:its|this page'?s) status\.?[\s\S]{0,80}<\/div>/gi, "").replace(/<p\b[^>]*>[\s\S]{0,160}?Every page carries a status[\s\S]*?<\/p>/gi, "").replace(/<p\b[^>]*>[\s\S]{0,160}?Page status:[\s\S]*?change (?:its|this page'?s) status\.?[\s\S]{0,40}<\/p>/gi, "").replace(/Every page carries a status:[\s\S]{0,280}/gi, "").replace(/Page status:\s*(?:<b>[\s\S]*?<\/b>)?[\s\S]{0,220}change (?:its|this page'?s) status\.?/gi, "");
  }
  function qmlHtml(html) {
    return transform(parseFragment(stripStatus(html)));
  }

  // basecamp/js/entry.ts
  function deriveSeed(name, password) {
    const salt = utf8ToBytes("logos-wiki/v1/" + name.normalize("NFC"));
    return scrypt(utf8ToBytes(password.normalize("NFC")), salt, { N: 65536, r: 8, p: 1, dkLen: 32 });
  }
  function createWiki(admin) {
    return new Wiki((admin || "").toLowerCase());
  }
  function ingest(wiki, envelope) {
    const event = verify(envelope);
    if (!event || wiki.has(event.id)) return null;
    wiki.add(event);
    return event;
  }
  function ingestEvents(wiki, events) {
    if (!events) return 0;
    let n = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event || !event.id || wiki.has(event.id)) continue;
      wiki.add(event);
      n++;
    }
    return n;
  }
  function latestText(wiki, full) {
    const page = wiki.pages.get(full);
    if (!page || !page.revs.length) return null;
    return page.revs[page.revs.length - 1].text;
  }
  function richText(html) {
    html = html.replace(/<figure\b[^>]*>/gi, "<div>").replace(/<\/figure>/gi, "</div>").replace(/<figcaption\b[^>]*>/gi, "<p><i>").replace(/<\/figcaption>/gi, "</i></p>").replace(/<img\b[^>]*>/gi, (tag) => {
      var _a;
      const alt = ((_a = /alt="([^"]*)"/.exec(tag)) == null ? void 0 : _a[1]) || "image";
      return `[${alt}]`;
    }).replace(/href="\/wiki\/([^"#]*)(#[^"]*)?"/g, (_m, title, hash = "") => {
      const name = decodeURIComponent(String(title).replace(/\+/g, " ")).replace(/_/g, " ");
      return `href="wiki://${encodeURIComponent(name)}${hash || ""}"`;
    }).replace(/href="\/index\.php\?title=([^"&#]+)([^"]*)"/g, (_m, title, query) => {
      const name = decodeURIComponent(String(title).replace(/\+/g, " ")).replace(/_/g, " ");
      const params = String(query || "").replace(/&amp;/g, "&");
      const q = !params ? "" : params.charAt(0) === "?" ? params : params.charAt(0) === "&" ? "?" + params.slice(1) : "?" + params;
      return `href="wiki://${encodeURIComponent(name)}${q}"`;
    });
    return qmlHtml(html);
  }
  function renderPage(wiki, rawTitle, editable = false) {
    const title = parseTitle(rawTitle);
    if (!title) return { html: "<p>Invalid title.</p>", title: rawTitle, missing: true, categories: [], headings: [] };
    const text = latestText(wiki, title.full);
    if (text === null) {
      return { html: "<p>There is currently no text in this page.</p>", title: title.full, missing: true, categories: [], headings: [], parsed: title };
    }
    const rendered = render(text, {
      title,
      exists: (full) => wiki.pages.has(full),
      template: (full) => latestText(wiki, full),
      file: (name) => {
        const file = wiki.files.get(name);
        return file ? { width: file.width, height: file.height } : null;
      },
      stats: wiki.stats(),
      editable
    });
    return __spreadProps(__spreadValues({}, rendered), { html: richText(rendered.html), title: title.full, missing: false, parsed: title, source: text });
  }
  function pageTitles(wiki) {
    const out = [];
    wiki.pages.forEach((_page, full) => out.push(full));
    return out.sort();
  }
  function recent(wiki, limit = 100) {
    return wiki.revisions.slice().reverse().slice(0, limit).map((rev) => ({ id: rev.id, page: rev.page, user: rev.user, ts: rev.ts, summary: rev.summary, minor: rev.minor }));
  }
  function accountName(wiki, key) {
    return wiki.names.get(key) || "";
  }
  function canEditPage(wiki, key, rawTitle) {
    const title = parseTitle(rawTitle);
    return !!(key && title && wiki.canEdit(key, title));
  }
  function publishBody(seedHex, body, ts) {
    return sign(hexToBytes2(seedHex), body, ts);
  }
  function parseWikiHref(link) {
    const out = { title: "", action: "", section: "", redlink: false };
    if (!link || link.charAt(0) === "#") return out;
    let rest = link;
    if (rest.indexOf("wiki://") === 0) rest = rest.slice("wiki://".length);
    else if (rest.indexOf("/wiki/") === 0) rest = rest.slice("/wiki/".length);
    const qpos = rest.indexOf("?");
    const hpos = rest.indexOf("#");
    let path = rest;
    let query = "";
    if (qpos >= 0 && (hpos < 0 || qpos < hpos)) {
      path = rest.slice(0, qpos);
      query = hpos > qpos ? rest.slice(qpos + 1, hpos) : rest.slice(qpos + 1);
    } else if (hpos >= 0) path = rest.slice(0, hpos);
    try {
      path = decodeURIComponent(path.replace(/\+/g, " ")).replace(/_/g, " ");
    } catch (_e) {
      path = path.replace(/\+/g, " ").replace(/_/g, " ");
    }
    if (path.indexOf("title=") === 0) {
      query = path + (query ? "&" + query : "");
      path = "";
    }
    const parts = query.replace(/&amp;/g, "&").split("&");
    for (let i = 0; i < parts.length; i++) {
      const eq = parts[i].indexOf("=");
      const key = eq < 0 ? parts[i] : parts[i].slice(0, eq);
      let value = eq < 0 ? "" : parts[i].slice(eq + 1);
      try {
        value = decodeURIComponent(value.replace(/\+/g, " "));
      } catch (_e) {
      }
      if (key === "title") path = value.replace(/_/g, " ");
      if (key === "action") out.action = value;
      if (key === "section") out.section = value;
      if (key === "redlink" && (value === "1" || value === "true")) out.redlink = true;
    }
    const parsed = path ? parseTitle(path) : null;
    out.title = parsed ? parsed.full : path;
    return out;
  }
  function parseWikiLink(link) {
    return parseWikiHref(link).title;
  }
  function engineDiff(before, after) {
    const rows = diffRows(before || "", after || "").replace(/<del\b[^>]*>/gi, '<font color="#8f0000">').replace(/<\/del>/gi, "</font>").replace(/<ins\b[^>]*>/gi, '<font color="#006400">').replace(/<\/ins>/gi, "</font>");
    return `<table width="100%" cellspacing="0" cellpadding="4" border="1" bordercolor="#a2a9b1">${rows}</table>`;
  }
  function engineIsAdmin(key) {
    return !!(key && session.admin && key.toLowerCase() === session.admin);
  }
  function normalizeUsername(raw) {
    const s = String(raw || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function followRedirect(wiki, rawTitle) {
    const page = renderPage(wiki, rawTitle);
    const target = page.redirect;
    if (!target) return { title: page.title, hops: 0 };
    return { title: target.full, hops: 1, from: page.title };
  }
  var session = new Wiki("");
  function resetEngine(admin) {
    session = new Wiki((admin || "").toLowerCase());
  }
  function ingestEnvelope(envelope) {
    return ingest(session, envelope);
  }
  function ingestSnapshotEvents(events) {
    return ingestEvents(session, events);
  }
  function engineHas(id) {
    return session.has(id);
  }
  function engineStats() {
    return session.stats();
  }
  function engineRenderPage(rawTitle, editable = false) {
    try {
      return renderPage(session, rawTitle, editable);
    } catch (e) {
      return {
        html: "<p>Could not render this page.</p><p>" + e + "</p>",
        title: rawTitle,
        missing: false,
        categories: [],
        headings: []
      };
    }
  }
  function engineTitles() {
    return pageTitles(session);
  }
  function engineRecent(limit = 100) {
    return recent(session, limit);
  }
  function engineTrusted() {
    return session.trusted.slice();
  }
  function engineAccountName(key) {
    return accountName(session, key);
  }
  function engineCanEdit(key, rawTitle) {
    return canEditPage(session, key, rawTitle);
  }
  function engineAccountTaken(userKey, name) {
    return session.names.has(userKey) || session.accounts.has(name);
  }
  function engineRevisions(title) {
    const page = session.pages.get(title);
    return page ? page.revs.slice().reverse() : [];
  }
  function enginePageExists(full) {
    return session.pages.has(full);
  }
  function engineLatestText(full) {
    return latestText(session, full);
  }
  function engineFollowRedirect(rawTitle) {
    return followRedirect(session, rawTitle);
  }
  function enginePreview(rawTitle, text) {
    const title = parseTitle(rawTitle);
    if (!title) return "<p>Invalid title.</p>";
    return richText(
      render(text, {
        title,
        exists: (full) => session.pages.has(full),
        template: (full) => latestText(session, full),
        file: () => null,
        stats: session.stats()
      }).html
    );
  }
  return __toCommonJS(entry_exports);
})();
var ADMIN_KEY = WikiEngine.ADMIN_KEY;
var createWiki = WikiEngine.createWiki;
var ingest = WikiEngine.ingest;
var ingestEvents = WikiEngine.ingestEvents;
var resetEngine = WikiEngine.resetEngine;
var ingestEnvelope = WikiEngine.ingestEnvelope;
var ingestSnapshotEvents = WikiEngine.ingestSnapshotEvents;
var engineHas = WikiEngine.engineHas;
var engineStats = WikiEngine.engineStats;
var engineRenderPage = WikiEngine.engineRenderPage;
var engineTitles = WikiEngine.engineTitles;
var engineRecent = WikiEngine.engineRecent;
var engineTrusted = WikiEngine.engineTrusted;
var engineAccountName = WikiEngine.engineAccountName;
var engineCanEdit = WikiEngine.engineCanEdit;
var engineAccountTaken = WikiEngine.engineAccountTaken;
var engineRevisions = WikiEngine.engineRevisions;
var enginePageExists = WikiEngine.enginePageExists;
var engineLatestText = WikiEngine.engineLatestText;
var engineFollowRedirect = WikiEngine.engineFollowRedirect;
var enginePreview = WikiEngine.enginePreview;
var engineDiff = WikiEngine.engineDiff;
var engineIsAdmin = WikiEngine.engineIsAdmin;
var normalizeUsername = WikiEngine.normalizeUsername;
var latestText = WikiEngine.latestText;
var richText = WikiEngine.richText;
var renderPage = WikiEngine.renderPage;
var pageTitles = WikiEngine.pageTitles;
var recent = WikiEngine.recent;
var accountName = WikiEngine.accountName;
var canEditPage = WikiEngine.canEditPage;
var publishBody = WikiEngine.publishBody;
var parseWikiHref = WikiEngine.parseWikiHref;
var parseWikiLink = WikiEngine.parseWikiLink;
var followRedirect = WikiEngine.followRedirect;
var appendSection = WikiEngine.appendSection;
var bytesToHex = WikiEngine.bytesToHex;
var canonicalTitle = WikiEngine.canonicalTitle;
var decodeMessage = WikiEngine.decodeMessage;
var deriveSeed = WikiEngine.deriveSeed;
var diffRows = WikiEngine.diffRows;
var formatDate = WikiEngine.formatDate;
var formatDateTime = WikiEngine.formatDateTime;
var formatNumber = WikiEngine.formatNumber;
var formatTime = WikiEngine.formatTime;
var hexToBytes = WikiEngine.hexToBytes;
var joinBase64Chunks = WikiEngine.joinBase64Chunks;
var MAIN_PAGE = WikiEngine.MAIN_PAGE;
var MAX_TEXT = WikiEngine.MAX_TEXT;
var parseTitle = WikiEngine.parseTitle;
var PRESET = WikiEngine.PRESET;
var publicKey = WikiEngine.publicKey;
var render = WikiEngine.render;
var replaceSection = WikiEngine.replaceSection;
var sectionText = WikiEngine.sectionText;
var sign = WikiEngine.sign;
var SITENAME = WikiEngine.SITENAME;
var SNAPSHOT_CID = WikiEngine.SNAPSHOT_CID;
var TOPIC = WikiEngine.TOPIC;
var validUsername = WikiEngine.validUsername;
var verify = WikiEngine.verify;
var Wiki = WikiEngine.Wiki;
