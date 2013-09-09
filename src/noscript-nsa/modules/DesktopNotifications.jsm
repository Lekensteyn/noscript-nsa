var EXPORTED_SYMBOLS = ["notify"];

function notify(id, win, browser, msg, type, buttons, priority) {
  let pn = win.PopupNotifications;
  if (!msg) {
    let n = pn.getNotification(id, browser);
    if (n) pn.remove(n);
    return null;
  }
  win.gBrowser.selectedBrowser = browser;
  let button = buttons.shift();
  pn.show(browser, id, msg, null, button, buttons.length ? buttons : undefined);
  return id;
}

function notify_old(id, win, browser, msg, type, buttons, priority) {
    const nb = win.gBrowser.getNotificationBox(browser);

    if (!msg) {  // we're closing a notification
      let not = nb.getNotificationWithValue(id);
      if (not) nb.removeNotification(not);
      return null;
    }
    
    win.gBrowser.selectedBrowser = browser;
    if (typeof priority === "string") priority = nb["PRIORITY_" + priority];
    else if (typeof priority === "undefined") priority = nb.PRIORITY_WARNING_HIGH;
    
    return nb.appendNotification(
      msg,
      id,
      "resource://noscript_@VERSION@/content/" + type + ".png",
      priority,
      buttons
    ).value;
}
