var EXPORTED_SYMBOLS = ["ClearClick"];

const {utils: Cu} = Components;

const EVENTS = ["mousedown", "mouseup", "click", "dblclick", "keydown", "keypress", "keyup", "blur"];

const ClearClick = {
  attach: function(eventTarget) {
    for each(let evType in EVENTS) eventTarget.addEventListener(evType, Handler, true);
  },
  detach: function(eventTarget) {
    for each(let evType in EVENTS) eventTarget.removeEventListener(evType, Handler, true);
    if ("privateDetach" in Handler) Handler.privateDetach();
  }
}

const EMBED_RX = /^(?:OBJECT|EMBED|APPLET)$/i
const Handler = {
  isEmbed: function(o) EMBED_RX.test(o),
  handleEvent: function(ev) { // bootstrap handler to be replaced on first frame/embed interaction
    const o = ev.target;
    const d = o.ownerDocument;
    const w = d && d.defaultView;
    if (w && (w.frameElement || this.isEmbed(o))) {
      Cu.import("resource://noscript_@VERSION@/modules/ClearClickPrivate.jsm");
      this.handleEvent = ClearClickPrivate.handleEvent;
      this.handleEvent(ev);
      
      this.privateDetach = ClearClickPrivate.detach;
    }
  }
};
