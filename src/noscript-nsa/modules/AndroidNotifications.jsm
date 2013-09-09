var EXPORTED_SYMBOLS = ["notify"];

function notify(id, win, browser, msg, type, buttons, priority) {
    const doorhanger = win.NativeWindow.doorhanger;
    const tab = win.BrowserApp.getTabForBrowser(browser);
    
    if (!msg) {  // we're closing a notification
      doorhanger.hide(id, tab.id);
      return null;
    }
    
    win.BrowserApp.selectTab(tab);
    
    doorhanger.show(msg, id, buttons, tab.id, { persistence: 1 });
    
    return id;
}
