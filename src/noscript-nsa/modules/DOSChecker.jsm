var EXPORTED_SYMBOLS = ["DOSChecker", "MaxRunTime"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Thread.jsm");

function DOSChecker(request) {
  this.request = request;
  Thread.asap(this.check, this);
}

DOSChecker.abort = function(req, info) {
  (("channel" in req) ? req.channel : req).cancel(Components.results.NS_ERROR_ABORT);
  log("[NoScript DOS] Aborted potential DOS attempt: " +
         ( ("name" in req) ? req.name : req ) +
         "\n" + (info || new Error().stack));
};

DOSChecker.prototype = {
  done: false,
  lastClosure: null,
  run: function(closure, self) {
    this.done = false;
    this.lastClosure = closure;
    try {
      return  self ? closure.apply(self) : closure();
    } finally {
      this.done = true;
    }
  },
  
  check: function() {
    MaxRunTime.restore();  
    if (!this.done)
      DOSChecker.abort(this.request, (this.lastClosure && this.lastClosure.toSource()));
  }
}

var MaxRunTime = {
  branch: Services.prefs.getBranch("dom."),
  pref: "max_script_run_time",
  increase: function(v) {
    var cur;
    try {
      cur = this.branch.getIntPref(this.pref);
    } catch(e) {
      cur = -1;
    }
    if (cur <= 0 || cur >= v) return;
    if (typeof(this.storedValue) === "undefined") try {
      this.storedValue = cur;
    } catch(e) {}
    this.branch.setIntPref(this.pref, v);
  },
  restore: function() {
    if (typeof(this.storedValue) !== "undefined") {
      this.branch.setIntPref(this.pref, this.storedValue);
      delete this.storedValue;
    }
  }
};
