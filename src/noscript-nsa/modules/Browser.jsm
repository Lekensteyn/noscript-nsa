"use strict";
var EXPORTED_SYMBOLS = ["Browser"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

var Browser = {
  get wm() {
    delete this.wm;
    return this.wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  },
  forEachWindow: function(callback, self, future) {

    for (let enumerator = this.wm.getEnumerator("navigator:browser");
        enumerator.hasMoreElements();) {
      let win = enumerator.getNext();
      if (win instanceof Ci.nsIDOMWindow) {
        if (self) callback.call(self, win);
        else callback(win);
      }
    }
    if (future) {
      this.wm.addListener({
        onOpenWindow: function(win) {
          // Wait for the window to finish loading
          let domWindow = win.QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
          domWindow.addEventListener("load", function onLoad(ev) {
            domWindow.removeEventListener("load", onLoad, false);
            if (self) callback.call(self, domWindow);
            else callback(domWindow);
          }, false);
        },
        onCloseWindow: function(win) {},
        onWindowTitleChange: function(win, title) {}
      });
    }
  }
};
