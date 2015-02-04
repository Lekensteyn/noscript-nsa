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
      "ABE.notify.namedLoopback": false,
      "ABE.reload.confirm": true,
      "ABE.rulesets.SYSTEM": "# Prevent Internet sites from requesting LAN resources.\r\nSite LOCAL\r\nAccept from LOCAL\r\nDeny\r\n",
      "ABE.rulesets.USER": "# User-defined rules. Feel free to experiment here.\r\n",
      "ABE.siteEnabled": false,
      "ABE.skipBrowserRequests": true,
      "ABE.verbose": false,

      "ABE.wanIpAsLocal": true,
      "ABE.wanIpCheckURL": "https://secure.informaction.com/ipecho/",
      "ABE.localExtras": "",
      
      "DNS.localExtras": "",
      "DNS.wanIp": "",
      
      "clearClick.prompt": true,
      "clearClick.enabled": true,
      
      "doNotTrack.enabled": true,
      "doNotTrack.exceptions": "",
      "doNotTrack.forced": "",

      "pageMod.fixLinks": true,
      "pageMod.toStaticHTML": true,
      
      "surrogate.debug": false,
      "surrogate.enabled": true,
      "surrogate.sandbox": true,
      "surrogate.360Haven.replacement": "Object.defineProperty(window,'adblock',{get:function() false,set: function() false});Object.defineProperty(window,'google_ad_client',{get: function () { return {__noSuchMethod__: function() this}}});Object.defineProperty(window.HTMLBodyElement.prototype,'innerHTML',{get:function() ''});",
      "surrogate.360Haven.sources": "@www.360haven.com",
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
      "surrogate.adagionet.replacement": "adagioWriteTag=adagioWriteBanner=function(){}",
      "surrogate.adagionet.sources": ".adagionet.com",
      "surrogate.addthis.replacement": "addthis=(function(){var f=arguments.callee;return f.__noSuchMethod__=f.data=f.bar=f.dynamic=f.login=f.ad=f.util=f.user=f.session=f})();",
      "surrogate.addthis.sources": "s7.addthis.com/*addthis_widget.js",
      "surrogate.adfly.replacement": "for(var a=/ysmm = \'(.*?)\';/gi.exec(document.documentElement.innerHTML)[1],b='',c='',d=0;d<a.length;d++)0==d%2?b+=a.charAt(d):c=a.charAt(d)+c;window.location=atob(b+c).substring(2)",
      "surrogate.adfly.sources": "!@^https?://adf.ly/\\w+/?$",
      "surrogate.adriver.replacement": "if(top!==self&&top.location.href===location.href)setTimeout('try{document.close();}catch(e){}',100)",
      "surrogate.adriver.sources": "ad.adriver.ru/cgi-bin/erle.cgi",
      "surrogate.amo.replacement": "addEventListener('click',function(e){if(e.button)return;var a=e.target.parentNode;var hash=a.getAttribute('data-hash');if(hash){var b=a.parentNode.parentNode;InstallTrigger.install({x:{URL:a.href,IconURL:b.getAttribute('data-icon'),Hash:hash,toString:function(){return a.href}}});e.preventDefault()}},false)",
      "surrogate.amo.sources": "!https://addons.mozilla.org/",
      "surrogate.digg.replacement": "window.location.href=document.querySelector('link[rel=canonical]').href",
      "surrogate.digg.sources": "!@digg.com/newsbar/*",
      "surrogate.dimtus.replacement": "document.querySelector('.overlay_ad').style.display='none'",
      "surrogate.dimtus.sources": "!@^http://(?:dimtus|imageteam)\\.(?:com|org)/img-",
      "surrogate.disqus-theme.replacement": "DISQUS.dtpl.actions.register('comments.reply.new.onLoadingStart', function() { DISQUS.dtpl.actions.remove('comments.reply.new.onLoadingStart'); DISQUS.dtpl.actions.remove('comments.reply.new.onLoadingEnd');});",
      "surrogate.disqus-theme.sources": ">.disqus.com/*/build/themes/t_c4ca4238a0b923820dcc509a6f75849b.js*",
      "surrogate.facebook_connect.replacement": "FB=(function(){if(typeof Proxy==='undefined'){var f=arguments.callee;return f.__noSuchMethod__=f.Event=f.XFBML=f;}var p=Proxy.createFunction({get:function(proxy, name){return name in Object.prototype?Object.prototype[name]:p;}},function(){return p;});return p;})();",
      "surrogate.facebook_connect.sources": "connect.facebook.net",
      "surrogate.ga.replacement": "(function(){var _0=function()_0,_u=function(){};_0.__noSuchMethod__=_0;('ga'in window)||(ga=_u);with(window)urchinTracker=_u,_gaq={__noSuchMethod__:_0,push:function(f){if(typeof f=='function')f();else if(f&&f.shift&&f[0]in this)this[f.shift()].apply(this,f)},_link:function(h){if(h)location.href=h},_linkByPost:function(f){if(f&&f.submit)f.submit();return true},_getLinkerUrl:function(u){return u},_trackEvent:_0},_gat={__noSuchMethod__:function(){return _gaq}}})()",
      "surrogate.ga.sources": "*.google-analytics.com",

      "surrogate.glinks.replacement": "(function(){x(\"focus\");x(\"mouseover\");function x(et){document.addEventListener(et, function(ev) { if (/\\bl\\b/.test(ev.target.className)) ev.target.removeAttribute(\"onmousedown\") }, true)}})()",
