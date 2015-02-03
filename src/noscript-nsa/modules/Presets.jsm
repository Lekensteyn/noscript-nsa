var EXPORTED_SYMBOLS = ["Presets"];
const {utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");

// A preset determines what permissions (JS, plugins, etc.) are granted given
// the trust level of a site (trusted, untrusted, default (not marked)). In the
// "blacklist" preset, default means the same as trusted. In the "whitelist"
// preset on the other hand, it means "untrusted" (see below).
var Presets = {
  get map() map,
  get list() list,
  // returns the active Preset instance or null if it is completely different
  get current() {
    let p = Policy.getInstance().map;
    let reference = [p.TRUSTED, p.UNTRUSTED, p.DEFAULT].toSource();
    for each(let i in this.list) {
      if (reference === (i._source || (i._source = [i.TRUSTED, i.UNTRUSTED, i.DEFAULT].toSource())))
        return i;
    }
    // unknown preset
    return null;
  }
}

var map = { __proto__: null }, list = [];

function Preset(name, TRUSTED, UNTRUSTED, DEFAULT) {
  this.name = name;
  this.TRUSTED = TRUSTED;
  this.UNTRUSTED = UNTRUSTED;
  this.DEFAULT = DEFAULT;
  list.push(this);
  map[name] = this;
}

Preset.prototype = {
  get isCurrent() this === Presets.current,
  get label() _("preset." + this.name),
  get description() _("preset." + this.name + ".desc"),
  apply: function() {
    Policy.getInstance().applyPreset(this);
  },
  toString: function() {
    return this.name + ", " + this.label + " - " + this.description;
  }
}

const ALLOW = {js: true, webgl: true, java: true, flash: true, silverlight: true, plugin: true, media: true, frame: true, font: true};
const DENY = {};
const NO_PLAY = {js: true, frame: true, font: true};
const NO_ACTIVE = { frame: true }

new Preset("blacklist", ALLOW, DENY, ALLOW);
new Preset("click2play", NO_PLAY, DENY, NO_PLAY);
new Preset("whitelist", ALLOW, DENY, NO_ACTIVE);
new Preset("full", NO_PLAY, DENY, NO_ACTIVE);
new Preset("custom", null, null, null);




// TODO: replace with true localization

function _(m) {
  let [prefix, key, suffix] = m.split('.');
  return l[key][suffix ? 1 : 0];
}

var l = {
  blacklist: ["Easy Blacklist", "You pick untrusted sites where JavaScript and plugins must be blocked."],
  click2play: ["Click To Play", "Plugins are blocked until you click."],
  whitelist: ["Classic Whitelist", "You pick trusted sites where JavaScript and plugins can run."],
  full: ["Full Protection", 'like "Classic Whitelist", but all the embedded content is blocked until you click, even on trusted sites.'],
  custom: ["Custom", "Customized permissions"]
};
