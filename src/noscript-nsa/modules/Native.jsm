var EXPORTED_SYMBOLS = ["Native"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

var Native = {
  get window() {
    return DOM.mostRecentBrowserWindow.NativeWindow;
  }
};

