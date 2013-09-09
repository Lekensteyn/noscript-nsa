var EXPORTED_SYMBOLS = ["ClearClickPrivate"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("resource://noscript_@VERSION@/modules/Sites.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Var.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

for each(let name in ["ObstructionChecker", "Placeholder", "DOM"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm");

const PREFIX = "_ClearClick_";

var policy = Policy.getInstance();

const INTERNAL_SCHEME_RX = /^(?:chrome|resource|about):/;
const SEMANTIC_CONTAINER_RX = /^(?:P(?:RE)?|[UO]L|DIR|Q(?:UOTE)?|TABLE)$/i;
const
  CLICK_KEY_RX = /click|key/,
  DOWN_RX = /mousedown|keydown/
  ;
  

var prompting = false;

Prefs.branch.addObserver("clearClick", {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  observe: function(subject, topic, data) {
    switch (data) {
      case "enabled":
        ClearClickPrivate.enabled = Prefs.get(data);
        break;
    }
  }
}, true);

const ClearClickPrivate = {
  enabled: Prefs.get("clearClick.enabled"),
  handleEvent: function(ev) {
    if (!this.enabled) return;
    
    const o = ev.target;
    const d = o.ownerDocument;
    if (!d) return;
    
    const w = d.defaultView;
    if (!w) return;

    
    const top = w.top;
    
    if (!("__clearClickUnlocked" in top)) 
      top.__clearClickUnlocked = !appliesHere(top.location.href);

    if (top.__clearClickUnlocked) return;
    
    let isEmbed = this.isEmbed(o);
    if (!isEmbed && w.__clearClickUnlocked) return; 
    
    let url = isEmbed && (o.src || o.data) || o.ownerDocument.URL;
    
    if (!("__clearClickUnlocked" in o)) try {
      
      o.__clearClickUnlocked =
        isEmbed
        ? Exceptions.checkSub(url) || Whitelist.contains(top.location.href, url)
        : w == top ||
          o === d.documentElement || o === d.body || // key event on empty region
          isSemanticContainer(o) || Placeholder.isPlaceholder(o) ||
          (w.__clearClickUnlocked = sameSiteParents(w) ||
              Whitelist.contains(top.location.href, url) ||
              Exceptions.checkSub(url)
            );

    } catch(e) {
      log(e);
    }
    
    if (o.__clearClickUnlocked)
      return;
    
    var verbose = debug;
    
    var p = Var.getOrCreate(o, "clearClickProps");
    var etype = ev.type;
    
    
    var ts;
    var obstructed, ctx, primaryEvent;
    try {

      if (etype == "blur") {
        if("lastEtype" in p && CLICK_KEY_RX.test(p.lastEtype) && p.unlocked)
          p.unlocked = false;
        
        return;
      }
      if (p.unlocked) return;
      
      ts = Date.now();
      
      ctx = new ObstructionChecker(isEmbed, ev, debug);
            
      primaryEvent = DOWN_RX.test(etype) ||
        // submit button generates a syntethic click if any text-control receives [Enter]: we must consider this "primary"
        etype === "click" && ev.screenX == 0 && ev.screenY == 0 && ev.pageX == 0 && ev.pageY == 0
           && ev.clientX == 0 && ev.clientY == 0 && ev.target.form &&
         ((ctx.box = ctx.getBox(ev.target, d, w)).screenX * ctx.box.screenY !== 0) ||
         // allow infra-document drag operations and tabulations
         etype != "blur" && top.__clearClickDoc == d
           && (top.__clearClickProps.unlocked || top.__clearClickProps.lastEtype == "blur")
        ;
    
      obstructed = (primaryEvent || !("obstructed" in p))
        ? p.obstructed = ctx.isObstructed()
        : p.obstructed; // cache for non-primary events       
    } catch(e) {
      log(e);
      obstructed = true;
    } finally {
      p.lastEtype = etype;
      top.__clearClickProps = p;
      top.__clearClickDoc = d;
    }
    
    var quarantine = ts - (p.ts || 0);
    
    if (verbose) log("ClearClick: " + ev.target.tagName + " " + etype +
       "(s:{" + ev.screenX + "," + ev.screenY + "}, p:{" + ev.pageX + "," + ev.pageY + "}, c:{" + ev.clientX + "," + ev.clientY + 
       ", w:" + ev.which + "}) - obstructed: " + obstructed + ", check time: " + (Date.now() - ts) + ", quarantine: " + quarantine +
       ", primary: " + primaryEvent + ", ccp:" + (top.__clearClickProps && top.__clearClickProps.toSource()));
    
    var unlocked = !obstructed && primaryEvent && quarantine > 3000;
    
    if (unlocked) {
      if (verbose) log("ClearClick: unlocking " + ev.target.tagName + " " + etype);
      p.unlocked = true;
    } else {
      
      swallowEvent(ev);
      log("[ClearClick] Swallowed event " + etype + " on " + forLog(o) + " at " + w.location.href + " (" + verbose + ")");
      var docShell = DOM.getDocShellForWindow(w);
      var loading = docShell && (docShell instanceof Ci.nsIWebProgress) && docShell.isLoadingDocument;
      if (!loading) {
        p.ts = ts;
        if (primaryEvent && ctx.img && Prefs.get("clearClick.prompt")) {
          for each(let x in [o, w]) delete x.__clearClickUnlocked;
          try {
            prompting = true;
            
            IPC.DOMMessages.sendAsyncMessage(
              top,
              IPC.MSG_CLEARCLICK_REPORT, JSON.stringify({
                url: url,
                pageURL: w.location.href,
                topURL: w.top.location.href,
                img: ctx.img,
                pageX: ev.pageX,
                pageY: ev.pageY
              }));
          } finally {
            prompting = false;
          }
        }
      }
    }
  },
  receiveMessage: function(msg) {
   try {
    switch (msg.name) {
      case IPC.MSG_CLEARCLICK_UNLOCK:
        let urls = JSON.parse(msg.json);
        Whitelist.add(urls.top, urls.current);
      break;
    }
   } catch(e) {
    log(e);
   }
  }
};

function swallowEvent(ev) {
  ev.cancelBubble = true;
  ev.stopPropagation();
  ev.preventDefault();
}

function sameSiteParents(w) {
  var site = Sites.getSite(w.location.href);
  if (site == "about:blank") site = "";
  for(let p = w.parent; p != w; w = p, p = w.parent) {
    let parentSite = Sites.getSite(p.location.href);
    if (!site || INTERNAL_SCHEME_RX.test(parentSite)) {
      site = parentSite;
      continue;
    }
    if (site != parentSite) return false;
  }
  return true;
}

function appliesHere(url) !(Exceptions.checkTop(url) || policy.getPerms(Sites.getSite(url)).cj);

function isSemanticContainer(o) SEMANTIC_CONTAINER_RX.test(o.tagName);


function forLog(o) o.id ? "#" + o.id : o.tagName + "#" + (o.tabIndex || 0);

XPCOMUtils.defineLazyGetter(this, "debug", function() Prefs.get("clearClick.debug"));

const Exceptions = {
  // TODO: back these with preferences
  checkTop: function() false,
  checkSub: function() false
}


const Whitelist = {
   _sites: {},
  length: 0,
  contains: function(topURL, url) {
    let topSite = Sites.getSite(topURL);
    return topSite in this._sites
      ? this._sites[topSite].indexOf(url) > -1
      : false;
  },
  
  add: function(topURL, url) {
    if (this.contains(topURL, url)) return;
    let topSite = Sites.getSite(topURL);
    let list = topSite in this._sites ? this._sites[topSite] : this._sites[topSite] = [];
    list.push(url);
  },
  
  reset: function() {
    this._sites = {};
    this.length = 0;
  }
};
