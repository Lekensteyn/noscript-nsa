var EXPORTED_SYMBOLS = ["Options"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/Presets.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

var Options = {
  
  
  populatePresets: function(doc, delayed) {
    let list = doc.getElementById("nsa-presets");
    
    if (!(list.firstChild && list.firstChild.hasAttribute("value"))) {
      let ref = IPC.isAndroidNative && list.firstChild; 
      while(list.firstChild) list.removeChild(list.firstChild);
      for each (p in Presets.list) {
        i = ref  ? ref.cloneNode(false) : doc.createElement("radio");
        i.setAttribute("label", p.label);
        i.setAttribute("value", p.name);
        list.appendChild(i);
      }
      i.disabled = true;
      
      doc.defaultView.setTimeout(function() Options.populatePresets(doc), 100);
      return;
    }
    
    let current = Presets.current;
    let curName = current ? current.name : "custom";
    let b = list.querySelector('[value="' + curName + '"]');
    if (b) b.checked = true;
    list.selectedItem = b;
    this.syncPresetDesc(list);
  },
  
  syncPresetDesc: function(list) {
    let current = Presets.current;
    list.parentNode.setAttribute("desc",
      current.label + " - " + current.description);
  },
  
  resetPrefs: function(doc) {
    Policy.getInstance().reset();
    Prefs.reset();
    this.populatePresets(doc);
  },
  
  applyPreset: function(list) {
    let sel = list.selectedItem || list.querySelector('button[checked="true"]');
    let value = sel && sel.getAttribute("value");
    if (!value) return;
    let p = Presets.map[value];
    if (p && !p.isCurrent) p.apply();
    this.syncPresetDesc(list);
  },
  
  destroy: function() {}
}
