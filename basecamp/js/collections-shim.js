var WikiDict = function (pairs) {
  var o = {
    _k: [],
    _v: [],
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
  Object.defineProperty(o, "size", {
    get: function () {
      return o._k.length;
    },
  });
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
    add: function (v) {
      if (o._a.indexOf(v) < 0) o._a.push(v);
      return o;
    },
    has: function (v) {
      return o._a.indexOf(v) >= 0;
    },
    delete: function (v) {
      var i = o._a.indexOf(v);
      if (i < 0) return false;
      o._a.splice(i, 1);
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
  Object.defineProperty(o, "size", {
    get: function () {
      return o._a.length;
    },
  });
  Object.defineProperty(o, "length", {
    get: function () {
      return o._a.length;
    },
  });
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
