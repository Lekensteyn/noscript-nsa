var EXPORTED_SYMBOLS = ["Defaults", "Presets"];
const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Policy.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Presets.jsm");

var preset = Presets.map.whitelist;

const Defaults = {
  get policy() {
    const TRUSTED = preset.TRUSTED,
        UNTRUSTED = preset.UNTRUSTED;
    return new Policy({
      UNTRUSTED: UNTRUSTED,
      TRUSTED: TRUSTED,
      DEFAULT: preset.DEFAULT,
      "mozilla.org": TRUSTED,
      "mozilla.com": TRUSTED,
      "mozilla.net": TRUSTED,
      
      "google.com": TRUSTED,
      "gstatic.com": TRUSTED,
      "googleapis.com": TRUSTED,
      
      "yahoo.com": TRUSTED,
      "yimg.com": TRUSTED,
      "yahooapis.com": TRUSTED,
      
      "hotmail.com": TRUSTED, 
      "live.com": TRUSTED,
      "wlxrs.com": TRUSTED,
      
      "securecode.com": TRUSTED,
      "recaptcha.net": TRUSTED,
       
      "noscript.net": TRUSTED,
      "flashgot.net": TRUSTED,
      "informaction.com": TRUSTED,
      
      "youtube.com": TRUSTED,
      "ytimg.com": TRUSTED
    });
  }
};

