var EXPORTED_SYMBOLS = ["DOM"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

var idCounter = Math.round(Math.random() * 9999);

var DOM = {
  getDocShellForWindow: function(window) {
    try {
      return window.QueryInterface(Ci.nsIInterfaceRequestor)
                   .getInterface(Ci.nsIWebNavigation)
                   .QueryInterface(Ci.nsIDocShell);
    } catch(e) {
      return null;
    }
  },
  
  get mostRecentBrowserWindow() Services.wm.getMostRecentWindow("navigator:browser"),
  
  softReload: function(window) {
    let docShell = this.getDocShellForWindow(window);
    if (docShell) docShell.reload(docShell.LOAD_FLAGS_CHARSET_CHANGE);
  },
  
  rndId: function() Date.now().toString(32) + "_" + (idCounter++).toString(32) + "_" + Math.round(Math.random() * 9999999).toString(32),
};

