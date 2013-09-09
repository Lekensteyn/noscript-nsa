var EXPORTED_SYMBOLS = ["Notifications"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Sites.jsm");
Cu.import("resource://noscript_@VERSION@/modules/L10n.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");

const
  LABEL_LOAD_ANYWAY = _("Load anyway"),
  AKEY_LOAD_ANYWAY = _("A")
;

var Notifications = {
  count: 0,
  
  handle: function(browser, msg, type, buttons, priority) {
    const win = browser.ownerDocument.defaultView;
    if (typeof(notify) !== "function") {
      let module = (("NativeWindow" in win) ? "Android" : "Desktop") + "Notifications.jsm";
      Cu.import("resource://noscript_@VERSION@/modules/" + module);
    }
    return type
      ? notify("NoScript." + (this.count++), win, browser, msg, type, buttons, priority)
      : notify(msg, win, browser); // hiding
  },
  
  notifyXSS: function(info, browser) {

    if (info.id) return this.handle(browser, info.id);

    let from = Sites.getSite(info.origin);
    if (!from)
      from = /^(?:chrome|about|resource):/.test(info.origin) ? _("from your browser chrome") : _("from an unknown origin"); 
    
    const msg = "NoScript blocked a potential XSS attempt from %1$S to %2$S";
    
    let confirmation = Prefs.get("xssFilter.reload.confirm");
    
    let id = this.handle(browser, _(msg, from, Sites.getSite(info.location)), "xss", [
        {
          label: LABEL_LOAD_ANYWAY,
          accessKey: AKEY_LOAD_ANYWAY,
          popup: null,
          callback: function() {   
            if (!confirmation || Services.prompt.confirm(browser.ownerDocument.defaultView, _("NoScript XSS Filter"),
                _("Do you really want to bypass the XSS Filter and load [%1$S] from %2$S?", wrap(info.location), from))
            ) {
              continueLoad({ action: "load", id: id });
              id = null;
            }
          }
        }
      ]);
    return id;
  },
  
  notifyABE: function(info, browser) {
    let id = info.id
      ? this.handle(browser, info.id)
      : this.handle(browser,
        _("Request %1$S filtered by ABE: <%2$S> %3$S", info.request, info.destinations, info.predicate),
        "abe",
        [
          {
            label: LABEL_LOAD_ANYWAY,
            accessKey: AKEY_LOAD_ANYWAY,
            popup: null,
            callback: function() {   
              if (!Prefs.get("ABE.reload.confirm") ||
                    Services.prompt.confirm(browser.ownerDocument.defaultView, _("NoScript ABE"),
                  _("Do you really want to bypass the ABE Filter and load [%1$S]?", wrap(info.request)))
              ) {
                continueLoad({
                  action: "load",
                  id: id
                });
              }
            }
          }
        ]
      );
    return id;
  }
}

function continueLoad(msgData) {
  let msgName = IPC.MSG_CONTINUE_LOAD;
  let json = JSON.stringify(msgData);
  IPC.parentManager.broadcastAsyncMessage(msgName, json);
  Services.obs.notifyObservers(null, msgName, json);
}

function wrap(msg, count) {
  return msg.replace(new RegExp("\\w{" + (parseInt(count) || 20) + "}", 'g'), "$&\u200B");
}
