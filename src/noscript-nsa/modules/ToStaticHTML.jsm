var EXPORTED_SYMBOLS = ["ToStaticHTML"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "InjectionChecker", "resource://noscript_@VERSION@/modules/InjectionChecker.jsm")

var ToStaticHTML = {
  patch: function(doc) doc.addEventListener("NoScript:toStaticHTML", handler, false, true),
  script: "window.toStaticHTML = " +
    (
      function toStaticHTML(s) {
        var t = document.createElement("toStaticHTML");
        t.setAttribute("data-source", s);
        document.documentElement.appendChild(t);
        var ev = document.createEvent("Events");
        ev.initEvent("NoScript:toStaticHTML", true, false);
        t.dispatchEvent(ev);
        return t.innerHTML;
      }
    ).toString(),
  get unescapeHTML() {
    delete this.unescapeHTML;
    return this.unescapeHTML = Cc["@mozilla.org/feed-unescapehtml;1"].getService(Ci.nsIScriptableUnescapeHTML)
  }
}

function handler(ev) {
  try {
    var t = ev.target;
    var doc = t.ownerDocument;
    t.parentNode.removeChild(t);
    var s = t.getAttribute("data-source");
    t.appendChild(ToStaticHTML.unescapeHTML.parseFragment(s, false, null, t));
    // remove attributes from forms
    for each (let f in Array.slice(t.getElementsByTagName("form"))) {
      for each(let a in Array.slice(f.attributes)) {
        f.removeAttribute(a.name);
      }
    }
    
    let res = doc.evaluate('//@href', t, null, Ci.nsIDOMXPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let j = res.snapshotLength; j-- > 0;) {
      let attr = res.snapshotItem(j);
      if (InjectionChecker.checkURL(attr.nodeValue))
        attr.nodeValue = "#";
    }
    
  } catch(e) { Cu.reportError(e) }
}
