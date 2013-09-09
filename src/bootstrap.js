const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

 
const VERSION = "@VERSION@";

// bootstrap
function startup(aData, aReason)  {

  Root.setup(aData.resourceURI);
  try {
    Cu.import("resource://noscript_@VERSION@/modules/Parent.jsm");
    Parent.startup(Root, aReason === ADDON_INSTALL);
  } catch (e) {
    Cu.reportError(e);
    dump(e + "\n" + e.stack);
  }

}

function shutdown(aData, aReason) {
  try {
    Cu.import("resource://noscript_@VERSION@/modules/Parent.jsm");
    Parent.shutdown();
    if (aReason === ADDON_UNINSTALL) {
      Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
      Prefs.branch.deleteBranch("");
    }
    Root.teardown();
  } catch (e) {
    Cu.reportError(e);
  }
}

function install(aData, aReason) { }
function uninstall(aData, aReason) {
  
}

var Root = {
  namespace: "noscript_@VERSION@",
  resHandler:  Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler),
  _init: function(baseLocation) {
    this.prefix = "resource://" + this.namespace + "/";
    this.baseURL = baseLocation.spec + VERSION + "/";
    Services.console.logStringMessage("Base location is " + this.baseURL);
    return baseLocation;
  },
  
  setup: function(baseLocation) {
    if (baseLocation) this._init(baseLocation);
    this.resHandler.setSubstitution(this.namespace,
      Services.io.newURI(this.baseURL, null, null)                                
    );
  },
  teardown: function() {
    this.resHandler.setSubstitution(this.namespace, null);
  },
  URL: function(path) {
    return this.prefix + path;
  },
  fileURL: function(path) {
    return this.baseURL + path;
  }
};
