var EXPORTED_SYMBOLS = ["UI"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
const TRIGGER_URI = "resource://noscript_@VERSION@/content/trigger.html";
const OVERLAY_URI = "resource://noscript_@VERSION@/content/overlay.html";

try {
  
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/L10n.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Var.jsm");
for each(let name in ["Presets", "Prefs", "Sites", "Policy", "NSA", "DOMHelper", "DOM", "IPC", "Thread"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm");

function UI(win) {
  this.win = win;
  this.listeners = [];
  this.init();
}

UI.create = function(win) win.nsaUI || new UI(win);
UI.get = function(win) {
  let ui = win.nsaUI;
  if (ui) {
    if (ui.VERSION !== UI.prototype.VERSION) {
      UI.dispose(win);
      ui = UI.create(win);
    }
    return ui;
  }
  return null;
}

UI.dispose = function(win) {
  if ("nsaUI" in win) {
    try {
      win.nsaUI.destroy();
    } catch (e) {
      log(e);
    }
    delete win.nsaUI;
  }
};

UI.prototype = {
  VERSION: "noscript_@VERSION@",
  hidden: true,
  dirty: false,
  listeners: [],
  
  init: function(delayed) {
    let w = this.win;
    if (w !== w.top) return;
    
    w.nsaUI = this;
    
    let d = w.document;
    let root = d.documentElement;
    if (!root) return;
 
    let trigger = this.trigger = d.getAnonymousElementByAttribute(root, "anonid", "trigger");
    if (!trigger) {
      if (!delayed) w.setTimeout(this.init.bind(this), 100, true);
      return;
    }
    trigger.style.display = "block";
    
    this.addListener(trigger, "click", function(ev) {
      let ir = this.win.QueryInterface(Ci.nsIInterfaceRequestor);
      let mv = ir.getInterface(Ci.nsIWebNavigation)
                  .QueryInterface(Ci.nsIDocShell)
                  .contentViewer.QueryInterface(Ci.nsIMarkupDocumentViewer)
      ev.preventDefault();
      ev.stopPropagation();
      trigger.blur(); // prevents focus rect
      this.showPermissionsManager();
    }, true);
    
    this.sync();
    
    this.addListener(w, ["resize", "MozMagnifyGesture", "scroll"], this.onResize, true);
    this.onResize();
  },
  

  addListener: function(target, type, handler, capture) {
    handler = handler.bind(this);
    let l = { target: Cu.getWeakReference(target), type: type, handler: Cu.getWeakReference(handler), capture: capture};
    this.listeners.push(l);
    if (Array.isArray(type)) {
      for each(t in type) target.addEventListener(t, handler, capture);
    } else target.addEventListener(type, handler, capture);
    return l;
  },
  removeListener: function(l) {
    if (!l) return;
    let idx = this.listeners.indexOf(l);
    if (idx !== -1) this.listeners.splice(idx, 1);
    let handler = l.handler && l.handler.get();
    let target = l.target && l.target.get();
    if ((!(handler && target))) return;
    if (Array.isArray(l.type)) {
      for each(t in l.type) target.removeEventListener(t, handler, l.capture);
    } else target.removeEventListener(l.type, handler, l.capture);
  },
  removeAllListeners: function() {
    let listeners = [].concat(this.listeners);
    delete this.listeners;
    for each(let l in listeners) this.removeListener(l);
  },
  
  destroy: function() {
    this.removeAllListeners();
    this.hide();
    this.win = this.trigger = this.overlay = this.dialog = null;
  },
  
  _buildPermissionsManager: function(d) {
    let {$: $, $$: $$, $x: $x} = new DOMHelper(d);
    let content = $("content");
    
    content.innerHTML = "";
    
    let listBox = $x("ul", {
      "id": "nsa-sites"
    }, content);
    
    $x("li", {
      "id": "nsa-sites-placeholder",
      "style": "text-align: center;",
      "_text": _("Checking permissions..."),
    }, listBox);
    
    this.sync();
  },
  
  
  sync: function(sources) {
    if (!sources) {
      sources = NSA.getSources(this.win);
    }
    
    let trigger = this.trigger;
    if (!trigger) return;
    
    if (!sources.top) {
      trigger.style.display = "";
      return;
    } else {
      trigger.style.display = "block";
    }
    
    let status = sources.perms.js[sources.top] ? (anyBlocked(sources.perms) ? "prt" : "yes") : "no";
    trigger.setAttribute("class", trigger.getAttribute("class").replace(/\bnsa-\w+/, 'nsa-' + status));
    
    if (!(this.hidden || this.dirty)) {
      this._sitesList = buildSitesList(sources);
      this.populate();
    } 
  },
  
  populate: function() {

    let d = this.dialog && this.dialog.ownerDocument;
    if (!d) return;
    
    let {$: $, $$: $$, $x: $x} = new DOMHelper(d);
    
    let listBox = $("nsa-sites");
    if (!listBox) return;
    
    let list = this._sitesList;
    if (!list) {
      this.hide();
      return;
    }

    listBox.innerHTML = "";
    
    let parent = d.createDocumentFragment();
    
    const {"trusted": TRUSTED, "untrusted": UNTRUSTED, "default": DEFAULT} = Policy.getInstance();
    

    let liAttrs = {tooltipText: _("Click here to tweak permissions")};
    let siteAttrs = {"class": "nsa-site"};
    let statusAttrs = {"class": "nsa-status"};
    
    for (let j = 0, len = list.length; j < len; j++) {
      let siteInfo = list[j];
      
      let li = $x('li', liAttrs, parent);
      li.addEventListener("click", function(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.rotateStatus(li, siteInfo);
      }.bind(this), true);
      
      siteAttrs._text = siteInfo.site;
      $x('span', siteAttrs, li);
      
      let perms = siteInfo.perms;
      statusAttrs._text = this._updateItemStatus(li,
        perms === TRUSTED ? "trusted" : perms === UNTRUSTED ? "untrusted" : perms === DEFAULT ? "default" : "custom",
        perms.js, siteInfo.top
      );
      
      $x('button', statusAttrs, li);
    }
    
    listBox.appendChild(parent);
    
    this.onResize();
  },
  
  _updateItemStatus: function(li, status, js, top) {
    let clz = (js ? "nsa-yes" : "nsa-no") + " nsa-" + status;
    if (top) clz += " nsa-top";
    li.className = clz;
    return _(status);
  },
  
  rotateStatus: function(li, siteInfo) {
   const {"trusted": TRUSTED, "untrusted": UNTRUSTED, "default": DEFAULT} = Policy.getInstance();
    
    let perms = siteInfo.perms;
    
    switch(perms) {
      case TRUSTED:
        perms = UNTRUSTED;
      break;
      case UNTRUSTED:
        perms = DEFAULT;
      break;
      default:
        perms = TRUSTED;
    }
    siteInfo.perms = perms;

    li.getElementsByTagName("button")[0].textContent = _(
      this._updateItemStatus(li,
        perms === TRUSTED ? "trusted" : perms === UNTRUSTED ? "untrusted" : perms === DEFAULT ? "default" : "custom",
        perms.js, siteInfo.top
      )
    );
    this.dirty = true;
  },
  
  showPermissionsManager: function() {
    try {
      this.show(_("NoScript"), this._buildPermissionsManager);
    } catch (e) {
      log(e);
    }
  },
  
  showClearClick: function(data) {
    Cu.import("resource://noscript_@VERSION@/modules/ClearClickUI.jsm");
    this.show(_("Potential Clickjacking Attack!"), ClearClickUI.createBuilder(data));
  },
  
  show: function(title, callback) {
    let win = this.win;
    let d = win.document;
    let overlay = this.overlay = d.getAnonymousElementByAttribute(d.documentElement, "anonid", "overlay");
    this.hidden = this.dirty = false;
    
    let onLoad = this.addListener(win, "DOMFrameContentLoaded", function(ev) {
      if (ev.target !== overlay) return;
      
      this.removeListener(onLoad);
      
      let w = overlay.contentWindow;
      
      if (w.location.href !== OVERLAY_URI || this.hidden) {
        overlay.style.display = "";
        return;
      }

      
      let d = overlay.contentDocument;
      this.dialog = d.getElementById("dialog");
      
      w._onClick = this.addListener(w, "click", function(ev) {
        if (this.dialog !== ev.target &&
            (this.dialog.compareDocumentPosition(ev.target) & this.dialog.DOCUMENT_POSITION_CONTAINED_BY) === 0) {
          this.hide();
        }
      }, false);
      
      w._onBack = this.addListener(w, "keydown", function(ev) {
        if (ev.keyCode === ev.DOM_VK_ESCAPE) {
          ev.preventDefault();
          ev.stopPropagation();
          this.hide();
        }
      }, true);
      
      w._onHide = this.addListener(w, "pagehide", function(ev) {
        if (ev.target === ev.currentTarget) {
          this.hide();
          this.dialog = this.overlay = null;
        }
      }, false);
      
      w.focus();
      
      
      
      d.getElementById("title").textContent = title;
      callback.call(this, d);
      this.trigger.className = this.trigger.className.replace(/\bactive\b/, '');
    }, false);
    
    this.trigger.className = this.trigger.className.replace(/\bactive\b/, '') + " active";
    this.win.setTimeout(function() {
      overlay.contentWindow.location.href = OVERLAY_URI;
      overlay.style.display = "block";
    }, 0);
  },

  onResize: function(ev) {
    // coalesce pending resize events
    if (ev) {
      if (!this._resizePending) {
        this._resizePending = true;
        Thread.delay(this.onResize, 100, this);
      }
      return;
    }
    this._resizePending = false;
    let w = this.win;
    let zoom = w.QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindowUtils).screenPixelsPerCSSPixel;
    
    if (zoom === 1 && w.screen.width === w.outerWidth && IPC.isAndroidNative) {
      let d = w.document;
      let ref = d.getAnonymousElementByAttribute(d.documentElement, "anonid", "reference");
      zoom = w.outerWidth / (ref && ref.offsetLeft || w.innerWidth);
    }
    let trigger = this.trigger;
    trigger.style.fontSize = zoom === 1 ? "" : (32 / zoom) + "px";
    
    if (this.hidden && ev) return;
    
    let dialog = this.dialog;
    if (!dialog) return;
    
    let d = dialog.ownerDocument;
    let mv = d.defaultView.QueryInterface(Ci.nsIInterfaceRequestor)
                   .getInterface(Ci.nsIWebNavigation)
                   .QueryInterface(Ci.nsIDocShell)
                   .contentViewer.QueryInterface(Ci.nsIMarkupDocumentViewer);
                   
    if (zoom != 1.0 || mv.fullZoom != 1.0) {
      mv.fullZoom = 1;
      if (IPC.isAndroidNative) d.body.style.fontSize = (10 / zoom) + "px";
    } else d.body.style.fontSize = "";
  
    let clientWidth = d.documentElement.clientWidth;
    let offset = (clientWidth - dialog.offsetWidth) / 2;
    dialog.style.left = offset + "px";
    
    let content = d.getElementById("content");
    if (!content) return;
    content.style.position = "absolute";
    dialog.style.bottom = dialog.style.top = ""

    if (content.scrollHeight <= content.offsetHeight) {
      content.style.position = "static";
      dialog.style.bottom = "auto";
      dialog.style.top = ((d.documentElement.clientHeight - dialog.offsetHeight) / 2) + "px"
    }
  },
  
  hide: function() {
    
    if (this.hidden) return;
    
    this.hidden = true;
    
    let overlay = this.overlay;
    if (overlay && overlay.style.display) {
      overlay.style.display = "";
      let w = overlay.contentWindow;
      if (w) {
        for each (let l in [w._onClick, w._onBack, w._onHide])
          this.removeListener(l);
      }
    }
    
    if (this.dirty) this.apply();
    
    this._sitesList = null;
    this.dirty = false;
    
    this.dialog = null;
    
    
  },
  
  cancel: function() {
    this.dirty = false;
    this.hide();
  },
  
  apply: function() {
    // Merge modified permissions and reload where needed
    
    let list = this._sitesList;
    if (list && this.dirty) {
      let changed = [];
      let policy = Policy.getInstance();
      let map = {__proto__: null};
      for (let j = list.length; j-- > 0;) {
        let siteInfo = list[j];
        let site = siteInfo.site;
        let perms = siteInfo.perms;
        let originalPerms = policy.getPerms(site);
        if (perms === originalPerms
           // || originalPerms && perms.toSource() === originalPerms.toSource()
          )
          continue;
        changed.push(site);
        map[site] = perms;
      }
      if (changed.length) {
        policy.merge(map);
        log("Saving " + policy.toSource());
        Policy.storePref();
        DOM.softReload(this.win);
      } else log("No permission change");
    }
  },
  
 
  
  
}

function anyBlocked(perms) {
  for (let p in perms) {
    let sites = perms[p];
    for (let s in sites)
      if (!sites[s]) return true;
  }
  return false;
}

function buildSitesList(sources) {
  let perms = sources.perms;
  let all = {__proto__: null};
  let map = {__proto__: null};
  let policy = Policy.getInstance();
  let top = sources.top, topItem = null;
  for (let p in perms) {
    let sites = perms[p];
    for (let s in sites) {
      if (s in all) continue;
      all[s] = true;
      let m = policy.match(s);
      let match = m || Sites.getBaseDomain(s) || s;
      let perms = policy.getExactPerms(m);
      if (s === top) topItem = {site: match, perms: perms, top: true};
      else if (!(topItem && topItem.site === match)) map[match] = perms;
    }
  }
  
  let list = [];
  for (let s in map) {
    list.push({site: s, perms: map[s]});
  }
  
  const {"trusted": TRUSTED, "untrusted": UNTRUSTED, "default": DEFAULT} = Policy.getInstance();
  
  list.sort(function (a, b)
    a.perms === b.perms
      ? (a.site < b.site ? -1 : a.site > b.site ? 1 : 0)
      : (a.perms === DEFAULT ? -1 : b.perms === DEFAULT ? 1 // DEFAULT 1st
         : a.perms === TRUSTED ? -1 : b.perms === TRUSTED ? 1 // TRUSTED 2nd, CUSTOM 3rd
          : a.perms === UNTRUSTED ? 1 : b.perms === UNTRUSTED ? -1 : 1) // UNTRUSTED last
  );
  
  if (topItem) list.unshift(topItem);
  return list;
}

} catch(e) {
  Cu.reportError(e);
}

