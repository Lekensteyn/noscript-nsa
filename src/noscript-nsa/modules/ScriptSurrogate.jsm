var EXPORTED_SYMBOLS = ["ScriptSurrogate"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/AddressMatcher.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IOUtil.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Thread.jsm");
Cu.import("resource://noscript_@VERSION@/modules/SyntaxChecker.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "FS", "resource://noscript_@VERSION@/modules/FS.jsm");

var ScriptSurrogate = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  
  enabled: true,
  prefs: null,
  sandbox: true,
  syntaxChecker: new SyntaxChecker(),
   
  get mappings() {
    delete this.mappings;
    this._init();
    return this.mappings;
  },
  
  
  _init: function() {
    this.prefs = Prefs.sub("surrogate").branch;
    this._syncPrefs();
   
  },
  
  _observingPrefs: false,
  _syncPrefs: function() {
    const prefs = this.prefs;
    
    for each(let p in ["enabled", "debug", "sandbox"]) this[p] = prefs.getBoolPref(p);
    
    const map = {__proto__: null};
    var key;
    for each(key in prefs.getChildList("", {})) {
      this._parseMapping(prefs, key, map);
    }
    
    const mappings = {forPage: [], noScript: [], inclusion: [], before: [], after: [], all: map};
    
    var mapping;
    for (key in map) {
      mapping = map[key];
      if (!mapping.error) {
        if (mapping.forPage) mappings.forPage.push(mapping);
        if (mapping.noScript) mappings.noScript.push(mapping);
        else if (!mapping.forPage) {
          if (!(mapping.before || mapping.after)) mappings.inclusion.push(mapping);
          else {
            if (mapping.before) mappings.before.push(mapping);
            if (mapping.after) mappings.after.push(mapping);
          }
        }
      }
    }
    
    this.mappings = mappings;
    
    if (!this._observingPrefs) {
      prefs.addObserver("", this, true);
      this._observingPrefs = true;
    }
  },
  
  _parseMapping: function(prefs, key, map) {
    var keyParts = key.split(".");
    var name = keyParts[0];
    var member = keyParts[1];
    if (!(name && member)) return;
    try {
      let value = prefs.getCharPref(key);
      if (!value) return;
      let mapping = (name in map)
        ? map[name]
        : map[name] = new SurrogateMapping(name);
      switch(member) {
        case "sources":
          let prefix = true;
          do {
            switch(value[0]) {
              case '@': mapping.forPage = true; break;
              case '!': mapping.noScript = true; break;
              case '<': mapping.before = true; break;
              case '>': mapping.after = true; break;
              case ' ': break;
              default:
                prefix = false;
            }
            if (prefix) value = value.substring(1);
          } while(prefix);
          
        case "exceptions":
          value = new AddressMatcher(value);
          break;
        
        // case "replacement": // deferred, see SurrogateMapping.replacement
        
        default:
          return;
      }
      
      mapping[member] = value; 
    } catch (e) {
      Cu.reportError(e);
    }
  },
  
  observe: function(prefs, topic, key) {
    this.prefs.removeObserver("", this, true);
    this._observingPrefs = false;
    Thread.asap(this._syncPrefs, this);
  },
  
  initReplacement: function(m) {
    var r;
    try {
      r = this.prefs.getCharPref(m.name + ".replacement");
      
      if (/^(?:file:\/\/|\.\.?\/)/.test(r)) {
        r = IO.readFile(IOS.newURI(this._resolveFile(mapping.replacement), null, null)
              .QueryInterface(Ci.nsIFileURL).file);
      }
      
      if (r && !this.syntaxChecker.check(r)) {
        throw this.syntaxChecker.lastError;
      }
    } catch (e) {
      m.error = e;
      Cu.reportError("Error loading " + m.name + " surrogate: " + e + (r ? "\n" + r : ""));
      r = "";
    }
    return r;
  },
  
  _resolveFile: function(fileURI) {
    const profileURI = IOS.newFileURI(
      Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties)
      .get("ProfD", Ci.nsIFile));
    return (this._resolveFile = function(fileURI) {
      return profileURI.resolve(fileURI);
    })(fileURI);
  },
  
    getScripts: function(scriptURL, pageURL, noScript, scripts) {

    var isPage = scriptURL === pageURL;

    const list = noScript
      ? this.mappings.noScript
      : isPage
        ? this.mappings.forPage
        : pageURL === '<'
          ? this.mappings.before
          : pageURL === '>'
            ? this.mappings.after
            : this.mappings.inclusion;
    
    for (let j = list.length; j-- > 0;) {
      let mapping = list[j];
      if (mapping.sources && mapping.sources.test(scriptURL) &&
          !(mapping.exceptions && mapping.exceptions.test(pageURL)) &&
          mapping.replacement) {
        let code = mapping.replacement;
       
        if (!noScript && mapping.noScript)
          code = 'window.addEventListener("DOMContentLoaded", function(event) {' +
                    code + '}, true)';

        if (!scripts) scripts = [code];
        else scripts.push(code);
      }
    }
    return scripts;
  },
  
  _afterHandler: function(ev) {
    let s = ev.target;
    if (s instanceof Ci.nsIDOMHTMLScriptElement && s.src)
      ScriptSurrogate.apply(s.ownerDocument, s.src, ">", false);
    
  },
  
  apply: function(document, scriptURL, pageURL, noScript, scripts) {
    if (typeof(noScript) !== "boolean") noScript = !!noScript;
    
    if (this.enabled) {
      scripts = this.getScripts(scriptURL, pageURL, noScript, scripts);
      if (!noScript && this.mappings.after.length && !document._noscriptAfterSurrogates) {
        document._noscriptAfterSurrogates = true;
        document.addEventListener("load", this._afterHandler, true);
      }
    }

    if (!scripts) return false;
    
    const runner = noScript
      ? this.fallback
      : scriptURL === pageURL
        ? let (win = document.defaultView) win != win.top ? this.executeSandbox : this.execute
        : this.sandbox ? this.executeSandbox : this.executeDOM;
    
    if (this.debug) {
      // we run each script separately and don't swallow exceptions
      scripts.forEach(function(s) {
       runner.call(this, document, "{" + s + "}");
      }, this);
    } else {
      runner.call(this, document,
        "try{" +
          scripts.join("}catch(e){}\ntry{") +
          "}catch(e){}");
    }
    return true;
  },
  

  
  fallback: function(document, scriptBlock) {
    document.addEventListener("DOMContentLoaded", function(ev) {
      ScriptSurrogate.executeSandbox(ev.currentTarget, scriptBlock);
    }, false);
  },
  
  execute: function(document, scriptBlock) {
    this.executeDOM(document, scriptBlock);
  },
  
  executeSandbox: function(document, scriptBlock, env) {
    var w = document.defaultView;
    try {
      if (typeof w.wrappedJSObject === "object") w = w.wrappedJSObject;
      var s = new Cu.Sandbox(w, { wantXrays: false });
      s.window = w;
      s.script = scriptBlock;
      if (env) s.env = env;
      Cu.evalInSandbox("window.eval(script)", s);
    } catch (e) {
      if (ns.consoleDump) {
        ns.dump(e);
        ns.dump(scriptBlock);
      }
      if (this.debug) Cu.reportError(e);
    }
  },
  
  executeDOM: function(document, scriptBlock) {
    var de = document.documentElement;
    try {
      if (!de) {
        this.executeSandbox(document, scriptBlock);
        return;
      }
      
      var se = document.createElement("script");
      se.appendChild(document.createTextNode(scriptBlock));
      de.appendChild(se);
      de.removeChild(se);
    } catch (e) {
      if (this.debug) Cu.reportError(e);
    }
  }
}


function SurrogateMapping(name) {
  this.name = name;
  this.__defineGetter__("replacement", this._replacement);
}
SurrogateMapping.prototype = {
  sources: null,
  _replacement: function() {
    delete this.replacement; 
    return this.replacement = ScriptSurrogate.initReplacement(this);
  },
  exceptions: null,
  error: null,
  
  forPage: false,
  noScript: false,
  before: false,
  after: false
};
