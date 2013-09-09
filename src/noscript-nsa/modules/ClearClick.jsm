var EXPORTED_SYMBOLS = ["ClearClick"];

const {utils: Cu} = Components;
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");

const EVENTS = ["mousedown", "mouseup", "click", "dblclick", "keydown", "keypress", "keyup", "blur"];

const MESSAGES = [IPC.MSG_CLEARCLICK_UNLOCK];


const ClearClick = {
  attach: function(eventTarget) {
    for each(let evType in EVENTS)
      eventTarget.addEventListener(evType, Handler, true);
    
    if (IPC.isChildProcess)
      for each(let msgName in MESSAGES)
        IPC.childManager.addMessageListener(msgName, Handler);
  },
  detach: function(eventTarget) {
    for each(let evType in EVENTS)
      eventTarget.removeEventListener(evType, Handler, true);
    
    if (IPC.isChildProcess)
      for each(let msgName in MESSAGES)
        IPC.childManager.removeMessageListener(msgName, Handler);
  }
}

const EMBED_RX = /^(?:OBJECT|EMBED|APPLET)$/i
const Handler = {
  initPrivate: function() {
    Cu.import("resource://noscript_@VERSION@/modules/ClearClickPrivate.jsm");
    for (let p in ClearClickPrivate)
      this[p] = ClearClickPrivate[p];
  },
  isEmbed: function(o) EMBED_RX.test(o) && !o.contentDocument,
  handleEvent: function(ev) { // bootstrap handler to be replaced on first frame/embed interaction
    const o = ev.target;
    const d = o.ownerDocument;
    const w = d && d.defaultView;
    if (w && (w.frameElement || this.isEmbed(o))) {
      this.initPrivate();
      this.handleEvent(ev);
    }
  },
  
  receiveMessage: function(msg) {
    if (MESSAGES.indexOf(msg.name) > -1) {
      this.initPrivate();
      this.receiveMessage(msg);
    }
  }
};
