var EXPORTED_SYMBOLS = ["DOMMessages"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

const MESSAGE_EVENT = "NSA:MessageEvent";

const DOMMessages = {
  sendSyncMessage: function(win, name, json) {
    return sendMessage(true, win, name, json);
  },
  sendAsyncMessage: function(win, name, json) {
    sendMessage(false, win, name, json);
  },
  connect: function(frame) {
    this.disconnect(frame);
    frame.addEventListener(MESSAGE_EVENT, frame.messageEventListener = new MessageEventListener(frame), false);
  },
  disconnect: function(frame) {
    if ("messageEventListener" in frame) frame.removeEventListener(MESSAGE_EVENT, frame.messageEventListener, false);
  }
}

function MessageEventListener(frame) {
  this.frame = frame;
}
MessageEventListener.prototype = {
  handleEvent: function(ev) {
    let m = ev.target.__nsaMessage;
    m.ret = this.frame[m.sync ? "sendSyncMessage" : "sendAsyncMessage"](
      m.name,
      m.json
    );
  }
}

function sendMessage(sync, win, name, json) {
  let w = win.top;
  let ev = w.document.createEvent("Events");
  let m = "__nsaMessage" in w ? w.__nsaMessage : w.__nsaMessage = {};
  ev.initEvent(MESSAGE_EVENT, true, false);
  m.name = name;
  m.json = json;
  m.sync = sync;
  w.dispatchEvent(ev);
  return sync ? m.ret : null;
}

