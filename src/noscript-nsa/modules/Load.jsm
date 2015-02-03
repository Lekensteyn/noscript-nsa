var EXPORTED_SYMBOLS = [
  "Load",
  "LoadChecker",
  "CP", "CP_ACCEPT", "CP_REJECT",
  "CP_TYPE_OTHER",
  "CP_TYPE_FONT",
  "CP_TYPE_SCRIPT",
  "CP_TYPE_IMAGE",
  "CP_TYPE_STYLESHEET",
  "CP_TYPE_OBJECT",
  "CP_TYPE_OBJECT_SUBREQUEST",
  "CP_TYPE_MEDIA",
  "CP_TYPE_SUBDOCUMENT",
  "CP_TYPE_XBL",
  "CP_TYPE_PING",
  "CP_TYPE_XMLHTTPREQUEST",
  "CP_TYPE_DTD",
  "CP_TYPE_DOCUMENT",
  "CP_TYPE_REFRESH",
  "CP_INTERNAL_JAR",
  "CP_INTERNAL_PROCESSING"
];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

const CP = Ci.nsIContentPolicy;
const CP_ACCEPT = CP.ACCEPT,
  CP_REJECT = CP.REJECT_OTHER,
  CP_TYPE_OTHER = CP.TYPE_OTHER,
  CP_TYPE_FONT = CP.TYPE_FONT,
  CP_TYPE_SCRIPT = CP.TYPE_SCRIPT,
  CP_TYPE_IMAGE = CP.TYPE_IMAGE,
  CP_TYPE_STYLESHEET = CP.TYPE_STYLESHEET,
  CP_TYPE_OBJECT = CP.TYPE_OBJECT,
  CP_TYPE_OBJECT_SUBREQUEST = CP.TYPE_OBJECT_SUBREQUEST,
  CP_TYPE_MEDIA = CP.TYPE_MEDIA,
  CP_TYPE_SUBDOCUMENT = CP.TYPE_SUBDOCUMENT,
  CP_TYPE_XBL = CP.TYPE_XBL,
  CP_TYPE_PING = CP.TYPE_PING,
  CP_TYPE_XMLHTTPREQUEST = CP.TYPE_XMLHTTPREQUEST,
  CP_TYPE_DTD = CP.TYPE_DTD,
  CP_TYPE_DOCUMENT = CP.TYPE_DOCUMENT,
  CP_TYPE_REFRESH = CP.TYPE_REFRESH
  ;
const CP_INTERNAL_PROCESSING = 1,
  CP_INTERNAL_JAR = 2;

const PROP_KEY = "noscript.policyState";

var lastLoad = null;

function Load(type, location, origin, context, window, mime) {
  this.type = type;
  this.location = location;
  
  if (type === 6 && origin && origin.schemeIs("moz-nullprincipal") &&  
          /\nhandleCommand@chrome:\/\/[\w/-]+\/urlbarBindings\.xml:\d+\n/.test(new Error().stack)) {
    Cu.import("resource://noscript_@VERSION@/modules/ABE.jsm");
    origin = ABE.BROWSER_URI;
  }
  
  this.origin = origin;
  try {
    this._contextWeak = context && Cu.getWeakReference(context) || null;
    this._windowWeak = window && Cu.getWeakReference(window) || null;
  } catch (e) {
    this._contextWeak = this._windowWeak = null;
  }
  this.mime = mime;
  this.wrappedJSObject = this;
  lastLoad = this;
}

Load.__defineGetter__("last", function() lastLoad);

Load.attach = function(channel) {
  let last = lastLoad;
  if (last && (channel instanceof Ci.nsIChannel) &&
      last.location == channel.URI &&
      channel instanceof Ci.nsIWritablePropertyBag2) {
    channel.setPropertyAsInterface(PROP_KEY, last);
    GC.add(channel);
    lastLoad = null;
    return last;
  }
  debug("Could not attach load info to " + channel.name + "\n" +
        (last && (last.location === channel.URI) + ", " + (last.location && last.location.spec)) + "\n" +
        channel instanceof Ci.nsIWritablePropertyBag2
    );
  return null;
}

Load.retrieve = function(channel) {
  if (channel instanceof Ci.nsIPropertyBag2) {
    if (channel.hasKey(PROP_KEY))
      try {
        return channel.getPropertyAsInterface(PROP_KEY, Ci.nsISupports).wrappedJSObject;
      } catch(e) {
        log(e);
      }
  }
  return null;
}

Load.detach = function(channel) {
  if (channel instanceof Ci.nsIWritablePropertyBag) try {
    channel.deleteProperty(PROP_KEY);
  } catch (e) {}
}

Load.prototype = {
  _contextWeak: null,
  get context() this._contextWeak && this._contextWeak.get(),
  
  get window() {
    if (!this._windowWeak) {
      try {
        let ctx = this.context;
        if (!ctx) return null;
        this._windowWeak = Cu.getWeakReference(
            ctx.ownerDocument ? ctx.ownerDocument.defaultView : ctx.self
          );
      } catch (e) {
        return null;
      }
    }
    return this._windowWeak.get();
  },
  get isDocument() {
    delete this.isDocument;
    let isDocument = false;
    switch (this.type) {
      case CP_TYPE_OBJECT:
        if (!("contentDocument" in this.context)) break;
      case CP_TYPE_DOCUMENT:
      case CP_TYPE_SUBDOCUMENT:
        isDocument = true;
    }
    return this.isDocument = isDocument;
  }
}


var LoadChecker = {
  checking: [],
  add: function(url) {
    if (this.checking.indexOf(url) === -1)
      this.checking.push(url);
  },
  remove: function(url) {
    var idx = this.checking.indexOf(url);
    if (idx > -1) this.checking.splice(idx, 1);
  },
  beingChecked: function(url) {
    return this.checking.indexOf(url) !== -1;
  }
};

var GC = {
  INTERVAL: 5000,
  _timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
  _pending: [],
  _running: false,
  notify: function(t) {
    try {
      let channels = this._pending;
      for (let j = channels.length; j-- > 0;) {
        let channel = channels[j];
        if (channel.status || !channel.isPending()) {
          Load.detach(channel);
          channels.splice(j, 1);
        }
      }
      if (channels.length === 0) {
        t.cancel();
        this._running = false;
      }
    } catch(e) {
      log(e);
    }
  },
  add: function(channel) {
    this._pending.push(channel);
    if (!this._running) {
      this._running = true;
      this._timer.initWithCallback(this, this.INTERVAL, Ci.nsITimer.TYPE_REPEATING_SLACK);
    }
  }
}
