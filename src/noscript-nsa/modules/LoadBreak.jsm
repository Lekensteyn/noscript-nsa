var EXPORTED_SYMBOLS = ["LoadBreak"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DOM.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IOUtil.jsm");

function LoadBreak(msgName, skipTarget) {
  this.msgName = msgName;
  this.skipTarget = skipTarget || this;
}

LoadBreak.prototype = {
  serial: 0,
  ts: function() {
    return Date.now() + ":" + (this.serial++);
  },
  attempts: null,
  continueCallback: function(jsonData) {
    let data = JSON.parse(jsonData);
    if (!(data.id in this.attempts)) return;
    
    let attempt = this.attempts[data.id];
    delete this.attempts[data.id];
    
    if (data.action === "load") {
      let wn = DOM.getDocShellForWindow(attempt.window);
      if (wn) {
        attempt.window.addEventListener("pagehide", function() {
          this.skipTarget.skipURL = null;
        }.bind(this), true);
        this.skipTarget.skipURL = attempt.URL;
        wn.loadURI(attempt.URL, 
                wn.LOAD_FLAGS_BYPASS_CACHE | 
                wn.LOAD_FLAGS_IS_REFRESH,
                attempt.referrer, attempt.postData, null);
        
      } else log("WARNING: cannot grab a docShell to resume attempt " + data.id);
    }
  },
  report: function(data, channel) {
    let window = IOUtil.findWindow(channel);
    data._ts = this.ts();
    let ids = IPC.DOMMessages.sendSyncMessage(window, this.msgName, JSON.stringify(data));
    let id = ids.filter(function(i) i).shift();
    if (id) {
      if (!this.attempts) {
        this.attempts = {};
        if (IPC.isChildProcess) {
          IPC.childManager.addMessageListener(IPC.MSG_CONTINUE_LOAD, function continueLoad(msg) { this.continueCallback(msg.json) });
          IPC.childManager.addMessageListener(IPC.MSG_SHUTDOWN, function shutdown(msg) {
            IPC.childManager.removeMessageListener(IPC.MSG_CONTINUE_LOAD, continueLoad);
            IPC.childManager.removeMessageListener(IPC.MSG_SHUTDOWN, shutdown);
          });
        } else {
          Services.obs.addObserver(this, IPC.MSG_CONTINUE_LOAD, true)
        }
      }
      let attempts = this.attempts;
      window.addEventListener("pagehide", function(ev) {
        delete attempts[id];
        IPC.DOMMessages.sendAsyncMessage(window, this.msgName, JSON.stringify({id: id}));
      }, false);
      attempts[id] = new Attempt(window, channel);
    } else log("WARNING: no attempt ID for report!");
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  observe: function(subject, topic, data) {
    switch(topic) {
      case IPC.MSG_CONTINUE_LOAD:
        this.continueCallback(data);
      break
    }
  }
};

function Attempt(window, channel) {
  this._window = Cu.getWeakReference(window);
  this.URL = channel.URI.spec;
  this.referrer = channel.referrer;
  this.postData = (channel instanceof Ci.nsIUploadChannel) && channel.uploadStream || null;
}

Attempt.prototype = {
  get window() this._window.get()
}
