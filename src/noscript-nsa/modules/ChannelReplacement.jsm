var EXPORTED_SYMBOLS = ["ChannelReplacement"];

const {interfaces: Ci, classes: Cc, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IOUtil.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

const NS_ERROR_REDIRECT_LOOP = 0x804b001f;

const IOS = IOUtil.ioService;
const LOADING_CHANNEL = "__ChannelReplacementLoadingChannel__";

function CtxCapturingListener(tracingChannel, captureObserver) {
  this.originalListener = tracingChannel.setNewListener(this);
  this.captureObserver = captureObserver;
}
CtxCapturingListener.prototype = {
  originalListener: null,
  originalCtx: null,
  onStartRequest: function(request, ctx) {
    this.originalCtx = ctx;
    if (this.captureObserver) {
      this.captureObserver.observeCapture(request, this);
    }
  },
  onDataAvailable: function(request, ctx, inputStream, offset, count) {},
  onStopRequest: function(request, ctx, statusCode) {},
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener])
}

function ChannelReplacement(chan, newURI, newMethod) {
  return this._init(chan, newURI, newMethod);
}

ChannelReplacement.setLoadingChannel = function(channel, window) {
  if (!window) window = IOUtil.findWindow(channel);
  if (window) try {
    window[LOADING_CHANNEL] = channel;
  } catch (e) {}
}
ChannelReplacement.getLoadingChannel =
  function(window) window && (LOADING_CHANNEL in window) && window[LOADING_CHANNEL];

ChannelReplacement.runWhenPending = function(channel, callback) {
  if (channel.isPending()) {
    callback();
    return false;
  } else {
    new LoadGroupWrapper(channel, callback);
    return true;
  }
};


