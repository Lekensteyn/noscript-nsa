var EXPORTED_SYMBOLS = ["ClearClickUI"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Sites.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/L10n.jsm");

const ClearClickUI = {
  createBuilder: function(data) function(dialog, content, buttons) {
    let self = this, $ = self.$, $x = self.$x;

    $x("description", {
      "_text": _("ClearClick intercepted an interaction with a partially hidden page element. Click the image below to alternate the obstructed and the clear version.")
    }, $x("hbox", {}, content));
    
    let image = $x("image", {
      id: "ClearClick-image",
      src: data.img.realSrc,
      width: data.img.width,
      height: data.img.height,
      "class": "ClearClick-real"
    }, $x("hbox", {id: "ClearClick-images"}, content));
    
    image.maxWidth = data.img.width;

    let rotateListener = function(ev) {
      if (ev.type === "keypress" && ev.which < 10) return; // allow tabulation
      if (/\breal\b/.test(image.className)) {
        image.className = "ClearClick-fake";
        image.src = data.img.fakeSrc;
      } else {
        image.className = "ClearClick-real";
        image.src = data.img.realSrc;
      }
    };
    
    image.addEventListener("click", rotateListener, false);
    image.addEventListener("keypress", rotateListener, false);
    
   
     $x("label", {
      id: "ClearClick-url",
      value: data.url,
      crop: "end",
      "class": "text-link"
    }, content).addEventListener("click", function() {
      self.hide();
      self.win.Browser.addTab(data.url, true);
    }, false);
    
   
    
    /* TODO: per-site unlocking via cj permissions (requires advanced perms editing)
    $x("button", {
      id: "ClearClick-button-allowSite",
      label: _("Allow site")
    }, buttons).addEventListener("click", function() {
      ClearClickUI.allow(data);
      self.hide();
    }, false);
     */
    
    $x("button", {
      id: "ClearClick-button-unlockElement",
      label: _("Unlock")
    }, buttons).addEventListener("click", function() {
      ClearClickUI.unlock(data);
      self.hide();
    }, false);
    
    /* TODO: Reporting
    $x("button", {
      id: "ClearClick-button-report",
      label: _("Report")
    }, buttons).addEventListener("click", function() {
      ClearClickUI.report(data);
      self.hide();
    }, false);
    */
    
    $x("button", {
      id: "ClearClick-button-close",
      label: _("Cancel")
    }, buttons).addEventListener("click", function() {
      self.hide();
    }, false);
  },
  
  allow: function(data) {
    Policy.getInstance().getPerms(Sites.getBaseDomain(Sites.getSite(data.topURL))).cj = true;
    Policy.storePref();
  },
  
  unlock: function(data) {
    try {
      IPC.parentManager.broadcastAsyncMessage(IPC.MSG_CLEARCLICK_UNLOCK,
        JSON.stringify({top: data.topURL, current: data.url}));
    } catch(e) {
      log(e);
    }
  }
}
