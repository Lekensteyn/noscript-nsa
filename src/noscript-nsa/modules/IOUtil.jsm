var EXPORTED_SYMBOLS = ["IOUtil"];

const {interfaces: Ci, classes: Cc, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

const IOS = Services.io;

const IOUtil = {

  proxiedDNS: 0,

  attachToChannel: function(channel, key, requestInfo) {
    if (channel instanceof Ci.nsIWritablePropertyBag2) 
      channel.setPropertyAsInterface(key, requestInfo);
  },
  extractFromChannel: function(channel, key, preserve) {
    if (channel instanceof Ci.nsIPropertyBag2) {
      let p = channel.get(key);
      if (p) {
        if (!preserve && (channel instanceof Ci.nsIWritablePropertyBag)) channel.deleteProperty(key);
        if (p.wrappedJSObject) return p.wrappedJSObject;
        p instanceof Ci.nsIURL || p instanceof Ci.nsIURL;
        return p;
      }
    }
    return null;
  },

  extractInternalReferrer: function(channel) {
    if (channel instanceof Ci.nsIPropertyBag2) {
      const key = "docshell.internalReferrer";
      if (channel.hasKey(key))
        try {
          return channel.getPropertyAsInterface(key, Ci.nsIURL);
        } catch(e) {}
    }
    return null;
  },
  extractInternalReferrerSpec: function(channel) {
    var ref = this.extractInternalReferrer(channel);
    return ref && ref.spec || null;
  },
  get proxyService() {
    delete this.proxyService;
    return this.proxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"]
        .getService(Ci.nsIProtocolProxyService);
  },
  getProxyInfo: function(channel) {
    if (Ci.nsIProxiedChannel && (channel instanceof Ci.nsIProxiedChannel)) {
      try {
        return channel.proxyInfo
      } catch (e) {
        /* not implemented in child channels */
      }
    }
    return (this.getProxyInfo = this._getProxyInfoChild).call(this, channel);
  },
  _getProxyInfoChild: function(channel) this.proxyService.resolve(channel.URI, 0),
  
  canDoDNS: function(channel) {
    if (!channel || IOS.offline) return false;
    
    var proxyInfo = this.getProxyInfo(channel);
    return !(proxyInfo && (proxyInfo.flags & Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST));
  },
  
  abort: function(channel, noNetwork) {
    channel.cancel(Cr.NS_ERROR_ABORT);
  },
  
  findWindow: function(channel) {
    for each(var cb in [channel.notificationCallbacks,
                       channel.loadGroup && channel.loadGroup.notificationCallbacks]) {
      if (cb instanceof Ci.nsIInterfaceRequestor) {
        if (Ci.nsILoadContext) try {
        // For Gecko 1.9.1
          return cb.getInterface(Ci.nsILoadContext).associatedWindow;
        } catch(e) {}
      }
    }
    return null;
  },
  
  _protocols: {}, // caching them we gain a 33% speed boost in URI creation :)
  newURI: function(url) {
    try {
      let scheme =  url.substring(0, url.indexOf(':'));
      return (this._protocols[scheme] || 
        (this._protocols[scheme] =
          Cc["@mozilla.org/network/protocol;1?name=" + scheme]
          .getService(Ci.nsIProtocolHandler)))
        .newURI(url, null, null);
    } catch(e) {
      return IOS.newURI(url, null, null);
    }
  },
  
  unwrapURL: function(url) {  
    try {
      if (!(url instanceof Ci.nsIURI))
        url = this.newURI(url);
      
      switch (url.scheme) {
        case "view-source":
          return this.unwrapURL(url.path);
        case "wyciwyg":
          return this.unwrapURL(url.path.replace(/^\/\/\d+\//, ""));
        case "jar":
          if (url instanceof Ci.nsIJARURI)
            return this.unwrapURL(url.JARFile);
      }
    }
    catch (e) {}
    
    return url;
  },
  
  
  get _channelFlags() {
    delete this._channelFlags;
    const constRx = /^[A-Z_]+$/;
    const ff = {};
    [Ci.nsIHttpChannel, Ci.nsICachingChannel].forEach(function(c) {
      for (var p in c) {
        if (constRx.test(p)) ff[p] = c[p];
      }
    });
    return this._channelFlags = ff;
  },
  humanFlags: function(loadFlags) {
    var hf = [];
    var c = this._channelFlags;
    for (var p in c) {
      if (loadFlags & c[p]) hf.push(p + "=" + c[p]);
    }
    return hf.join("\n");
  },
  
  queryNotificationCallbacks: function(chan, iid) {
    var cb;
    try {
      cb = chan.notificationCallbacks.getInterface(iid);
      if (cb) return cb;
    } catch(e) {}
    
    try {
      return chan.loadGroup && chan.loadGroup.notificationCallbacks.getInterface(iid);
    } catch(e) {}
    
    return null;
  },
  
 
  anonymizeURI: function(uri, cookie) {
    if (uri instanceof Ci.nsIURL) {
      uri.query = this.anonymizeQS(uri.query, cookie);
    } else return this.anonymizeURL(uri, cookie);
    return uri;
  },
  anonymizeURL: function(url, cookie) {
    var parts = url.split("?");
    if (parts.length < 2) return url;
    parts[1] = this.anonymizeQS(parts[1], cookie);
    return parts.join("?");
  },
  
  _splitName: function(nv) nv.split("=")[0],
  _qsRx: /[&=]/,
  _anonRx: /(?:auth|s\w+(?:id|key)$)/,
  anonymizeQS: function(qs, cookie) {
    if (!qs) return qs;
    if (!this._qsRx.test(qs)) return '';
    
    var cookieNames, hasCookies;
    if ((hasCookies = !!cookie)) cookieNames = cookie.split(/\s*;\s*/).map(this._splitName)
    
    let parms = qs.split("&");
    for (j = parms.length; j-- > 0;) {
      let nv = parms[j].split("=");
      let name = nv[0];
      if (this._anonRx.test(name) || cookie && cookieNames.indexOf(name) > -1)
        parms.splice(j, 1);
    }
    return parms.join("&");
  },

  get TLDService() {
    delete this.TLDService;
    return this.TLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
  },
  
  ioService: IOS
  
};
