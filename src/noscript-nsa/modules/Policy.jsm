var EXPORTED_SYMBOLS = ["Policy"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");

const SPECIALS = ["UNTRUSTED", "TRUSTED"];
const REFS = SPECIALS.concat("DEFAULT");

var serial = 0;
const SERIAL_RX = /"#serial":\*(\d+)/;

function Policy(map) {
  // map is an object consisting of:
  //  - the three special keys (UNTRUSTED, TRUSTED, DEFAULTS) mapping to an
  //    object. This has keys to permissions (js, plugin) and maps to true when
  //    the permission is granted.
  //  - domains which map to an the REFS index (0 = UNTRUSTED, 1 = TRUSTED).
  //    These will be expanded by the resolve method (called indirectly by
  //    unserialize).
  if (typeof map === "string")  this.unserialize(map);
  else this.map = this.resolve(map);
  
  this._temp = {__proto__: null};
  this.wrappedJSObject = this;
}
// Define special constants
SPECIALS.forEach(function(k, v) { Object.defineProperty(Policy, k, {value: v}); });

var instance = null;


Policy.getInstance = function() {
  if (instance) return instance;
  
  if (IPC.isChildProcess) {
    IPC.childManager.addMessageListener(IPC.MSG_REFRESH_POLICY, function refresh(msg) {
      instance.unserialize(msg.json);
    });
    IPC.childManager.addMessageListener(IPC.MSG_SHUTDOWN, function shutdown(msg) {
      instance = null;
      IPC.childManager.removeMessageListener(IPC.MSG_REFRESH_POLICY, refresh);
      IPC.childManager.removeMessageListener(IPC.MSG_SHUTDOWN, shutdown);
    });
    return instance = new Policy(IPC.childManager.sendSyncMessage(IPC.MSG_GET_POLICY, null)[0]);
  }
  
  try {
    instance = new Policy(this.getPref());
  } catch (e) {
    Cu.reportError(e);
    Cu.import("resource:noscript_@VERSION@/modules/Defaults.jsm");
    instance = Defaults.policy;
  }

  return instance;
}


Policy.PREF_NAME = "policy";
Policy.CHANGE_TOPIC = "NoScript:policy-change";

Policy.getPref = function() {
  Cu.import("resource:noscript_@VERSION@/modules/Prefs.jsm");
  return Prefs.get(this.PREF_NAME);
}
Policy.storePref = function(policy)  {
  Cu.import("resource:noscript_@VERSION@/modules/Prefs.jsm");
  Prefs.set(this.PREF_NAME, (policy || Policy.getInstance()).serialize());
}

Policy.serial = function(json) {
  let m = SERIAL_RX.exec(json);
  return m && parseInt(m[1]) || 0;
}


Policy.prototype = {
  _batch: false,
  _changedSites: [],
  batch: function(b) {
    this._batch = b;
    if (!b && this._changedSites.length) {
      this._notifyChanges();
    }
    this._changedSites.length = 0;
  },
  _notifyChanges: function(site) {
    let changed = this._changedSites;
    if (site) {
      changed.length = 1;
      changed[0] = site;
    }
    Services.obs.notifyObservers(this, Policy.CHANGE_TOPIC, changed.join(","));
    changed.length = 0;
  },
  
  serialize: function(withTemp) {
  
    const map = this.map;
    const json = withTemp ? { "#serial": ++serial } : {};
    const specials = SPECIALS;
    const byref = specials.map(function(k) map[k]);
    
    for (let [k, v] in Iterator(map)) {
      let ref = byref.indexOf(v);
      json[k] = ref === -1 ? v : ref;
    }
    
    for each (let k in specials) {
      json[k] = map[k];
    }
    
    if (!withTemp) for (let k in this._temp) delete json[k];
    
    return JSON.stringify(json);
  },
  unserialize: function(json, keepTemp) {
    this.map = this.resolve(typeof(json) === "string" ? JSON.parse(json) : json);
    if (keepTemp) {
      for (let k in this._temp) {
        if (k in this.map) {
          delete this._temp[k];
        } else {
          this.map[k] = this._temp[k];
        }
      }
    }
  },
  
  externalize: function(site, map) { // TODO: handle nested permissions
    let entry = (map || this.map)[site];
    if (!entry) return null;
    for (let j = SPECIALS.length; j-- > 0;) {
      let special = SPECIALS[j];
      if (site === special) break;
      if (entry === this.map[special]) return j; 
    }
    return entry;
  },
  
  internalize: function(entry) typeof entry === "number" || entry instanceof Number ? this.map[SPECIALS[entry] || "DEFAULT"] : entry,
  
  reset: function() {
    let changed = this._changedSites;
    for (let site in this.map) if (!(site in this._temp)) changed.push(site);
    this.resolve({});
    this._temp = { __proto__: null };
    this._notifyChanges();
  },
  
  // Returns the map with any integer policy settings expanded to the
  // permissions matching the policy TRUSTED/UNTRUSTED/DEFAULT.
  resolve: function(map) {
    delete map["#serial"];
    // maps zones such as TRUSTED to the permissions (js, plugins, etc.)
    const byref = SPECIALS.map(function(k) map[k]);
    // expands domain names to the granted permissions
    for (let [k, v] in Iterator(map)) {
      if (typeof v === "number") map[k] = byref[v];
    }
    if (!("DEFAULT" in map)) map.DEFAULT = {};
    return map;
  },
  
  // returns the part of the domain that has a policy defined, or "" if the site
  // uses the default policy.
  match: function(site) {
    if (!site) return "";
    
    const map = this.map;

    // Ignore port numbers
    site = site.replace(/:\d+$/, "");

    // exact match
    if (site in map) return site;
    
    let pos, schemePos;
    pos = schemePos = site.indexOf(':') + 1;
    while (site[pos] === '/') pos++; // move to host position
    
    let match = site.substring(pos); // full domain
    for (;;) {
      if (match in map) return match;
      pos = match.indexOf('.'); // parent domain
      if (pos === -1) break;
      match = match.substring(pos + 1);
    }
    
    return ((match = site.substring(0, schemePos)) in map)
      ? match // scheme
      : "";
  },
  
  getPermsCopy: function(site) {
    let perms = this.getExactPerms(site);
    let copy = {};
    for (let p in perms) copy[p] = perms[p];
    return copy;
  },
  // returns an object of granted permissions. See Policy()
  getPerms: function(site) this.getExactPerms(this.match(site)),
  getExactPerms: function(match) match ? this.map[match] : this.map.DEFAULT,
  
  // Sets the permissions for this site. perms *must* be one of the UNTRUSTED,
  // TRUSTED or DEFAULT keys (example: Policy.getInstance().TRUSTED). Otherwise,
  // a custom permission is created.
  setPerms: function(site, perms, temp) {
    // if the permissions are different from the default policy, save it. Also
    // save the permissions if the default site is being set.
    if (perms && (perms !== this.map.DEFAULT || site === "DEFAULT")) {
      this.map[site] = perms;
      // if marked as temporarily, it will be not be saved persistently
      if (temp) this._temp[site] = perms;
    }
    else {
      delete this.map[site];
      delete this._temp[site];
    }
    // if a batch operation is in progress do not save immediately
    if (this._batch) this._changedSites.push(site);
    else this._notifyChanges(site);
  },
  
  // apply the policy from map (site to permissions). See setPerms.
  merge: function(map, temp) {
    this.batch(true);
    try {
      for (let [k, v] in Iterator(map))
        this.setPerms(k, v, temp);
    } finally {
      this.batch(false);
    }
  },
  
  removeTemp: function() {
    this.batch(true);
    let temp = this._temp;
    let map = this.map;
    for (let k in temp) {
      delete temp[k];
      delete map[k];
    }
    this.batch(false);
  },
  
  isTemp: function(site) site in this._temp,
  hasPerms: function(site, permanentOnly) (s in this.map) && !(permanentOnly && (site in this._temp)),
  
  sites: function(permanentOnly) {
    let sites = [];
    for (let s in this.map) {
      if (this.hasPerms(s, permanentOnly)) sites.push(s);
    }
    return sites;
  },
  
  applyPreset: function(preset) {
    for each (let p in REFS) {
      this.map[p] = JSON.parse(JSON.stringify(preset[p])); // create unique object for each REF
      this._changedSites.push(p);
    }
    this._notifyChanges();
    Policy.storePref(this);
  }
  
}

REFS.forEach(function(k, v) {
  Object.defineProperty(Policy.prototype, k.toLowerCase(), {get: function() this.map[k]});
});
