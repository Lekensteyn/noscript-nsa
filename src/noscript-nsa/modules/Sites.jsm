var EXPORTED_SYMBOLS = ["Sites"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DNS.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IOUtil.jsm");

const Sites = {
  domainPattern: /^[\w\u0080-\uffff][\w\-\.\u0080-\uffff]*$/,
  domainMatch: function(url) {
     const m = url.match(this.domainPattern);
     return m ? m[0].toLowerCase() : "";
  },
  
  get uriFixup() {
    delete this.uriFixup;
    return this.uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
  },
  ios: Services.io,
  
  getSite: function(url) {
    if (!url) return "";
    if (typeof url === "string") {
      
      if (url.charCodeAt(0) < 33  && // needs trimming
          !(url = url.replace(/^\s*(.*?)\s*$/, '$1'))) {
        return "";
      }
      
      if (url.indexOf(":") == -1) {
        return this.domainMatch(url);
      }
      
      
      try {
        let scheme = this.ios.extractScheme(url).toLowerCase();
        switch (scheme) {
          case "http": case "https": // commonest case first
            break;
          case "javascript": case "data": 
            return "";
          case "about":
            return url.split(/[\?#]/, 1)[0];
          case "chrome":
            return "chrome:";
        }
        scheme += ":";
        if (url == scheme) return url;
      } catch(ex) {
        return this.domainMatch(url);
      }
    } else if (url.scheme.indexOf("http") !== 0) return this.getSite(url.spec);
    
    try {
      let uri = this.uriFixup.createExposableURI( // fix wyciwyg: and zaps userpass
                IOUtil.unwrapURL(url) // unwrap JAR and view-source uris
      ); 
      
      try  {
        return uri.prePath;
      } catch(exNoPrePath) {
        let scheme = uri.scheme;
        let host = uri.spec.substring(scheme.length);
        return /^\/\/[^\/]/.test(host) && (host = this.domainMatch(host.replace(/^\/\/([^\/]+).*/, "$1")))
          ? scheme + "//" + host
          : scheme;
      }
    } catch(ex) {
      return typeof url === "object" ? this.getSite(url.spec) : "";
    }
  },
  
  getDomain: function(site) {
    try {
      return (site instanceof Ci.nsIURL ? site : IOUtil.newURI(site)).host;
    } catch(e) {
      return '';
    }
  },
  
   get TLDService() {
    delete this.TLDService;
    return this.TLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
  },

  getBaseDomain: function(domain) {
    if (!domain) return '';
    if (domain.indexOf('/') > -1) domain = this.getDomain(domain); // it was a full URL
    if (!domain || DNS.isIP(domain)) return domain; // IP
    var pos = domain.lastIndexOf('.');
    if (pos < 1 || (pos = domain.lastIndexOf('.', pos - 1)) < 1) return domain;
    
    try {
      return this.TLDService.getBaseDomainFromHost(domain);
    } catch(e) {}
    return domain;
  },
  
}