//      "surrogate.glinks.replacement": "for each(let et in ['focus','mouseover','mousedown','click']) addEventListener(et,function(e){var a=e.target,href=a.href&&a.getAttribute&&a.getAttribute('href');if(href&&/^(?:http|\/url)/.test(href)&&!a._href){a._href=a.href=a.href.replace(/.*\/url.*[?&](?:url|q)=(http[^&]+).*/,function(a,b)decodeURIComponent(b));do{if(/\brwt\(/.test(a.getAttribute('onmousedown')))a.removeAttribute('onmousedown')}while((a=a.parentElement))}},true)",
      "surrogate.glinks.sources": "!@^https?://[^/]+google\\..*/search",
      "surrogate.googletag.replacement": "googletag={__noSuchMethod__:function()this,slots:{},cmd:{__noSuchMethod__:function()this}}",
      "surrogate.googletag.sources": ".googletagservices.com",
      "surrogate.googleThumbs.replacement": "(function(){var ss=document.getElementsByTagName('script');var s,t,m,id,i;for(var j=ss.length;j-->0;)if(((s=ss[j])&&(t=s.firstChild&&s.firstChild.nodeValue)&&(id=t.match(/\w+thumb\d+/))&&(m=t.match(/['\"](data:[^'\"]+)/)))&&(i=document.getElementById(id)))i.src=m[1].replace(/\\\\(u[0-9a-f]{4}|x[0-9a-f]{2})/ig,function(a,b){return String.fromCharCode(parseInt(b.substring(1), 16))})})()",
      "surrogate.googleThumbs.sources": "!^https?://www\\.google\\.[a-z]+/search",
      "surrogate.gravatar.replacement": "with(Gravatar={my_hash:''})profile_cb=init=function(){};",
      "surrogate.gravatar.sources": ".gravatar.com",
      "surrogate.imagebam.replacement": "(function(){if(\"over18\" in window){var _do=doOpen;doOpen=function(){};over18();doOpen=_do}else{var e=document.getElementById(Array.slice(document.getElementsByTagName(\"script\")).filter(function(s){return !!s.innerHTML})[0].innerHTML.match(/over18[\\s\\S]*?'([^']+)/)[1]);e.style.display='none'}})()",
      "surrogate.imagebam.sources": "!@*.imagebam.com",
      "surrogate.imagebunk.replacement": "document.body.insertBefore(document.getElementById('img_obj'), document.body.firstChild)",
      "surrogate.imagebunk.sources": "!http://imagebunk.com/image/*",
      "surrogate.imagehaven.replacement": "['agreeCont','TransparentBlack'].forEach(function(id){var o=document.getElementById(id);if(o)o.style.display='none'})",
      "surrogate.imagehaven.sources": "!@*.imagehaven.net",
      "surrogate.imdb.replacement": "addEventListener('DOMContentLoaded',function(ev){ad_utils.render_ad=function(w){w.location=w.location.href.replace(/.*\\bTRAILER=([^&]+).*/,'$1')}},true)",
      "surrogate.imdb.sources": "@*.imdb.com/video/*",
      "surrogate.imgreserve.replacement": "let b=document.querySelector('input[value=\"YES\"]');if(b)b.addEventListener('click',function(){document.cookie='AgeVerification=1';location.href=location},true)",
      "surrogate.imgreserve.sources": "!imgreserve.com",
      "surrogate.interstitialBox.replacement": "__defineSetter__('interstitialBox',function(){});__defineGetter__('interstitialBox',function(){return{}})",
      "surrogate.interstitialBox.sources": "@*.imagevenue.com",
      "surrogate.invodo.replacement": "Invodo={__noSuchMethod__:function(){}}",
      "surrogate.invodo.sources": ".invodo.com",
      "surrogate.microsoftSupport.replacement": "let c=document.getElementById('contentArea');if(c)c.style.display=''",
      "surrogate.microsoftSupport.sources": "!support.microsoft.com",
      "surrogate.nscookie.replacement": "document.cookie='noscript=; domain=.facebook.com; path=/; expires=Thu, 01-Jan-1970 00:00:01 GMT;'",
      "surrogate.nscookie.sources": "@*.facebook.com",
      "surrogate.personaorg.replacement": "if(typeof navigator.id==='undefined'){navigator.id={__noSuchMethod__:function(){},watch:function(){}}}",
      "surrogate.personaorg.sources": "login.persona.org",
      "surrogate.picbucks.replacement": "for each(let s in document.getElementsByTagName('script')) { let m = s.textContent.match(/(?:Lbjs\\.TargetUrl\\s*=\\s*|Array\\s*\\().*(\\bhttp[^'\"]*)/); if (m) { location.href = m[1]; break; } }",
      "surrogate.picbucks.sources": "!*.picbucks.com  http://www.imagebax.com/show.php/*",
      "surrogate.picsee.replacement": "location.replace(location.href.replace(/(\\/2\\d{3}[^\\/]*)(.*)\\.html/, '/upload$1/$2'));",
      "surrogate.picsee.sources": "!^https?://picsee\\.net/2\\d.*\\.html",
      "surrogate.plusone.replacement": "gapi=(function(){if(typeof Proxy==='undefined'){var f=arguments.callee;return f.__noSuchMethod__=f.plusone=f;}var p=Proxy.createFunction({get:function(proxy, name){return name in Object.prototype?Object.prototype[name]:p;}},function(){return p;});return p;})();",
      "surrogate.plusone.sources": "apis.google.com/js/plusone.js",
      "surrogate.popunder.exceptions": ".meebo.com",
      "surrogate.popunder.replacement": "(function(){var unloading=false;addEventListener('pagehide',function(){unloading=true;setTimeout(function(){unloading=false},100)},true);var cookie=document.__proto__.__lookupGetter__('cookie');document.__proto__.__defineGetter__('cookie',function() {if(unloading)return cookie.apply(this);var c='; popunder=yes; popundr=yes; setover18=1';return(cookie.apply(this).replace(c,'')+c).replace(/^; /, '')});var fid='_FID_'+(Date.now().toString(16));var open=window.__proto__.open;window.__proto__.open=function(url,target,features){try{if(!(/^_(?:top|parent|self)$/i.test(target)||target in frames)){var suspSrc,suspCall,ff=[],ss=new Error().stack.split('\\n').length;if(/popunde?r/i.test(target))return ko();for(var f,ev,aa=arguments;stackSize-->2&&aa.callee&&(f=aa.callee.caller)&&ff.indexOf(f)<0;ff.push(f)){aa=f.arguments;if(!aa)break;ev=aa[0];suspCall=f.name=='doPopUnder';if(!suspSrc)suspSrc=suspCall||/(?:\\bpopunde?r|\\bfocus\\b.*\\bblur|\\bblur\\b.*\\bfocus|[pP]uShown)\\b/.test(f.toSource());if(suspCall||ev&&typeof ev=='object'&&('type' in ev)&&ev.type=='click'&&ev.button===0&&(ev.currentTarget===document||('tagName' in ev.currentTarget)&&'body'==ev.currentTarget.tagName.toLowerCase())&&!(('href' in ev.target)&&ev.target.href&&(ev.target.href.indexOf(url)===0||url.indexOf(ev.target.href)===0))){if(suspSrc)return ko();}}}}catch(e){}return open.apply(null, arguments);function ko(){var fr=document.getElementById(fid)||document.body.appendChild(document.createElement('iframe'));fr.id=fid;fr.src='data:text/html,';fr.style.display='none';var w=fr.contentWindow;w.blur=function(){};return w;}}})()",
      "surrogate.popunder.sources": "@^http:\\/\\/[\\w\\-\\.]+\.[a-z]+ wyciwyg:",
      "surrogate.qs.replacement": "window.quantserve=function(){}",
      "surrogate.qs.sources": "*.quantserve.com",
      "surrogate.revsci.replacement": "rsinetsegs=[];DM_addEncToLoc=DM_tag=function(){};",
      "surrogate.revsci.sources": "js.revsci.net",
      "surrogate.skimlinks.replacement": "window.skimlinks=function(){}",
      "surrogate.skimlinks.sources": ".skimlinks.com/api/",
      "surrogate.twitter.replacement": "twttr=(function(){if(typeof Proxy==='undefined'){var f=arguments.callee; var ro = f.__noSuchMethod__=f.events=f.anywhere=f; ro.widgets={__noSuchMethod__:function(){}}; return ro;}var p=Proxy.createFunction({get:function(proxy, name){return name in Object.prototype?Object.prototype[name]:p;}},function(){return p;});return p;})();",
      "surrogate.twitter.sources": "platform.twitter.com",
      "surrogate.uniblue.replacement": "for each(let l in document.links)if(/^https:\/\/store\./.test(l.href)){l.setAttribute('href',l.href.replace(/.*?:/, ''));l.parentNode.replaceChild(l,l)}",
      "surrogate.uniblue.sources": "!@.uniblue.com .liutilities.com",
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
