var EXPORTED_SYMBOLS = ["NSA"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

try {
  
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DOM.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Sites.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Load.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Var.jsm");

for each(let name in ["Placeholder", "RequestWatchdog", "ABE", "PageMod", "ScriptSurrogate", "IOUtil", "XSSFilter"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm")

// private data
var up = false;
var policy = null;

var Service = {

  get categoryManager() {
    delete this.categoryManager;
    return this.categoryManager = Cc['@mozilla.org/categorymanager;1'
        ].getService(Ci.nsICategoryManager);
  },
  classDescription: "NSA service",
  classID: Components.ID("f760e700-2d88-11e0-91fa-0800200c9a66"),
  contractID: "@maone.net/nsa-content/service;1",

  aboutClassID: Components.ID("6b6648a0-d15d-45a4-ac3a-ea69488f6fb8"),
  aboutContractID: "@mozilla.org/network/protocol/about;1?what=noscript",
  
  _XPCOMCategories: [
                      "content-policy",
                      "net-channel-event-sinks",
                    ],
  _observedTopics: [
                      "content-document-global-created",
                      "http-on-modify-request",
                   ],

  QueryInterface: XPCOMUtils.generateQI(
    [
      Ci.nsIObserver, Ci.nsIContentPolicy, Ci.nsIChannelEventSink,
      Ci.nsIFactory, Ci.nsISupportsWeakReference,
      Ci.nsIFrameMessageListener,
      Ci.nsIAboutModule,
    ]
    ),
  
  createInstance: function() {
    return this;
  },
  
  startup: function() {
    if (up) return;
    
    up = true;
    
    policy = Policy.getInstance();
    this.shouldLoad = this._shouldLoad;
    
    let cr = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    
    try {
      cr.registerFactory(this.classID, this.classDescription, this.contractID, this);
    } catch (e) {
      // The factory might already be registered
      log(e);
      return;
    }
    cr.registerFactory(this.aboutClassID, this.classDescription, this.aboutContractID, this);  
    
    const catMan = this.categoryManager;
    for each (let category in this._XPCOMCategories) {
      catMan.addCategoryEntry(category, this.contractID, this.contractID, false, true);
    }
    
    const obs = Services.obs;
    for each(let topic in this._observedTopics)
      obs.addObserver(this, topic, true);
  },
  
  shutdown: function() {
    if (!up) return;

    up = false;

    RequestWatchdog.shutdown();

    try {
      const obs = Services.obs;
      for each(let topic in this._observedTopics) {
        try { obs.removeObserver(this, topic); } catch (e) {}
      }
      
      let catMan = this.categoryManager;
      for each (let category in this._XPCOMCategories) {
        try { catMan.deleteCategoryEntry(category, this.contractID, false); } catch (e) {}
      }
      
      let cr = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
      
      cr.unregisterFactory(this.classID, this);
      cr.unregisterFactory(this.aboutClassID, this);
      
    } catch (e) {
      log(e);
    }
    
    this.shouldLoad = function() CP_ACCEPT;
    policy = null;
     
  },
  

  // nsIObserver
  observe: function(subject, topic, data) {
    switch(topic) {
      case "content-document-global-created":
        if (data && data !== "null") onWindowSwitch(subject, data);
        return;
      case "http-on-modify-request":
        if (subject instanceof Ci.nsIHttpChannel && Load.last) {
          let t0 = Date.now();
          RequestWatchdog.startup(subject);
          Services.obs.removeObserver(this, topic);
          let t = Date.now();
          log("First request " + subject. name + "checked in " + (t - t0) + " (including lazy init) at " + t);
        }
       return;
    }
  },
  
  // nsIContentPolicy
  
  _handleClickToPlay: function(obj) {
    if (obj instanceof Ci.nsIObjectLoadingContent && ("playPlugin" in obj) && ("activated" in obj) &&
        !obj.activated && !Var.get(obj, "activated")) {
      Var.set(obj, "activated", true);
      Thread.asap(function() obj.playPlugin());
    }
  },
  
  _skipSchemeRx: /^(?:chrome|about|javascript|data|resource)$/,
  _javaRx: /java/i,
  _silverlightRx: /silverlight/i,
  _flashRx: /shockwave|futuresplash/i,
  
  _shouldLoad: function(contentType, wrappedLocation, requestOrigin, ctx, mimeGuess, internalCall) {
    if (this._skipSchemeRx.test(wrappedLocation.scheme))
      return CP_ACCEPT;
    
    
    if (!wrappedLocation) wrappedLocation = requestOrigin;
    
    let contentLocation = IOUtil.unwrapURL(wrappedLocation);
   
   

    let accepting = true,
      win = null;
    
    
    let isJava = contentType === 5 && this._javaRx.test(mimeGuess) && internalCall !== CP_INTERNAL_JAR;
    if (isJava) {
      try {
        let cs = context.ownerDocument.characterSet;
        let code, codeBase, archive;
        
        let pp = context.getElementsByTagName("param");
        for (let j = 0, len = pp.length; j < len; j++) {
          let p = pp[j];
          if (p.parentNode == context) {
            switch(p.name.toLowerCase()) {
              case "code": code = p.value; break;
              case "codebase": codeBase = p.value; break;
              case "archive": archive = p.value; break;
            }
          }
        }
        
        if (!code)
          code = context.getAttribute("code");
        
        if (!codeBase)
          codeBase = context.getAttribute("codebase") ||
          (context instanceof Ci.nsIDOMHTMLAppletElement ? "/" : ".");
        
        if (!archive)
          archive = context.getAttribute("archive");
        
        try {
          contentLocation = IOS.newURI(codeBase, cs, requestOrigin);
        } catch (e) {}
 
        if (context instanceof Ci.nsIDOMHTMLEmbedElement) {
          code = context.getAttribute("code"); 
          if (code && /\bjava\b/.test(mimeGuess)) {
            archive = archive ? code + " " + archive : code;
          } else code = '';
        }
        if (archive) {
          let prePaths;
          let base = contentLocation;       
          let jars = archive.split(/[\s,]+/)
          for (let j = jars.length; j-- > 0;) {
            try {
              let jar = jars[j];
              let u = IOS.newURI(base, cs, jar);
              let prePath = u.prePath;
              if (prePath !== base.prePath) {
                if (prePaths) {
                  if (prePaths.indexOf(prePath) !== -1) continue;
                  prePaths.push(prePath);
                } else prePaths = [prePath];
              } else {
                if (j === 0 && code === jar) contentLocation = u;
                continue;
              }
              let res = this.shouldLoad(contentType, u, requestOrigin, context, mimeGuess, CP_INTERNAL_JAR);
              if (res !== CP_OK) return res;
            } catch (e) {
              log(e)
            }
          }
        }
        
        if (code) {
          try {
            if (!/\.class\s*$/i.test(code)) code += ".class";
            contentLocation = IOS.newURI(code, cs, contentLocation);
          } catch (e) {}
        }
      } catch (e) {}
    }

    try {
      LoadChecker.add(wrappedLocation);
      
      let perm,
        placeholder = false,
        scriptInclusion = false;
      switch(contentType) {
        case CP_TYPE_SCRIPT:
          scriptInclusion = (ctx instanceof Ci.nsIDOMHTMLScriptElement) && !!ctx.src;
        case CP_TYPE_XBL:
        case CP_TYPE_XMLHTTPREQUEST:
          perm = "js";
          win = win || (ctx.ownerDocument ? ctx.ownerDocument.defaultView : ctx.defaultView);
          break;
        case CP_TYPE_OBJECT:
          placeholder = true;
          perm = this._javaRx.test(mimeGuess) ? "java"
            : this._silverlightRx.test(mimeGuess) ? "silverlight"
            : this._flashRx.test(mimeGuess) ? "flash"
            : "plugin";
            win = ctx.contentDocument ? ctx.contentDocument.defaultView : ctx.ownerDocument.defaultView;
            break;
        case CP_TYPE_MEDIA:
          placeholder = true;
          win = ctx.ownerDocument.defaultView;
          perm = "media";
          break;
        case CP_TYPE_SUBDOCUMENT:
          placeholder = true;
          perm = "frame";
          win = ctx.contentDocument ? ctx.contentDocument.defaultView : ctx.ownerDocument.defaultView;
          break;
        case 14:
          perm = "font";
          win = ctx.defaultView;
          break;
        case CP_TYPE_DOCUMENT:
          win = ctx;
        default:
          return CP_ACCEPT;
      }
      
      let site = Sites.getSite(contentLocation);
      let perms = policy.getPerms(site);
      let sandboxed = Var.get(win, "sandboxed");
      let blocked = sandboxed || !perms[perm];
      
      if (win) {
        if (
          recordSource(site, perm, blocked, win.top) &&
          win._NSA_loaded) {
          try {
            let top = win.top;
            let ev = top.document.createEvent("Events");
            ev.initEvent("NSA:SourcesChanged", true, false);
            top.dispatchEvent(ev);
          } catch (e) {
            log(e);
          }
        }
      } else {
        if (!ctx.fake) log("!!! missing window for " + contentType + ", " + ctx);
      }
      
      if (blocked) {
        if (scriptInclusion)
          ScriptSurrogate.apply(ctx.ownerDocument, contentLocation.spec);
        else if (placeholder) {
          if (Placeholder.isActivated(ctx, contentLocation, mimeGuess)) blocked = false;
          else Placeholder.createLater(mimeGuess, contentLocation, ctx); 
        }
      } else {
        if (scriptInclusion)
          ScriptSurrogate.apply(ctx.ownerDocument, contentLocation.spec, "<");
      }
      
      if (!blocked) return CP_ACCEPT;
      
      accepting = false;

      //log("Blocked " + perm + "@" + contentLocation.spec + " (" + site + ": " + perms.toSource() + " - " + policy.toSource() + ")");
    } catch (e) {
      log ("Error blocking " + contentLocation.spec + ": " + e + " - " + e.stack);
    } finally {
      LoadChecker.remove(wrappedLocation);
      
      if (accepting) {
        if (contentType === CP_TYPE_OBJECT) {
          this._handleClickToPlay(ctx);
        }
        if (isJava || !internalCall) new Load(contentType, wrappedLocation, requestOrigin, ctx, win, mimeGuess);
      }
    }

    return CP_REJECT;
  },
  shouldProcess: function(contentType, contentLocation, requestOrigin, ctx, mimeGuess, internalCall) {
    return this.shouldLoad(contentType, contentLocation, requestOrigin, ctx, mimeGuess, CP_INTERNAL_PROCESSING);
  },
  
  // nsIChannelEventSink
  asyncOnChannelRedirect: function(oldChan, newChan, flags, redirectCallback) {
    let l = Load.retrieve(oldChan);
    //if (l) log("REDIRECT " + oldChan.name + " >>> " + newChan.name + ", " + (l && l.location.spec) + " -- flags: " + flags + ", PT: " + IPC.processType);
    if (l && this.shouldLoad(l.type, newChan.URI, l.origin, l.context, l.mime, true) !== CP_ACCEPT) {
      throw "NoScript blocked " + newChan.name + " redirection from " + oldChan.name + " (origin " + (l.origin && l.origin.spec);
    }
    redirectCallback.onRedirectVerifyCallback(0);
  },
  
  
  // nsIAboutModule
  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },
  
  newChannel: function(aURI) {
    let channel = Services.io.newChannel("resource://noscript_@VERSION@/content/about.html",
                                 null, null);
    channel.originalURI = aURI;
    return channel;
  }
  
}




var NSA = {
  // Returns an object. The 'perms' key is an object mapping a permission (js,
  // plugin, etc.) to an object which maps site names to a boolean (true for
  // allowed). The 'top' key maps to the top-level site (string). Example:
  // {perms: {js: {"http://example.com": true}, top: "http://example.com"}
  getSources: function(win) win._NSA_sources || (win._NSA_sources = { perms: {} }),
  
  rebuildSources: function(win) {
    onWindowSwitch(win, win.location);
    recordScripts(win.document);
    return this.getSources(win);
  },
  
  // returns the permission flags for sites. Example: {"example.com": true}
  getSourcesFor: function(perm, win) {
    let perms = this.getSources(win).perms;
    return perm in perms ? perms[perm] : perms[perm] = {__proto__: null};
  },
  
  startup: function() {
    Service.startup();
  },
  shutdown: function() {
    Service.shutdown();
  }
}



// private functions
function onDOMContentLoaded(ev) {
  recordScripts(ev.currentTarget);
}

const untouchableMask =  /^(?:chrome|resource|view-source|about):/;
function onWindowSwitch(win, suggestedURL) {
  let docShell = DOM.getDocShellForWindow(win);
  let channel = docShell.currentDocumentChannel;
  let doc = docShell.document;
  let url = doc.URL;
  let untouchable = untouchableMask.test(url);
  let site = Sites.getSite(url);
  let sandboxed = (channel instanceof Ci.nsIHttpChannel) && ABE.isSandboxed(channel);
  let perms = sandboxed ? policy.untrusted : policy.getPerms(site);
  let js =  untouchable || perms.js;
  
  docShell.allowJavascript = js;
  Var.set(win, "js", js);
  Var.set(win, "sandboxed", sandboxed);
  
  if (win == win.top) {
    NSA.getSources(win).top = site;
    recordSource(site, "js", !js, win);
  }
  
  if (js) {
    if (IOUtil.extractFromChannel(channel, "noscript.checkWindowName")) {
      XSSFilter.checkWindowName(win);
    }
  } else {
    doc.addEventListener("DOMContentLoaded", onDOMContentLoaded, false);
  }
  
  if (!untouchable)
    PageMod.apply(doc,
      ((docShell instanceof Ci.nsIWebProgress) && docShell.isLoadingDocument)
        ? url
        : "wyciwyg:",
      perms);
}

function recordScripts(doc) {
  let scripts = doc.getElementsByTagName("script");
  let jsSources = NSA.getSourcesFor("js", doc.defaultView.top);
  for (let j = scripts.length; j-- > 0;) {
    let s = scripts[j];
    if ("src" in s) {
      let site = Sites.getSite(s.src);
      if (site && !(site in jsSources)) jsSources[site] = false;
    }
  }
}
function recordSource(site, perm, blocked, win) {
  if (site) {
    let sources = NSA.getSourcesFor(perm, win);
    let can = !blocked;
    if (!((site in sources) && sources[site] === can)) {
      sources[site] = can;
      return true;
    }
  }
  return false;
}



} catch(e) {
  Cu.reportError(e)
}
