var EXPORTED_SYMBOLS = ["log", "debug"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
const console = Services.console;
function log(msg) {

  if (typeof msg === "object") {
    msg = "[NSA Error] " + msg + "\n" + msg.stack;
    try {
      Cu.reportError(nonl(msg));
    } catch (e) {}
  } else {
    msg = "[NSA] " + msg
    try {
      console.logStringMessage(nonl(msg));
    } catch (e) {}
  }
 
  dump(msg + "\n");
}

var debug = log;

function nonl(msg) msg.indexOf("\n") !== -1 ? msg.replace(/[\r\n]+/g, " ### ") : msg
