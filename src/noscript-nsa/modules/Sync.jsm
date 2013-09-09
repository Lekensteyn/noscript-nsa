var EXPORTED_SYMBOLS = ["NoScriptSyncEngine"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
try {
  Cu.import("resource://services-sync/engines.js");
  Cu.import("resource://services-sync/record.js");
  Cu.import("resource://services-sync/util.js");
} catch (e) {}
Cu.import("resource://services-sync/main.js");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

for each(let name in ["Policy", "Prefs"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm");

XPCOMUtils.defineLazyGetter(this, "policy", function() Policy.getInstance());

const TRACKED_PREFS = [
  "ABE.enabled", "ABE.rulesets.USER", "ABE.disabledRulesetNames",
  "clearClick.prompt", "clearClick.enabled",
  "xssFilter.enabled"
];

var enabled = false;

var GUID = {
  PREF_NAME: "sync.map",
  _dirty: false,
  get _guidMap() {
    delete this._guidMap;
    var json = Prefs.get(this.PREF_NAME);
    if (json)
      try {
        this._guidMap = JSON.parse();
        if (this._guidMap) return this._guidMap;
      } catch(e) {}
    
    let guidMap = {__proto__: null};
    for (let site in policy.map) guidMap[Utils.makeGUID()] = site;
    this._dirty = true;
    return this._guidMap = guidMap;
  },
  get _siteMap() {
    delete this._siteMap;
    var siteMap = {__proto__: null};
    var guidMap = this._guidMap;
    for (let guid in guidMap)
      siteMap[guidMap[guid]] = guid;
    return this._siteMap = siteMap;
  },
  
  
  isPref: function(guid) guid.substring(0, 2) === "P:",
  fromPrefName: function(name) "P:" + name,
  toPrefName: function(guid) guid.substring(2),
  
  isPerm: function(guid) guid in this._guidMap,
  toSite: function(guid) this._guidMap[guid],
  fromSite: function(site) this._siteMap[site] || this.add(site),
  
  add: function(site, guid) {
    if (!guid) guid = Utils.makeGUID();
    this._guidMap[guid] = site;
    this._siteMap[site] = guid;
    this._dirty = true;
    return guid;
  },
  removeSite: function(site) {
    return this._remove(site, this._siteMap, this._guidMap);
  },
  removeGUID: function(guid) {
    return this._remove(guid, this._guidMap, this._siteMap);
  },
  _remove: function(key, refMap, otherMap) {
    let otherKey = refMap[key];
    if (otherKey) {
      delete refMap[key];
      delete otherMap[otherKey];
      this._dirty = true;
      return otherKey;
    }
    return null;
  },
  
  all: function() {
    let siteMap = this._siteMap,
        policyMap = policy.map;
    
    for (let site in siteMap)
      if (!(site in policyMap)) this.removeSite(site);
      
    for (let site in policyMap)
      if (!(site in siteMap))
        this.add(site);

    this.persist();
    let ids = [];
    for (let guid in this._guidMap) ids.push(guid);
    return ids;
  },
  
  persist: function() {
    if (this._dirty) {
      Prefs.set(this.PREF_NAME, JSON.stringify(this._guidMap));
      Prefs.persist();
      this._dirty = false;
    }
  },
  
  wipe: function() {
    this._guidMap = {__proto__: null};
    this._siteMap = {__proto__: null};
    this._dirty = true;
    this.persist();
  }
};

// RECORDS

function NoScriptRecord(collection, id, type) {
  CryptoWrapper.call(this, collection, id);
  this.type = type || ""; // default permissions
}
NoScriptRecord.prototype = {
  __proto__:   CryptoWrapper.prototype,
  _logName: "Sync.Record.NoScript",
  
  decrypt: function(keyBundle) {
    let clear = CryptoWrapper.prototype.decrypt.call(this, keyBundle);
    if (!this.deleted)
      this.__proto__ = (this.type === "pref" ? PreferencesRecord : PermissionsRecord).prototype;
  }
};
Utils.deferGetSet(NoScriptRecord, "cleartext", ["type"]);

function PermissionsRecord(collection, id) {
  NoScriptRecord.call(this, collection, id);
}
PermissionsRecord.prototype = {
  __proto__:  NoScriptRecord.prototype,
  _logName: "Sync.Record.NoScript.Permissions",
  
  _createOrUpdate: function(batch) {
    // log("Syncing " + this.site + "=" + this.permissions);
    if (this.site) policy.setPerms(this.site, policy.internalize(this.permissions));
    if (!batch) Policy.storePref(policy)
  },
  _remove: function() {
    policy.setPerms(this.site, null);
    if (!batch) Policy.storePref(policy)
  }
};
Utils.deferGetSet(PermissionsRecord, "cleartext", ["site", "permissions"]);

function PreferencesRecord(collection, id) {
  NoScriptRecord.call(this, collection, id, "pref");
}
PreferencesRecord.prototype = {
  __proto__:  NoScriptRecord.prototype,
  _logName: "Sync.Record.NoScript.Preferences",
  
  _createOrUpdate: function(batch) {
    // log("Syncing " + this.name + "=" + this.value);
    Prefs.set(this.name, this.value);
    if (!batch) Prefs.persist();
  },
  _remove: function(batch) {
    Prefs.remove(this.name);
    if (!batch) Prefs.persist();
  }
}
Utils.deferGetSet(PreferencesRecord, "cleartext", ["name", "value"]);


function NoScriptStore(name) {
  Store.call(this, name);
}
NoScriptStore.prototype = {
  __proto__: Store.prototype,
  
  _findDupe: function(item) GUID.isPerm(item.id) ? GUID.fromSite(item.site) : null,
  
  itemExists: function(guid) {
    return GUID.isPref(guid) || GUID.isPerm(guid);
  },
  getAllIDs: function() {
    return GUID.all().concat(TRACKED_PREFS);
  },
  createRecord: function(id, collection) {
    var rec;
    if (GUID.isPref(id)) {
      rec = new PreferencesRecord(collection, id);
      rec.name = GUID.toPrefName(id);
      rec.value = Prefs.get(rec.name);
    } else {
      rec = new PermissionsRecord(collection, id);
      if ((rec.site = GUID.toSite(id))) {
        rec.permissions = policy.externalize(rec.site);
        // log(id + ", " + rec.site + " externalized to " + rec.permissions);
      }
    }
    return rec;
  },
  
  changeItemID: function(oldGUID, newGUID) {
    if (GUID.isPerm(oldGUID)) {
      let site = GUID.toSite(oldGUID);
      GUID.removeGUID(oldGUID);
      GUID.add(site, newGUID);
      GUID.persist();
    }
  },

  wipe: function() {
    policy.reset();
    GUID.wipe();
  },
  
  create: function(r) {
    r._createOrUpdate(this._batch);
  },
  update: function(r) {
    r._createOrUpdate(this._batch);
  },
  remove: function(r) {
    r._remove(this._batch);
  },
  
  _batch: false,
  applyIncomingBatch: function(rr) {
    this._batch = true;
    try {
      return Store.prototype.applyIncomingBatch.call(this, rr);
    } finally {
      this._batch = false;
      Prefs.persist();
    }
  }
};

function NoScriptTracker(name) {
  Tracker.call(this, name);
  Prefs.branch.addObserver("", this, true);
  Services.obs.addObserver(this, Policy.CHANGE_TOPIC, true);
}
NoScriptTracker.prototype = {
  __proto__: Tracker.prototype,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  observe: function(subject, topic, data) {
    switch (topic) {
      case Policy.CHANGE_TOPIC:
        for each(let site in data.split(","))
          this.addChangedID(GUID.fromSite(site));
        GUID.persist();
        this.score = 100;
        break;
      case "nsPref:changed":
        if (TRACKED_PREFS.indexOf(data) > -1) {
          this.addChangedID(GUID.fromPrefName(data));
          this.score = 100;
        }
        break;
    }
  }
};

function NoScriptSyncEngine() {
  SyncEngine.call(this, "NoScript");
}
NoScriptSyncEngine.prototype = {
  __proto__: SyncEngine.prototype,
  _recordObj: NoScriptRecord,
  _storeObj: NoScriptStore,
  _trackerObj: NoScriptTracker
};

NoScriptSyncEngine.startup = function() {
  if (enabled) return;
  enabled = true;
  try {
    Weave.Engines.unregister("noscript");
  } catch (e) {}
  if (Weave.Status.ready) {
    Weave.Engines.register(NoScriptSyncEngine);
  } else {
    Services.obs.addObserver({
      QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
      observe: function(subject, topic, data) {
        Weave.Engines.register(NoScriptSyncEngine);
        Services.obs.removeObserver(this, "weave:service:ready");
      }
    }, "weave:service:ready", false);
  }
}
NoScriptSyncEngine.shutdown = function() {
  if (!enabled) return;
  enabled = false;
  Weave.Engines.unregister(NoScriptSyncEngine);
}