ChannelReplacement.prototype = {
  listener: null,
  context: null,
  oldChannel: null,
  channel: null,
  window: null,
  suspended: false,
  
  get categoryManager() {
    delete this.categoryManager;
    return this.categoryManager = Cc['@mozilla.org/categorymanager;1'
        ].getService(Ci.nsICategoryManager);
  },
  
  get _unsupportedError() {
    return new Error("Can't replace channels without nsITraceableChannel!");
  },
  
  get _classifierClass() {
    delete this.__proto__._classifierClass;
    return this.__proto__._classifierClass = Cc["@mozilla.org/channelclassifier"];
  },
  
  _autoHeadersRx: /^(?:Host|Cookie|Authorization)$|Cache|^If-/,
  visitHeader: function(key, val) {
    try {
      // we skip authorization and cache-related fields which should be automatically set
      if (!this._autoHeadersRx.test(key)) this.channel.setRequestHeader(key, val, false);
    } catch (e) {
      dump(e + "\n");
    }
  },
  
  _init: function(chan, newURI, newMethod) {
    if (!(chan instanceof Ci.nsITraceableChannel))
      throw this._unsupportedError;
  
    newURI = newURI || chan.URI;
    
    var newChan = IOS.newChannelFromURI(newURI);
    
    this.oldChannel = chan;
    this.channel = newChan;
    
    // porting of http://mxr.mozilla.org/mozilla-central/source/netwerk/protocol/http/src/nsHttpChannel.cpp#2750
    
    var loadFlags = chan.loadFlags;
    
    if (chan.URI.schemeIs("https"))
      loadFlags &= ~chan.INHIBIT_PERSISTENT_CACHING;
    
    
    newChan.loadGroup = chan.loadGroup;
    newChan.notificationCallbacks = chan.notificationCallbacks;
    newChan.loadFlags = loadFlags | newChan.LOAD_REPLACE;
    
    if (!(newChan instanceof Ci.nsIHttpChannel))
      return this;
    
    // copy headers
    chan.visitRequestHeaders(this);

    if (!newMethod || newMethod === chan.requestMethod) {
      if (newChan instanceof Ci.nsIUploadChannel && chan instanceof Ci.nsIUploadChannel && chan.uploadStream ) {
        var stream = chan.uploadStream;
        if (stream instanceof Ci.nsISeekableStream) {
          stream.seek(stream.NS_SEEK_SET, 0);
        }
        
        try {
          let ctype = chan.getRequestHeader("Content-type");
          let clen = chan.getRequestHeader("Content-length");
          if (ctype && clen) {
            newChan.setUploadStream(stream, ctype, parseInt(clen, 10));
          }
        } catch(e) {
          newChan.setUploadStream(stream, '', -1);
        }
        
        newChan.requestMethod = chan.requestMethod;
      }
    } else {
      newChan.requestMethod = newMethod;
    }
    
    if (chan.referrer) newChan.referrer = chan.referrer;
    newChan.allowPipelining = chan.allowPipelining;
    newChan.redirectionLimit = chan.redirectionLimit - 1;
    if (chan instanceof Ci.nsIHttpChannelInternal && newChan instanceof Ci.nsIHttpChannelInternal) {
      if (chan.URI == chan.documentURI) {
        newChan.documentURI = newURI;
      } else {
        newChan.documentURI = chan.documentURI;
      }
    }
    
    if (chan instanceof Ci.nsIEncodedChannel && newChan instanceof Ci.nsIEncodedChannel) {
      newChan.applyConversion = chan.applyConversion;
    }
    
    // we can't transfer resume information because we can't access mStartPos and mEntityID :(
    // http://mxr.mozilla.org/mozilla-central/source/netwerk/protocol/http/src/nsHttpChannel.cpp#2826
    
    if ("nsIApplicationCacheChannel" in Ci &&
      chan instanceof Ci.nsIApplicationCacheChannel && newChan instanceof Ci.nsIApplicationCacheChannel) {
      newChan.applicationCache = chan.applicationCache;
      newChan.inheritApplicationCache = chan.inheritApplicationCache;
    }
    
    if (chan instanceof Ci.nsIPropertyBag && newChan instanceof Ci.nsIWritablePropertyBag) 
      for (var properties = chan.enumerator, p; properties.hasMoreElements();)
        if ((p = properties.getNext()) instanceof Ci.nsIProperty)
          newChan.setProperty(p.name, p.value);

    if (chan.loadFlags & chan.LOAD_DOCUMENT_URI) {
      let win = this.window = IOUtil.findWindow(chan);
    }
    
    return this;
  },
  
  _onChannelRedirect: function() {
    var oldChan = this.oldChannel;
    var newChan = this.channel;
    
    if (this.realRedirect) {
      if (oldChan.redirectionLimit === 0) {
        oldChan.cancel(NS_ERROR_REDIRECT_LOOP);
        throw NS_ERROR_REDIRECT_LOOP;
      }
    } else newChan.redirectionLimit += 1;
    
    
    
    // nsHttpHandler::OnChannelRedirect()

    const CES = Ci.nsIChannelEventSink;
    const flags = CES.REDIRECT_INTERNAL;
    this._callSink(
      Cc["@mozilla.org/netwerk/global-channel-event-sink;1"].getService(CES),
      oldChan, newChan, flags);
    var sink;
    
    for (let cess = this.categoryManager.enumerateCategory("net-channel-event-sinks");
          cess.hasMoreElements();
        ) {
      sink = cess.getNext();
      if (sink instanceof CES)
        this._callSink(sink, oldChan, newChan, flags);
    }
    sink = IOUtil.queryNotificationCallbacks(oldChan, CES);
    if (sink) this._callSink(sink, oldChan, newChan, flags);
    
    // ----------------------------------
    
    newChan.originalURI = oldChan.originalURI;
    
    sink = IOUtil.queryNotificationCallbacks(oldChan, Ci.nsIHttpEventSink);
    if (sink) sink.onRedirect(oldChan, newChan);
  },
  
  _callSink: function(sink, oldChan, newChan, flags) {
    try {
      sink instanceof Ci.nsISupports;
      sink.asyncOnChannelRedirect(oldChan, newChan, flags, this._redirectCallback);
    } catch(e) {
      if (e.toString().indexOf("(NS_ERROR_DOM_BAD_URI)") !== -1 && oldChan.URI.spec !== newChan.URI.spec) {
        let oldURL = oldChan.URI.spec;
        try {
          oldChan.URI.spec = newChan.URI.spec;
          this._callSink(sink, oldChan, newChan, flags);
        } catch(e1) {
          throw e;
        } finally {
          oldChan.URI.spec = oldURL;
        }
      } else if (e.message.indexOf("(NS_ERROR_NOT_AVAILABLE)") === -1) throw e;
    }
  },
  
  _redirectCallback: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAsyncVerifyRedirectCallback]),
    onRedirectVerifyCallback: function(result) {}
  }
  ,
  
  replace: function(realRedirect, callback) {
    let self = this;
    let oldChan = this.oldChannel;
    this.realRedirect = !!realRedirect;
    if (typeof(callback) !== "function") {
      callback = this._defaultCallback;
    }
    ChannelReplacement.runWhenPending(oldChan, function() {
      if (oldChan.status) return; // channel's doom had been already defined
     
      let ccl = new CtxCapturingListener(oldChan, self);
      self.loadGroup = oldChan.loadGroup;
     
      oldChan.loadGroup = null; // prevents the wheel from stopping spinning
      
    
      if (false && (oldChan.loadFlags & oldChan.LOAD_INITIAL_DOCUMENT_URI) && self._redirectCallback) {
        // this calls asyncAbort, which calls onStartRequest on our listener
        // doesn't work on Gecko < 2 and may break image loads
        oldChan.cancel(Cr.NS_BINDING_REDIRECTED); 
        self.suspend(); // believe it or not, this will defer asyncAbort() notifications until resume()
        callback(self);
      } else {
        // legacy (Gecko < 2) and any non-doc load
        self.observeCapture = function(req, ccl) {
          self.open = function() { self._redirect(ccl) }
          callback(self);
        }
        oldChan.cancel(Cr.NS_BINDING_REDIRECTED); 
      }
      

    });
  },
  
  observeCapture: function(req, ccl) {
    this._redirect(ccl);
  },
  
  _defaultCallback: function(replacement) {
    replacement.open();
  },

  open: function() {
    this.resume(); // this triggers asyncAbort and the listeners in cascade
  },
  _redirect: function(ccl) {
    let oldChan = this.oldChannel,
      newChan = this.channel,
      overlap;

    if (!(this.window &&
          (overlap = ChannelReplacement.getLoadingChannel(this.window)) && overlap !== oldChan)) {
      try {
        oldChan.loadGroup = this.loadGroup;
    
        this._onChannelRedirect();
        newChan.asyncOpen(ccl.originalListener, ccl.originalCtx);
        
        if (this.window && this.window != IOUtil.findWindow(newChan)) { 
          // late diverted load, unwanted artifact, abort
          IOUtil.abort(newChan);
        } else {
          // safe browsing hook
          if (this._classifierClass)
            this._classifierClass.createInstance(Ci.nsIChannelClassifier).start(newChan, true);
        }
      } catch (e) {
        log(e);
      }
    }
    
    this.dispose();
  },
  
  suspend: function() {
    if (!this.suspended) try {
      this.oldChannel.suspend();
      this.suspended = true;
    } catch (e) {
      // this fails on E10s children ("unimplemented")
    }
  },
  resume: function() {
    if (this.suspended) {
      this.suspended = false;
      try {
        this.oldChannel.resume();
      } catch (e) {}
    }
  },
  
  dispose: function() {
    this.resume();
    if (this.loadGroup) {
      try {
        this.loadGroup.removeRequest(this.oldChannel, null, Cr.NS_BINDING_REDIRECTED);
      } catch (e) {}
      this.loadGroup = null;
    }

  }
};

