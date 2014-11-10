var EXPORTED_SYMBOLS = ["Parent"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
var t0 = Date.now();

try {

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DOM.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Defaults.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Browser.jsm");
Cu.import("resource://noscript_@VERSION@/modules/ParentUI.jsm");
Cu.import("resource://noscript_@VERSION@/modules/PermissionsUI.jsm");

try {
  Cu.import("resource://noscript_@VERSION@/modules/Sync.jsm");
} catch (e) {
  log("No compatible sync found");
  // TODO: implement Android-native sync
}
for each(let name in ["IOUtil", "ChannelReplacement", "ABE"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm");

log("resource://noscript_@VERSION@/modules/");

const Life = {
  started: [],
  start: function(obj) {
    obj.startup(obj);
    this.started.push(obj);
  },
  shutdown: function() {
    for (let j = this.started.length; j-- > 0;)
      try { this.started[j].shutdown(); } catch (e) {}
    this.started = [];
  }
};

const Parent = {
  
  QueryInterface: XPCOMUtils.generateQI(
    [ Ci.nsIFrameMessageListener, Ci.nsISupportsWeakReference]
  ),
 
  startup: function(root, firstRun) {
    try {
      if (firstRun) {
        log("First run!");
        showPresets();
      }
      
      this.root = root;
      this.contentScriptURL = root.fileURL("content/content.js");
      this.agentSheetURL = root.fileURL("content/browser.css");
      IPC.parentManager.addMessageListener(IPC.MSG_GET_POLICY, this);
      
      IPC.globalManager.addMessageListener("noscript_@VERSION@:GetBase", this);
      IPC.globalManager.loadFrameScript(this.contentScriptURL, true);
      
      Life.start(PolicyObserver);
      Life.start(HttpObserver);
      Life.start(OptionsObserver);
      
      Browser.forEachWindow(this.loadInWindow, this, true);
      
      
      let sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
      sss.loadAndRegisterSheet(Services.io.newURI(this.agentSheetURL, null, null), sss.AGENT_SHEET);
      try {
        Life.start(NoScriptSyncEngine);
      } catch (e) {
        log("No sync available");
      }
    } catch (e) {
      log(e);
    } finally {
      let t = Date.now();
      log("Parent startup: " + (t - t0) + " at " + t + "(t0 = " + t0 + ")");
    }
  },
  shutdown: function() {
    let t = Date.now();
        
    Browser.forEachWindow(this.unloadFromWindow, this, false);
    
    let sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
    sss.unregisterSheet(Services.io.newURI(this.agentSheetURL, null, null), sss.AGENT_SHEET);
    
    IPC.globalManager.removeMessageListener("noscript_@VERSION@:GetBase", this);
    IPC.parentManager.removeMessageListener(IPC.MSG_GET_POLICY, this);
    IPC.globalManager.broadcastAsyncMessage(IPC.MSG_SHUTDOWN, null);
    IPC.parentManager.broadcastAsyncMessage(IPC.MSG_SHUTDOWN, null);
    
    Life.shutdown();
    
    try { // WAN might not been imported yet
      WAN.dispose();
    } catch (e) {}
    
    Cu.import("resource://noscript_@VERSION@/modules/NSA.jsm");
    NSA.shutdown();
    
    if ("removeDelayedFrameScript" in IPC.globalManager)
      IPC.globalManager.removeDelayedFrameScript(this.contentScriptURL);
    
    log("Shutdown done in " + (Date.now() - t));
  },

  loadInWindow: function(win) {
    UI.create(win);
    PermissionsUI.loadIntoWindow(win);
  },
  unloadFromWindow: function(win) {
    PermissionsUI.unloadFromWindow(win);
    UI.dispose(win);
  },
  // nsIFrameMessageListener
  receiveMessage: function(msg) {
    switch(msg.name) {
      case IPC.MSG_GET_POLICY:
        return Policy.getInstance().serialize(true);
      case "noscript_@VERSION@:GetBase":
        return this.root.baseURL;
    }
    return null;
  }
}

const observerQI = XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]);

var PolicyObserver = {
  QueryInterface: observerQI,
  startup: function() {
    Prefs.branch.addObserver("policy", this, true);
  },
  shutdown: function() {
    Prefs.branch.addObserver("policy", this);
  },
  observe: function(subject, topic, data) {
    let p = Policy.getInstance();
    let pref = Policy.getPref();
    try {
      p.unserialize(pref, true)
    } catch(e) {
      log("Invalid policy JSON syntax!");
      return;
    }
    Prefs.persist();
    try {
      IPC.parentManager.broadcastAsyncMessage(IPC.MSG_REFRESH_POLICY, p.serialize(true));
    } catch(e) {
      log(e);
    }
  }
};

var HttpObserver = {
  QueryInterface: observerQI,
  startup: function() {
    Services.obs.addObserver(this, "http-on-modify-request", true);
  },
  shutdown: function() {
    Services.obs.removeObserver(this, "http-on-modify-request");
  },
  observe: function(channel) {
    if (!(channel instanceof Ci.nsIHttpChannel)) return;
    Cu.import("resource://noscript_@VERSION@/modules/WAN.jsm");
    this.shutdown();
  }
};

var OptionsObserver = {
  QueryInterface: observerQI,
  startup: function() {
    Services.obs.addObserver(this, "addon-options-displayed", true);
  },
  shutdown: function() {
    Services.obs.removeObserver(this, "addon-options-displayed");
  },
  observe: function(doc, topic, data) {
    if (data != "{73a6fe31-595d-460b-a920-fcc0f8843232}") return;
    let w = doc.defaultView;
    Cu.import("resource://noscript_@VERSION@/modules/Options.jsm");
    w.nsaUI = Options;
    w.setTimeout(function() Options.populatePresets(doc), 200);
  }
}


function showPresets() {
  Cu.import("resource://noscript_@VERSION@/modules/Thread.jsm");
  Thread.asap(function() {
    let d = DOM.mostRecentBrowserWindow.document;
    d.getElementById("tool-panel-open").click();
    d.getElementById("tool-addons").click();
    Thread.delay(function() {
      d.getElementById("urn:mozilla:item:{73a6fe31-595d-460b-a920-fcc0f8843232}").showOptions();
    }, 200);
  });
}




} catch(e) {
  Cu.reportError(e)
}