try {
  (function () {
    const DEF_PREFS = {
      "policy": Defaults.policy.serialize(),
      
      "ABE.allowRulesetRedir": false,
      "ABE.disabledRulesetNames": "",
      "ABE.enabled": true,

      "ABE.notify": true,
      "ABE.reload.confirm": true,
      "ABE.rulesets.SYSTEM": "# Prevent Internet sites from requesting LAN resources.\r\nSite LOCAL\r\nAccept from LOCAL\r\nDeny\r\n",
      "ABE.rulesets.USER": "# User-defined rules. Feel free to experiment here.\r\n",
      "ABE.siteEnabled": false,
      "ABE.skipBrowserRequests": true,
      "ABE.verbose": false,
      
      "DNS.localExtras": "",
      "DNS.wanIp": "",
      
      "clearClick.prompt": true,
      "clearClick.enabled": true,
      
      "pageMod.fixLinks": true,
      "pageMod.toStaticHTML": true,
      
      "surrogate.debug": false,
      "surrogate.enabled": true,
      "surrogate.sandbox": true,
      "surrogate.ab_adscale.replacement": "adscale={}",
      "surrogate.ab_adscale.sources": "js.adscale.de",
      "surrogate.ab_adsense.replacement": "gaGlobal={}",
      "surrogate.ab_adsense.sources": "pagead2.googlesyndication.com",
      "surrogate.ab_adtiger.replacement": "adspirit_pid={}",
      "surrogate.ab_adtiger.sources": "^http://ads\\.adtiger\\.",
      "surrogate.ab_bidvertiser.replacement": "report_error=function(){}",
      "surrogate.ab_bidvertiser.sources": "^http://bdv\\.bidvert",
      "surrogate.ab_binlayer.replacement": "blLayer={}",
      "surrogate.ab_binlayer.sources": "^http://view\\.binlay(?:er)\\.",
      "surrogate.ab_mirago.replacement": "HLSysBannerUrl=''",
      "surrogate.ab_mirago.sources": "^http://intext\\.mirago\\.",
      "surrogate.ab_mirando.replacement": "Mirando={}",
      "surrogate.ab_mirando.sources": "^http://get\\.mirando\\.",
      "surrogate.adriver.replacement": "if(top!==self&&top.location.href===location.href)setTimeout('try{document.close();}catch(e){}',100)",
      "surrogate.adriver.sources": "ad.adriver.ru/cgi-bin/erle.cgi",
      "surrogate.amo.replacement": "addEventListener('click',function(e){if(e.button)return;var a=e.target.parentNode;var hash=a.getAttribute('data-hash');if(hash){var b=a.parentNode.parentNode;InstallTrigger.install({x:{URL:a.href,IconURL:b.getAttribute('data-icon'),Hash:hash,toString:function(){return a.href}}});e.preventDefault()}},false)",
      "surrogate.amo.sources": "!https://addons.mozilla.org/",
      "surrogate.disqus-theme.replacement": "DISQUS.dtpl.actions.register('comments.reply.new.onLoadingStart', function() { DISQUS.dtpl.actions.remove('comments.reply.new.onLoadingStart'); DISQUS.dtpl.actions.remove('comments.reply.new.onLoadingEnd');});",
      "surrogate.disqus-theme.sources": ">.disqus.com/*/build/themes/t_c4ca4238a0b923820dcc509a6f75849b.js*",
      "surrogate.facebook_connect.replacement": "FB=function(){if(typeof Proxy==='undefined'){var f=arguments.callee;return f.__noSuchMethod__=f.Event=f;}var p=Proxy.createFunction({get:function(proxy, name){return name in Object.prototype?Object.prototype[name]:p;}},function(){return p;});return p;}();",
      "surrogate.facebook_connect.sources": "connect.facebook.net/en_US/all.js",
      "surrogate.ga.replacement": "(function(){var _0=function(){return _0;};_0.__noSuchMethod__=_0;with(window)urchinTracker=_0,_gaq={__noSuchMethod__:_0,push:_0,_link:function(h){if(h)location.href=h},_linkByPost:function(){return true},_getLinkerUrl:function(u){return u},_trackEvent:_0},_gat={__noSuchMethod__:function(){return _gaq}}})()",
      "surrogate.ga.sources": "*.google-analytics.com",
      "surrogate.glinks.replacement": "(function(){x(\"focus\");x(\"mouseover\");function x(et){document.addEventListener(et, function(ev) { if (/\\bl\\b/.test(ev.target.className)) ev.target.removeAttribute(\"onmousedown\") }, true)}})()",
      "surrogate.glinks.sources": "@^https?://[^/]+google\\..*/search",
      "surrogate.googleThumbs.replacement": "(function(){var ss=document.getElementsByTagName('script');var s,t,m,id,i;for(var j=ss.length;j-->0;)if(((s=ss[j])&&(t=s.firstChild&&s.firstChild.nodeValue)&&(id=t.match(/\w+thumb\d+/))&&(m=t.match(/['\"](data:[^'\"]+)/)))&&(i=document.getElementById(id)))i.src=m[1].replace(/\\\\(u[0-9a-f]{4}|x[0-9a-f]{2})/ig,function(a,b){return String.fromCharCode(parseInt(b.substring(1), 16))})})()",
      "surrogate.googleThumbs.sources": "!^https?://www\\.google\\.[a-z]+/search",
      "surrogate.imagebam.replacement": "(function(){if(\"over18\" in window){var _do=doOpen;doOpen=function(){};over18();doOpen=_do}else{var e=document.getElementById(Array.slice(document.getElementsByTagName(\"script\")).filter(function(s){return !!s.innerHTML})[0].innerHTML.match(/over18[\\s\\S]*?'([^']+)/)[1]);e.style.display='none'}})()",
      "surrogate.imagebam.sources": "!@*.imagebam.com",
      "surrogate.imagehaven.replacement": "['agreeCont','TransparentBlack'].forEach(function(id){var o=document.getElementById(id);if(o)o.style.display='none'})",
      "surrogate.imagehaven.sources": "!@*.imagehaven.net",
      "surrogate.imdb.replacement": "addEventListener('DOMContentLoaded',function(ev){ad_utils.render_ad=function(w){w.location=w.location.href.replace(/.*\\bTRAILER=([^&]+).*/,'$1')}},true)",
      "surrogate.imdb.sources": "@*.imdb.com/video/*",
      "surrogate.interstitialBox.replacement": "__defineSetter__('interstitialBox',function(){});__defineGetter__('interstitialBox',function(){return{}})",
      "surrogate.interstitialBox.sources": "@*.imagevenue.com",
      "surrogate.nscookie.replacement": "document.cookie='noscript=; domain=.facebook.com; path=/; expires=Thu, 01-Jan-1970 00:00:01 GMT;'",
      "surrogate.nscookie.sources": "@*.facebook.com",
      "surrogate.plusone.replacement": "gapi=function(){if(typeof Proxy==='undefined'){var f=arguments.callee;return f.__noSuchMethod__=f.plusone=f;}var p=Proxy.createFunction({get:function(proxy, name){return name in Object.prototype?Object.prototype[name]:p;}},function(){return p;});return p;}();",
      "surrogate.plusone.sources": "apis.google.com/js/plusone.js",
      "surrogate.popunder.exceptions": ".meebo.com",
      "surrogate.popunder.replacement": "(function(){var cookie=document.__proto__.__lookupGetter__('cookie');document.__proto__.__defineGetter__('cookie',function() {var c='; popunder=yes; popundr=yes; setover18=1';return (cookie.apply(this).replace(c,'')+c).replace(/^; /, '')});var fid='_FID_'+(Date.now().toString(16));var open=window.__proto__.open;window.__proto__.open=function(url,target,features){try{if(!(/^_(?:top|parent|self)$/i.test(target)||target in frames)){var suspSrc,suspCall,fr,ff=[],ss=new Error().split('\\n').length;for(var f,ev,aa=arguments;stackSize-->2&&aa.callee&&(f=aa.callee.caller)&&ff.indexOf(f)<0;ff.push(f)){aa=f.arguments;if(!aa)break;ev=aa[0];suspCall=f.name=='doPopUnder';if(!suspSrc)suspSrc=suspCall||/(?:\bpopunde?r|\bfocus\b.*\bblur|\bblur\b.*\bfocus|[pP]uShown)\b/.test(f.toSource());if(suspCall||ev&&typeof ev=='object'&&('type' in ev)&&ev.type=='click'&&ev.button===0&&(ev.currentTarget===document||('tagName' in ev.currentTarget)&&'body'==ev.currentTarget.tagName.toLowerCase())&&!(('href' in ev.target)&&ev.target.href&&(ev.target.href.indexOf(url)===0||url.indexOf(ev.target.href)===0))){if(suspSrc){fr=document.getElementById(fid)||document.body.appendChild(document.createElement('iframe'));fr.id=fid;fr.src='data:text/html,';fr.style.display='none';var w=fr.contentWindow;w.blur=function(){};return w;}}}}}catch(e){}return open.apply(null, arguments)}})()",
      "surrogate.popunder.sources": "@^http:\\/\\/[\\w\\-\\.]+\.[a-z]+ wyciwyg:",
      "surrogate.qs.replacement": "window.quantserve=function(){}",
      "surrogate.qs.sources": "edge.quantserve.com",
      "surrogate.revsci.replacement": "rsinetsegs=[];DM_addEncToLoc=DM_tag=function(){};",
      "surrogate.revsci.sources": "js.revsci.net",
      "surrogate.twitter.replacement": "twttr=function(){if(typeof Proxy==='undefined'){var f=arguments.callee;return f.__noSuchMethod__=f.events=f.anywhere=f};var p=Proxy.createFunction({get:function(proxy, name){return name in Object.prototype?Object.prototype[name]:p;}},function(){return p;});return p;}();",
      "surrogate.twitter.sources": "platform.twitter.com",
      "surrogate.yieldman.replacement": "rmAddKey=rmAddCustomKey=rmShowAd=rmShowPop=rmShowInterstitial=rmGetQueryParameters=rmGetSize=rmGetWindowUrl=rmGetPubRedirect=rmGetClickUrl=rmReplace=rmTrim=rmUrlEncode=rmCanShowPop=rmCookieExists=rmWritePopFrequencyCookie=rmWritePopExpirationCookie=flashIntalledCookieExists=writeFlashInstalledCookie=flashDetection=rmGetCookie=function(){}",
      "surrogate.yieldman.sources": "*.yieldmanager.com",

      "wanIp.enabled": true,
      "wanIp.checkURL": "https://secure.informaction.com/ipecho/",
      
      "xssFilter.enabled": true,
      "xssFilter.notify": true,
      "xssFilter.reload.confirm": true,
      
      "sync.enabled": false

    };
    
    let branch = prefSvc.getDefaultBranch(PREF_BRANCH);
    let prefs = new PrefsHelper(branch);
    for (let [key, val] in Iterator(DEF_PREFS)) prefs.set(key, val);
  })();
} catch (e) {
  Cu.reportError(e);
}
