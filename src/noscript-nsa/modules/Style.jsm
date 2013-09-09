var EXPORTED_SYMBOLS = ["Style"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");

const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

const USER_SHEET = sss.USER_SHEET;

var styles = { __proto__: null };

if (IPC.isChildProcess) {
  IPC.childManager.addMessageListener(IPC.MSG_SHUTDOWN, function(msg) {
    Style.removeAll();
  });
}

function styleURI(s) s in styles ? styles[s] : ios.newURI("data:text/css;charset=utf-8," + encodeURIComponent(s), null, null);

const Style = {
  add: function(s) {
    let uri = styleURI(s);
    if (!sss.sheetRegistered(uri, USER_SHEET)) {
      styles[s] = uri;
      sss.loadAndRegisterSheet(uri, USER_SHEET);
    }
    return uri;
  },
  remove: function(s) {
    let uri = styleURI(s);
    if (sss.sheetRegistered(uri, USER_SHEET)) {
      sss.unregisterSheet(uri, USER_SHEET);
      delete styles[uri];
    }
  },
  removeAll: function() {
    let ss = styles;
    for (let s in ss) {
      let uri = ss[s];
      if (sss.sheetRegistered(uri, USER_SHEET))
        sss.unregisterSheet(uri, USER_SHEET);
    }
    styles = { __proto__: null };
  }
}
