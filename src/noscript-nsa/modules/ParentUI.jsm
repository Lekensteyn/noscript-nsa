var EXPORTED_SYMBOLS = ["UI"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
try {
  
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

for each(let name in ["Notifications", "Var"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm");

const MESSAGES = [
  IPC.MSG_XSS_REPORT,
  IPC.MSG_ABE_REPORT,
];

let xssReportsCount = 0;


function UI(win) {
  this.win = win;
  win.nsaUI = this;
  for each(let msg in MESSAGES) IPC.globalManager.addMessageListener(msg, this);
  if ((this.tabs =
    ("BrowserApp" in win) && win.BrowserApp.deck ||
    ("gBrowser" in win) && win.gBrowser.tabContainer
  ))
    this.tabs.addEventListener("TabSelect", this, false);
}

UI.create = function(win) {
  UI.dispose(win);
  new UI(win);
}
UI.get = function(win) win.nsaUI;
UI.dispose = function(win) {
  if ("nsaUI" in win) {
    try {
      win.nsaUI.destroy();
    } catch (e) {
      log(e);
    }
    delete win.nsaUI;
    return true;
  }
  return false;
};

UI.prototype = {
  
  hidden: true,
  dirty: false,
  
  destroy: function() {
    for each(let msg in MESSAGES) IPC.globalManager.removeMessageListener(msg, this);

    if (this.tabs) {
      this.tabs.removeEventListener("TabSelect", this, false);
    }
    this.win = this.tabs = null;
  },
  
  handleEvent: function(ev) {
    switch(ev.type) {
      case "TabSelect":
        this.updateSources();
      break;
    }
  },
  
  updateSources: function() {
    // TODO: check whether window ids may help to be selective
    try {
      this.win.messageManager.broadcastAsyncMessage(IPC.MSG_REQUEST_SOURCES, null);
    } catch(e) {
      log(e);
    }
  },
  
  receiveMessage: function(msg) {
    const hash = msg.name + "::" + msg.json;
    if (msg.target && Var.get(msg.target, "msg") == hash) {
      return null;
    }
    Var.set(msg.target, "msg", hash);
    try {
      switch(msg.name) {
        case IPC.MSG_XSS_REPORT:
          return Notifications.notifyXSS(JSON.parse(msg.json), msg.target);
        case IPC.MSG_ABE_REPORT:
          return Notifications.notifyABE(JSON.parse(msg.json), msg.target);  
      }
    } catch (e) {
      Cu.reportError(e);
    } finally {
    }
    return null;
  },


}


} catch(e) {
  Cu.reportError(e);
}

