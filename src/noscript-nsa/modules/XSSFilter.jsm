var EXPORTED_SYMBOLS = ["XSSFilter"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
const DUMMY_OBJ = {};

Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DOM.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Sites.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/InjectionChecker.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Var.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IOUtil.jsm");

__defineGetter__("loadBreak", function() {
  delete this.loadBreak;
  Cu.import("resource://noscript_@VERSION@/modules/LoadBreak.jsm");
  return this.loadBreak = new LoadBreak(IPC.MSG_XSS_REPORT, XSSFilter);
});
const XSSFilter = {
  skipURL: null,
  
  process: function(channel, load) {
    if (!load) load = Load.retrieve(channel);
    
    let uri = channel.URI;
    let origin = load.origin;
    let destinationSite = Sites.getSite(uri);
    
    let window = load.window;
    
    let js = Policy.getInstance().getPerms(destinationSite).js;
    if (origin && destinationSite === Sites.getSite(origin) &&
        Var.get(window, "js") === js) {
      return false; // same site
    }

    let url = uri.spec;
    if (url === this.skipURL) {
      this.skipURL = null;
      return false;
    }
    let noscript = !js;
    
    if (js) {
      if (window.name) this.checkWindowName(window);
      IOUtil.attachToChannel(channel, "noscript.checkWindowName", DUMMY_OBJ);
    }
    let postData = (channel instanceof Ci.nsIUploadChannel) && channel.postData || null;
    // TODO: add charset info to the InjectionChecker calls!!!
    let injection = InjectionChecker.checkURL(url, noscript) ||
        postData && InjectionChecker.checkPost(channel, null, noscript);

    if (!injection) return false;

    try {
      loadBreak.report({ location: url, origin: load.origin && load.origin.spec }, channel);
    } finally {
      channel.cancel(Components.results.NS_ERROR_ABORT);
    }
    return true;
  },
  
  checkWindowName: function(window) {
    var originalAttempt = window.name;
    
    if (/\s*{[\s\S]+}\s*/.test(originalAttempt)) {
      try {
        JSON.parse(originalAttempt); // fast track for crazy JSON in name like on NYT
        return;
      } catch(e) {}
    }
    
    if (/[%=\(\\]/.test(originalAttempt) && InjectionChecker.checkJS(originalAttempt)) {
      window.name = originalAttempt.replace(/[%=\(\\]/g, " ");
    }
    
    if (/[%=\(\\<]/.test(originalAttempt) && InjectionChecker.checkURL(originalAttempt)) {
      window.name = originalAttempt.replace(/[%=\(\\<]/g, " ");
    }
    
    if (originalAttempt.length > 11) {
      try {
        if ((originalAttempt.length % 4 == 0)) { 
          var bin = window.atob(window.name);
          if(/[%=\(\\]/.test(bin) && InjectionChecker.checkURL(bin)) {
            window.name = "BASE_64_XSS";
          }
        }
      } catch(e) {}
    }
    if (originalAttempt != window.name) {
      log('[NoScript XSS]: sanitized window.name, "' + originalAttempt + '" to "' + window.name + '".');
    }
  }

};
