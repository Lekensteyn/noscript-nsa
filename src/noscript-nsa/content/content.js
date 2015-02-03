var {interfaces: Ci, classes: Cc, utils: Cu} = Components;
dump("Loading content script...\n");
(function install(sync) {
  try {
    let t = Date.now();
    try {
      Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
    } catch(e) {
      // when multiple processes are already spawned on install, the protocol handler doesn't automatically propagate
      if (sync) return;
      Cu.import("resource://gre/modules/Services.jsm");
      msg = sendSyncMessage("noscript_@VERSION@:GetBase", {});
      let baseURL  = msg[0];
      try {
        Services.console.logStringMessage("Failed to import module in content script, trying to register resource://${ns} on " + baseURL);
        Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler)
          .setSubstitution("noscript_@VERSION@", Services.io.newURI(baseURL, null, null)
        );
        install(true);
        Services.console.logStringMessage("Success!");
      } catch(e) {
        Cu.reportError(e);
      }
      return;
    }
    
    Cu.import("resource://gre/modules/XPCOMUtils.jsm");
    Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
    Cu.import("resource://noscript_@VERSION@/modules/NSA.jsm");
    Cu.import("resource://noscript_@VERSION@/modules/ClearClick.jsm");
    
    let self = this;
    
    function syncUI(force) {
      try {
        if (docShell.isActive) {
          let sources = NSA.getSources(content);
          if (force && !sources.top) sources = NSA.rebuildSources(content);
          sendAsyncMessage(IPC.MSG_RECEIVE_SOURCES, sources);
        }
      } catch (e) {
        log(e);
      }
    }
    
    function reloadActive() {
      if (docShell.isActive && docShell instanceof Ci.nsIWebNavigation) {
        docShell.reload(docShell.LOAD_FLAGS_CHARSET_CHANGE);
      }
    }
    
    const listener = {
      receiveMessage: function(msg) {
       
        if (msg.target != self) return;
        try {
          switch(msg.name) {
            case IPC.MSG_RELOAD_PAGE:
              reloadActive();
            break;
            case IPC.MSG_REQUEST_SOURCES:
              syncUI();
            break;
            case IPC.MSG_SHUTDOWN:
              
              removeMessageListener(IPC.MSG_REQUEST_SOURCES, listener);
              removeMessageListener(IPC.MSG_SHUTDOWN, listener);
              removeEventListener("DOMContentLoaded", listener, false);
              removeEventListener("pageshow", listener, false);
              removeEventListener("NSA:SourcesChanged", listener, false);
              IPC.DOMMessages.disconnect(self);
              
              ClearClick.detach(self);
              
              NSA.shutdown();
              Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler)
                .setSubstitution("noscript_@VERSION@", null)
            break;
          }
        } catch(e) {
          log(e);
        }
      },
      handleEvent: function(ev) {

        switch(ev.type) {
          case "DOMContentLoaded":
          case "pageshow":
            content._NSA_loaded = true;
          case "NSA:SourcesChanged":
            syncUI();
          break;
          case "NSA:PermissionsChanged":
            reloadActive();
          break;
        }
      }
    }
    addMessageListener(IPC.MSG_RELOAD_PAGE, listener);
    addMessageListener(IPC.MSG_REQUEST_SOURCES, listener);
    addMessageListener(IPC.MSG_SHUTDOWN, listener);
    addEventListener("DOMContentLoaded", listener, true);
    addEventListener("pageshow", listener, false);
    addEventListener("NSA:SourcesChanged", listener, false);
    
    IPC.DOMMessages.connect(this);
    ClearClick.attach(this);
    
    NSA.startup();
    
  } catch (e) { Components.utils.reportError(e + "\n" + e.stack); }
})();

