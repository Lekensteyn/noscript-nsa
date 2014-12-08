"use strict";
var EXPORTED_SYMBOLS = ["PermissionsUI"];
const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Prompt.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DOM.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/NSA.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Sites.jsm");

var menuId;

function PolicyEditor(window, sources) {
  this.window = window;
  this.sitesList = buildSitesList(sources);
  const {"trusted": TRUSTED, "untrusted": UNTRUSTED, "default": DEFAULT} = Policy.getInstance();
  // The dialog only accepts two states, selected and unselected. Map those to
  // trusted and untrusted respectively.
  this.trustedPerms = [TRUSTED];
  if (DEFAULT.js === TRUSTED.js) {
    this.trustedPerms.push(DEFAULT);
    this.policyTrusted = DEFAULT;
    this.policyUntrusted = UNTRUSTED;
  } else if (DEFAULT.js === UNTRUSTED.js) {
    // try to be smart, assume that default means trusted such that the site
    // name does not have to be saved in the prefs store.
    this.policyTrusted = TRUSTED;
    this.policyUntrusted = DEFAULT;
  } else {
    // this makes no sense, both trusted and untrusted (dis)allow js, but the
    // default permissions set does not. For this condition to be triggered, the
    // user must have fiddled manually with a preset as the default set of
    // presets satisfy one of the above conditions.
    this.policyTrusted = TRUSTED;
    this.policyUntrusted = UNTRUSTED;
  }
}

PolicyEditor.prototype.isTrustedSite = function (siteInfo) {
  return this.trustedPerms.indexOf(siteInfo.perms) != -1;
};

// returns an array of objects suitable for setMultiChoiceItems
PolicyEditor.prototype.getItems = function () {
  return this.sitesList.map(function (siteInfo) {
    return {
      label: siteInfo.site,
      selected: this.isTrustedSite(siteInfo),
    };
  }.bind(this));
};

// sets the trusted sites via an array of indices as returned by getItems
PolicyEditor.prototype.putItems = function (trustedItemsIndices) {
  var policy = Policy.getInstance();
  var map = Object.create(null);
  var length = 0;
  this.sitesList.forEach(function (siteInfo, i) {
    var wasTrusted = this.isTrustedSite(siteInfo);
    var isTrusted = trustedItemsIndices.indexOf(i) != -1;
    if (wasTrusted !== isTrusted) {
      map[siteInfo.site] = isTrusted ? this.policyTrusted : this.policyUntrusted;
      length++;
    }
  }.bind(this));
  log("Modified " + length + "/" + this.sitesList.length + " sites");
  if (length) {
    policy.merge(map);
    Policy.storePref();
    DOM.softReload(this.window);
  }
};

PolicyEditor.prototype.showDialog = function () {
  var editor = this;
  new Prompt({
    title: "NoScript whitelisted sites",
    buttons: [ "OK" ],
  })
  .setMultiChoiceItems(this.getItems())
  .show(function (data) {
    log("PolicyEditor callback, button=" + data.button + " list=" + data.list);
    if (!data.list) {
      log("Cancelled permissions dialog");
      return;
    }
    editor.putItems(data.list);
  });
};

var dialogRequested = false;
// implementor of nsIMessageListenerManager
const listener = {
  receiveMessage: function(msg) {
    switch (msg.name) {
    case IPC.MSG_RECEIVE_SOURCES:
      //log("Received MSG_RECEIVE_SOURCES " + JSON.stringify(msg.data));
      if (dialogRequested) {
        dialogRequested = false;
        if (!msg.data) {
          // no sites found
          break;
        }
        var editor = new PolicyEditor(msg.target.contentWindow, msg.data);
        editor.showDialog();
      }
      break;
    default:
      log("Unknown message: " + JSON.stringify(msg));
      break;
    }
  },
};

function loadIntoWindow(window) {
  //log("PermissionsUI.loadIntoWindow " + window);
  // Available since Firefox 20
  menuId = window.NativeWindow.menu.add({
    name: "NoScript",
    callback: function () {
      // flag that a dialog is requested and try to acquire a list of sites
      dialogRequested = true;
      window.messageManager.broadcastAsyncMessage(IPC.MSG_REQUEST_SOURCES, null);
    },
  });
  IPC.globalManager.addMessageListener(IPC.MSG_RECEIVE_SOURCES, listener);
  // update the sources on the current page
  window.messageManager.broadcastAsyncMessage(IPC.MSG_REQUEST_SOURCES, null);
}
function unloadFromWindow(window) {
  IPC.parentManager.removeMessageListener(IPC.MSG_RECEIVE_SOURCES, listener);
  window.NativeWindow.menu.remove(menuId);
}

// returns a list of sites, objects consisting of the site key name and
// permission state.
function buildSitesList(sources) {
  let perms = sources.perms;
  let all = Object.create(null);
  let map = Object.create(null);
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

var PermissionsUI = {
  loadIntoWindow: loadIntoWindow,
  unloadFromWindow: unloadFromWindow,
};
