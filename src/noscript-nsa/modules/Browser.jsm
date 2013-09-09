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
        if (self) callback.call(self, win)
        else callback(win);
      }
    }
    if (future) {
      this.wm.addListener({
        onOpenWindow: function(win) {
          if (win instanceof Ci.nsIDOMChromeWindow) {
            // Wait for the window to finish loading
            win.QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowInternal)
              .addEventListener("load", function(ev) {
              let win = ev.currentTarget;
              win.removeEventListener("load", arguments.callee, false);
              if (self) callback.call(self, win)
              else callback(win);
            }, false);
          }
        },
        onCloseWindow: function(win) {},
        onWindowTitleChange: function(win, title) {}
      });
    }
  }
}
