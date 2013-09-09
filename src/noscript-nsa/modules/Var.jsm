var EXPORTED_SYMBOLS = ["Var"];

const NS = "__NoScript__";

const Var = {
  ns: function(obj) NS in obj ? obj[NS] : obj[NS] = {},
  get: function(obj, key) this.ns(obj)[key],
  getOrCreate: function(obj, key, def) this.exists(obj, key) ? this.ns(obj)[key] : this.set(obj, key, def || {}),
  set: function(obj, key, val) this.ns(obj)[key] = val,
  exists: function(obj, key) key in this.ns(obj),
  clear: function(obj, key) delete (key ? this.ns(obj)[key] : obj[NS])
};
