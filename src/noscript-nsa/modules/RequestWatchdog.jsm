var EXPORTED_SYMBOLS = ["RequestWatchdog"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Load.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/ABE.jsm");
Cu.import("resource://noscript_@VERSION@/modules/ChannelReplacement.jsm");

for each(let name in ["IOUtil", "DOSChecker", "XSSFilter", "ABENotifier", "DNS"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm")

const nsIWebProgressListener = Ci.nsIWebProgressListener;
const nsIWebProgress = Ci.nsIWebProgress;
const WP_STATE_START = nsIWebProgressListener.STATE_START;
const WP_STATE_STOP = nsIWebProgressListener.STATE_STOP;

const LF_VALIDATE_ALWAYS = Ci.nsIRequest.VALIDATE_ALWAYS;
const LF_LOAD_BYPASS_ALL_CACHES = Ci.nsIRequest.LOAD_BYPASS_CACHE | Ci.nsICachingChannel.LOAD_BYPASS_LOCAL_CACHE;

const NS_OK = 0;
const NS_BINDING_ABORTED = 0x804b0002;
const NS_BINDING_REDIRECTED = 0x804b0003;
const NS_ERROR_UNKNOWN_HOST = 0x804b001e;
const NS_ERROR_REDIRECT_LOOP = 0x804b001f;
const NS_ERROR_CONNECTION_REFUSED = 0x804b000e;
const NS_ERROR_NOT_AVAILABLE = 0x804b0111;

const DUMMY_OBJ = {};
const DUMMY_FUNC = function() {};

var prefs = Prefs.sub("xssFilter");
var xssOpts = prefs.bind("enabled");

const Listener = {
  QueryInterface: XPCOMUtils.generateQI(
    [
      Ci.nsIObserver,
      Ci.nsISupportsWeakReference,
      nsIWebProgressListener
    ]
  ),
  mustSkip: function(channel) {
    let ncb = channel.notificationCallbacks;
    let loadFlags = channel.loadFlags;
    if (!(loadFlags || ncb || channel.owner)) {
      try {
        if (channel.getRequestHeader("Content-type") == "application/ocsp-request")
          return true;
      } catch(e) {}
    }
    return (ncb instanceof Ci.nsIXMLHttpRequest) &&
            !RequestWatchdog.isCheckedChannel(channel);
  },
  onStart: function(channel) {
   
    if (this.mustSkip(channel)) {
      return;
    }
    try {
      let load = Load.retrieve(channel); 
      if (load) {
        if (load.isDocument) {
          ChannelReplacement.setLoadingChannel(channel, load.window);
          if (xssOpts.enabled) filterXSS(channel, load);
        }
      } else {
      }
  
      if (ABE.enabled && channel.status === 0) ABEHandler.check(channel);
     
    } catch (e) {
      RequestWatchdog.abort(channel);
      Cu.reportError(e);
      log("RequestWatchdog aborted " + channel.name + "! Reason: " + e + "\n" + e.stack);
    }
  },
  
  startup: function() {
    Services.obs.addObserver(this, "http-on-modify-request", false);
    Cc['@mozilla.org/docloaderservice;1'].getService(nsIWebProgress).addProgressListener(this,
                            nsIWebProgress.NOTIFY_STATE_REQUEST | nsIWebProgress.NOTIFY_STATUS);
  },
  shutdown: function() {
    try {
      Services.obs.removeObserver(this, "http-on-modify-request");
    } catch (e) {}
    try {
      Cc['@mozilla.org/docloaderservice;1'].getService(nsIWebProgress).removeProgressListener(this);
    } catch (e) {}
    prefs.dispose();
  },
  
  // nsIObserver
  observe: function(subject, topic, data) {
    if (subject instanceof Ci.nsIHttpChannel)
      this.onStart(subject);
  },
  
  // nsIWebProgressListener
  onLinkIconAvailable: DUMMY_FUNC,
  onStateChange: function(wp, req, stateFlags, status) {
    if (stateFlags & WP_STATE_START) {
      if (req instanceof Ci.nsIChannel) { 
        // handle docshell JS switching and other early duties

        if (LoadChecker.beingChecked(req.URI)) {
          // ContentPolicy couldn't complete! DOS attack?
          LoadChecker.remove(req.URI);
          IOUtil.abort(req);
          log("Aborted " + req.name + " on start, possible DOS attack against content policy.");
          return;
        }
        Load.attach(req);
      }
    } else if ((stateFlags & WP_STATE_STOP)) {
      // STOP REQUEST
      if (req instanceof Ci.nsIHttpChannel) {
        
        if (status === NS_ERROR_CONNECTION_REFUSED || status === NS_ERROR_NOT_AVAILABLE ||
            status === NS_ERROR_UNKNOWN_HOST) { // evict host from DNS cache to prevent DNS rebinding
          try {
            var host = req.URI.host;
            if (host) {
              if (status === NS_ERROR_UNKNOWN_HOST) {
                DNS.invalidate(host);
              } else {
                DNS.evict(host);
              }
            }
          } catch(e) {}
        }
      }
    }
  },

  onLocationChange: DUMMY_FUNC,
  onLocationChange2: DUMMY_FUNC,
  
  onStatusChange: function(wp, req, status, msg) {
    if (status == 0x804b0003 && (req instanceof Ci.nsIChannel) && !ABE.isDeferred(req)) { // DNS resolving, check if we need to clear the cache
      try {
        var host = req.URI.host;
        if (host) {
          var loadFlags = req.loadFlags;
          var cached = DNS.getCached(host);
          if (cached.expired ||
              loadFlags & req.VALIDATE_ALWAYS ||
              loadFlags & req.LOAD_BYPASS_ALL_CACHES) {
            DNS.evict(host);
          }
        }
      } catch (e) {}
    }
  },
  onSecurityChange: DUMMY_FUNC, 
  onProgressChange: DUMMY_FUNC,
  onRefreshAttempted: DUMMY_FUNC,  
};


const RequestWatchdog = {
  startup: function(channel) {
    Listener.startup();
    if (channel) {
      Load.attach(channel);
      Listener.onStart(channel);
    }
  },
  
  shutdown: function() {
    Listener.shutdown();
    ABE.dispose();
  },
  
  abort: function(channel) {
    channel.cancel(Components.results.NS_ERROR_ABORT);
  },
  referrer: function(channel) IOUtil.extractFromChannel(channel, "docshell.internalReferrer", null),
  
  isCheckedChannel: function(c) IOUtil.extractFromChannel(c, "noscript.checkedChannel", true),
  setCheckedChannel: function(c, v) {
    IOUtil.attachToChannel(c, "noscript.checkedChannel", v ? DUMMY_OBJ : null);
  },
  
  createCheckedXHR: function(method, url, async) {
    if (typeof(async) == "undefined") async = true;
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    xhr.open(method, url, !!async);
    this.setCheckedChannel(xhr.channel, true);
    
    if (typeof(async) === "function")
      xhr.addEventListener("readystatechange", async, false);
    
    return xhr;
  }
};

function filterXSS(channel, load) {
  new DOSChecker(channel).run(function() {
    XSSFilter.process(channel, load); 
  });
}

ABEHandler = {
  check: function(channel) {
    let req = new ABERequest(channel);
    var res = new DOSChecker(channel, true).run(function() {
      return ABE.checkRequest(req);
    });
    if (res) {
      ABENotifier.notify(res, !(req.isDoc && res.fatal));  
      if (res.fatal) return true;
    }
    return false;
  }
}
  