function LoadGroupWrapper(channel, callback) {
  this._channel = channel;
  this._inner = channel.loadGroup;
  this._callback = callback;
  channel.loadGroup = this;
}
LoadGroupWrapper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsILoadGroup]),
  
  get activeCount() {
    return this._inner ? this._inner.activeCount : 0;
  },
  set defaultLoadRequest(v) {
    return this._inner ? this._inner.defaultLoadRequest = v : v;
  },
  get defaultLoadRequest() {
    return this._inner ? this._inner.defaultLoadRequest : null;
  },
  set groupObserver(v) {
    return this._inner ? this._inner.groupObserver = v : v;
  },
  get groupObserver() {
    return this._inner ? this._inner.groupObserver : null;
  },
  set notificationCallbacks(v) {
    return this._inner ? this._inner.notificationCallbacks = v : v;
  },
  get notificationCallbacks() {
    return this._inner ? this._inner.notificationCallbacks : null;
  },
  get requests() {
    return this._inner ? this._inner.requests : this._emptyEnum;
  },
  
  addRequest: function(r, ctx) {
    this.detach();
    if (this._inner) try {
      this._inner.addRequest(r, ctx);
    } catch(e) {
      // addRequest may have not been implemented
    }
    if (r == this._channel) // warning, === may not work because of different QIs
      try {
        this._callback(this._channel, ctx);
      } catch (e) {
        log(e);
      }
  },
  removeRequest: function(r, ctx, status) {
    this.detach();
    if (this._inner) this._inner.removeRequest(r, ctx, status);
  },
  
  detach: function() {
    if (this._channel.loadGroup) this._channel.loadGroup = this._inner;
  },
  _emptyEnum: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator]),
    getNext: function() null,
    hasMoreElements: function() false
  }
};
