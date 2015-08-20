var EXPORTED_SYMBOLS = ["PACKAGE_NAME", "PREF_BRANCH", "prefSvc", "PrefsHelper", "Prefs"];
try {
const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

this.PACKAGE_NAME = "nsa";
this.PREF_BRANCH = "extensions." + PACKAGE_NAME + ".";
this.prefSvc = Services.prefs;

const IPB = Ci.nsIPrefBranch;
persistPending = false;

function persist() {
  if (persistPending) return;
  Cu.import("resource://noscript_@VERSION@/modules/Thread.jsm");
  persistPending = true;
  Thread.asap(function() {
    prefSvc.savePrefFile(null);
    persistPending = false;
  });
}

function PrefsHelper(branch) {
  this.branch = typeof(branch) === "string"
    ? prefSvc.getBranch(branch.slice(-1) === "." ? branch : branch + ".")
        .QueryInterface(Ci.nsIPrefBranch2)
    : branch;
}

var DefaultFilter = {
  get: function(prefs, name) prefs.get(name),
  set: function(prefs, name, value) prefs.set(name, value)
}

PrefsHelper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  
  get _str() {
    delete this.__proto__._str;
    return this.__proto__._str =  Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
  },
  sub: function(branchName) {
    return new PrefsHelper(this.branch.root + branchName);
  },
  
  _bindings: null,
  _bindingMap: null,
  bind: function(names, target, filter) {
    if (this._bindings === null) {
      this._bindings = [];
      this._bindingMap = {__proto__: null},
      this.branch.addObserver("", this, true)
    }
    if (!target) target = {};
    if (!filter) filter = DefaultFilter;
    if (!Array.isArray(names)) names = [names];
    let b = {names: names, target: target, filter: filter};
    this._bindings.push(b);
    let map = this._bindingMap;
    for each (let name in names) {
      (map[name] || (map[name] = [])).push(b);
      target[name] = filter.get(this, name);
    }
    return target;
  },
  unbind: function(target) {
    let map = this._bindingMap;
    let bindings = this._bindings;
    for (let j = bindings.length; j-- > 0;) {
      let b = bindings[j];
      if (b.target !== target) continue;
      bindings.splice(j, 1);
      for each (let name in b.names) {
        let mapped = map[names];
        if (!mapped) continue;
        for (let k = mapped.length; k-- > 0;) {
          if (mapped[k] === b) mapped.splice(k, 1);
        }
      }
    }
    this._bindings = this._bindings.filter(function(b) b.target !== target);
  },
  _listeners: null,
  addListener: function(l) {
    let ll = this._listeners || (this._listeners = []);
    if (ll.indexOf(l) === -1) ll.push(l);
  },
  removeListener: function(l) {
    let ll = this._listeners;
    if (!ll) return;
    let pos = ll.indexOf(l);
    if (pos !== -1) ll.splice(pos, 1);
  },
  observe: function(branch, topic, name) {
    let bindings = this._bindingMap[name] || this._bindingMap["*"];
    if (bindings) {
      for (let j = bindings.length; j-- > 0;) {
        let b = bindings[j];
        try {
          b.target[b.name] = b.filter.get(this, b.name);
        } catch (e) { Cu.reportError(e); }
      }
    }
    let ll = this._listeners;
    if (ll) {
      let bound = !!bindings;
      for (let j = ll.length; j-- > 0;)
        try {
          ll[j](this, name, bound);
        } catch (e) { Cu.reportError(e); }
    }
  },
  dispose: function() {
    if (this._bindings) {
      delete this._bindings;
      delete this._bindingMap;
      delete this._listeners;
      this.branch.removeObserver("", this);
    }
  },
  
  set: function(key, val, forcedType) {
    const branch = this.branch;
    try {
      switch (typeof val) {
        case "boolean":
          branch.setBoolPref(key, val);
          break;
        case "number":
          branch.setIntPref(key, val);
          break;
        case "string":
          let str = this._str;
          str.data = val;
          branch.setComplexValue(key, Ci.nsISupportsString, str);
          str.data = null;
          break;
      }
    } catch (e) {
        switch (branch.getPrefType(key)) {
          case IPB.PREF_STRING:
           this.set(key, val === null ? '' : val.toString());
            break;
          case IPB.PREF_INT:
            this.set(key, parseInt(val));
            break;
          case IPB.PREF_BOOL:
            this.set(key, !!val && val != "false");
            break;
        }
    }
  },
  get: function(key, def) {
    const branch = this.branch;
    try {
      switch (branch.getPrefType(key)) {
        case IPB.PREF_STRING:
          return branch.getComplexValue(key, Ci.nsISupportsString).data;
        case IPB.PREF_INT:
          return branch.getIntPref(key);
        case IPB.PREF_BOOL:
          return branch.getBoolPref(key);
      }
    } catch(e) {}
    return def || "";
  },
  remove: function(key) {
    try {
      this.branch.clearUserPref(key);
    } catch (e) {}
  },
  
  keys: function(subBranch) {
    return this.branch.getChildList(subBranch || "", {});
  },
  
  reset: function(exceptions, exclude) {
    exclude = exclude || [];
    let branch = this.branch;
    const root = branch.root;
    const keys = branch.getChildList("", {});
    for (let j = keys.length; j-- > 0;) {
      let k = keys[j];
      if (exclude.indexOf(k) === -1) {
        if (branch.prefHasUserValue(k)) {
          dump("Resetting " + root + k + "\n");
          try {
            branch.clearUserPref(k);
          } catch(e) { dump(e + "\n") }
        }
      }
    }
    this.persist();
  },
  
  persist: function() {
    persist();
  }
}

this.Prefs = new PrefsHelper(PREF_BRANCH);
} catch(e) {
  dump(e);
}
