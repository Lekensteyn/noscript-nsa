var EXPORTED_SYMBOLS = ["WAN"];
const {interfaces: Ci, classes: Cc, utils: Cu, results: Cr} = Components;
try {
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/AddressMatcher.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Thread.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IOUtil.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DNS.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

const IOS = Services.io;
const OS = Services.obs;

var WAN = {
  IP_CHANGE_TOPIC: "abe:wan-iface-ip-changed",
  ip: null,
  _ipMatcher: null,
  set ipMatcher(m) {
    if (this._ipMatcher !== m) {
      Prefs.set("DNS.wanIp", m && m.source || '');
      this._ipMatcher = m;
    }
    return m;
  },
  get ipMatcher() {
    return this._ipMatcher;
  },
  fingerprint: '',
  findMaxInterval: 86400000, // 1 day 
  checkInterval: 14400000, // 4 hours
  fingerInterval: 900000, // 1/4 hour
  checkURL: "https://secure.informaction.com/ipecho/",
  lastFound: 0,
  lastCheck: 0,
  skipIfProxied: true,
  noResource: false,
  logging: true,
  fingerprintLogging: false,
  fingerprintUA: "Mozilla/5.0 (ABE, http://noscript.net/abe/wan)",
  fingerprintHeader: "X-ABE-Fingerprint",
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  
  log: function(msg) {
    Services.console.logStringMessage("[ABE WAN] " + msg);
  },
  
  dispose: function() {
    this.observe = function() {};
    WAN.enabled = false;
    WAN = null;
  },
  
  _enabled: false,
  _timer: null,
  _observing: false,
  get enabled() {
    return this._enabled;
  },
  set enabled(b) {
    if (this._timer) this._timer.cancel();
    if (b) {
      const t = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      t.initWithCallback({
        notify: function() { WAN._periodic() },
        context: null
      }, this.checkInterval, t.TYPE_REPEATING_SLACK);
      this._timer = t;
      Thread.delay(this._periodic, 1000, this, [this._enabled != b]);
      if (!this._observing) {
        this._observing = true;
        OS.addObserver(this, "network:offline-status-changed", true);
        OS.addObserver(this, "wake_notification", true);
      }
    } else {
      this._timer = this.ip = this.ipMatcher = null;
    }
    return this._enabled = b;
  },
  _observingHTTP: false,
  
  observe: function(subject, topic, data) {
    if (!this.enabled) return;
    
    switch(topic) {
      case "wake_notification":
        if (!this._observingHTTP) OS.addObserver(this, "http-on-examine-response", true);
        return;
      case "http-on-examine-response":
        OS.removeObserver(this, "http-on-examine-response");
        this._observingHTTP = false;
        break;
      case "network:offline-status-changed":
        if (data === "online")
          break;
      default:
        return;
    }

    this._periodic(true);
  },
  
  _periodic: function(forceFind) {
    if (forceFind) this.lastFound = 0;
    
    var t = Date.now();
    if (forceFind ||
        t - this.lastFound > this.findMaxInterval ||
        t - this.lastCheck > this.checkInterval) {  
      this.findIP(this._findCallback);
    } else if (this.fingerprint) {
      this._takeFingerprint(this.ip, this._fingerprintCallback);
    }
    this.lastCheck = t;
  },
  
  _findCallback: function(ip) {
    WAN._takeFingerprint(ip);
  },
  _fingerprintCallback: function(fingerprint, ip) {
    if (fingerprint != WAN.fingerprint) {
      WAN.log("Resource reacheable on WAN IP " + ip + " changed!");
      if (ip == WAN.ip) WAN._periodic(true);
    }
  },
  
  _takeFingerprint: function(ip, callback) {
    if (!ip) {
      this.log("Can't fingerprint a null IP");
      return;
    }
    var url = "http://" + (ip.indexOf(':') > -1 ? "[" + ip + "]" : ip);
    var xhr = this._createAnonXHR(url);
    var ch = xhr.channel;
    ch.setRequestHeader("User-Agent", this.fingerprintUA, false);
    ch.loadFlags = ch.loadFlags & ~ch.LOAD_ANONYMOUS; // prevents redirect loops on some routers
    var self = this;
    xhr.addEventListener("readystatechange", function() {

      if (xhr.readyState == 4) {

      var fingerprint = '';
      try {
        const ch = xhr.channel;

        if (!ch.status) fingerprint =
          xhr.status + " " + xhr.statusText + "\n" +
          (xhr.getAllResponseHeaders() + "\n" + xhr.responseText)
            .replace(/\d/g, '').replace(/\b[a-f]+\b/gi, ''); // remove decimal and hex noise
        } catch(e) {
          self.log(e);
        }   

        if (self.fingerprintLogging)
          self.log("Fingerprint for " + url + " = " + fingerprint);
        
        if (fingerprint && /^\s*Off\s*/i.test(xhr.getResponseHeader(self.fingerprintHeader)))
          fingerprint = '';
        
        if (callback) callback(fingerprint, ip);
        self.fingerprint = fingerprint;
      }
    }, false);
    xhr.send(null);

  },
    
  _createAnonXHR: function(url, noproxy) {
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    xhr.mozBackgroundRequest = true;
    xhr.open("GET", url, true);
    const ch = xhr.channel;
    const proxyInfo = noproxy && IOUtil.getProxyInfo(ch);
    if (!proxyInfo || proxyInfo.type == "direct" || proxyInfo.host && DNS.isLocalHost(proxyInfo.host)) {
      if ((ch instanceof Ci.nsIHttpChannel)) {
        // cleanup headers
        this._requestHeaders(ch).forEach(function(h) {
          if (h != 'Host') ch.setRequestHeader(h, '', false); // clear header
        });
      }
      ch.loadFlags = ch.LOAD_BYPASS_CACHE | ch.LOAD_ANONYMOUS;
    } else xhr = null;
    return xhr;
  },
  
  _callbacks: null,
  _finding: false,
  findIP: function(callback) {
    if (callback) (this._callbacks = this._callbacks || []).push(callback);
    if (IOS.offline) {
      this._findIPDone(null, "offline");
      return;
    }
    if (this._finding) return;
    this._finding = true;
    var sent = false;
    try {
      var xhr = this._createAnonXHR(this.checkURL, this.skipIfProxied);
      if (xhr) {
        let self = this;
        xhr.addEventListener("readystatechange", function() {
          if (xhr.readyState == 4) {
            let ip = null;
            if (xhr.status == 200) {
              ip = xhr.responseText.replace(/\s+/g, '');
              if (!/^[\da-f\.:]+$/i.test(ip)) ip = null;
            }
            self._findIPDone(ip, xhr.responseText);
          }
        }, false);
        xhr.send(null);
        this.log("Trying to detect WAN IP...");
        sent = true;
      }
    } catch(e) {
      this.log(e + " - " + e.stack)
    } finally {
      this._finding = sent;
      if (!sent) this._findIPDone(null);
    }
  },
  
  _findIPDone: function(ip) {
    let ipMatcher = AddressMatcher.create(ip);
    if (!ipMatcher) ip = null;
    if (ip) {
      try {
        if (this._callbacks) {
          for each (let cb in this._callbacks) cb(ip);
          this._callbacks = null;
        }
      } catch(e) {
        this.log(e);
      }
      
      if (ip != this.ip) {
        OS.notifyObservers(this, this.IP_CHANGE_TOPIC, ip);
      }
      
      this.ip = ip;
      this.ipMatcher = ipMatcher;
      this.lastFound = Date.now();
      
      this.log("Detected WAN IP " + ip);
    } else {
      this.lastFound = 0;
      this.fingerprint = '';
      this.log("WAN IP not detected!");
    }
   
    this._finding = false;
  },
  
  
  _requestHeaders: function(ch) {
    var hh = [];
    if (ch instanceof Ci.nsIHttpChannel)
      ch.visitRequestHeaders({
        visitHeader: function(name, value) { hh.push(name); }
      });
    return hh;
  }
};

var prefs = Prefs.sub("wanIp");
prefs.bind(["enabled", "checkURL"], WAN);
} catch (e) {
  Cu.reportError(e);
}
