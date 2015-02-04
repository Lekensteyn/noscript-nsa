var EXPORTED_SYMBOLS = ["PageMod"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/ScriptSurrogate.jsm");

for each(let name in ["NoScriptPageMods", "ToStaticHTML"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm")

var PageMod = Prefs.sub("pageMod").bind([
  "fixLinks", "toStaticHTML", "NoScriptPageMods",                    
],
{ 
  apply: function(doc, url, perms) {

    var jsBlocked = !perms.js;
    var scripts;
    
    if (jsBlocked) {
      if (this.fixLinks) NoScriptPageMods.fixLinks(doc);
      if (this.removeSMILKeySniffer) NoScriptPageMods.removeSMILKeySniffer(doc);
    } else {
    
      if (this.toStaticHTML && !("toStaticHTML" in doc.defaultView)) {
        scripts = [ToStaticHTML.script];
        ToStaticHTML.patch(doc);
      }
      
      /*
      // TODO: WebGL, Audio API and special interceptions which
      // probably make more sense in a desktop context
        
      if (!perms.webgl) {
        (scripts || (scripts = [])).push(this._webGLInterceptionDef);
        doc.addEventListener("NoScript:WebGL", this._webGLHandler, false, true);
        let sites = this._webGLSites;
        if (site in sites) {
          this._webGLRecord(doc, site);
        }
      }
      
      
      if (this.contentBlocker) {
        if (this.liveConnectInterception && this.forbidJava &&
            !this.isAllowedObject(site, "application/x-java-vm", site, site)) {
          (doc.defaultView.wrappedJSObject || doc.defaultView).disablePlugins = this._disablePlugins;
          (scripts || (scripts = [])).push(this._liveConnectInterceptionDef);
        }
        if (this.audioApiInterception && this.forbidMedia &&
            !this.isAllowedObject(site, "audio/ogg", site, site))
          (scripts || (scripts = [])).push(this._audioApiInterceptionDef);
      }
      
      if (this.forbidFlash && this.flashPatch) 
        (scripts || (scripts = [])).push(this._flashPatch);
      
      if (this.forbidSilverlight && this.silverlightPatch)
        (scripts || (scripts = [])).push(this._silverlightPatch);

      if(this.jsHackRegExp && this.jsHack && this.jsHackRegExp.test(url))
          (scripts || (scripts = [])).push(this.jsHack);
      */
    }
    
    ScriptSurrogate.apply(doc, url, url, jsBlocked, scripts);
  } 
});

this.PageMod = PageMod;
