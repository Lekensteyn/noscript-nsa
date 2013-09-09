var EXPORTED_SYMBOLS = ["Placeholder"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Thread.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Var.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Style.jsm");
Cu.import("resource://noscript_@VERSION@/modules/L10n.jsm");

const ICON_PATH = "resource://noscript_@VERSION@/content/mime/";
const HTML_NS = "http://www.w3.org/1999/xhtml";

Style.add(
  '.__noscriptPlaceholderOuter__ { display: inline-block !important; visibility: visible !important; direction: ltr !important; ' +
    'outline-color: #fc0 !important; outline-style: solid !important; outline-width: 1px !important; outline-offset: -1px !important;' +
    'cursor: pointer !important; background: #ffffe0 url("resource://noscript_@VERSION@/content/nsa-no.png") no-repeat left top !important; opacity: 0.6 !important; margin-top: 0px !important; margin-bottom: 0px !important; } ' +
  '.__noscriptPlaceholderInner__ { display: block !important; background-repeat: no-repeat !important; background-color: transparent !important; width: 100%; height: 100%; margin: 0px; border: none } '
); 

var activated = {};

const Placeholder = {
  createLater: function(mime, url, embed) {
    Thread.asap(this.create, this, arguments);
  },
  
  create: function(mime, url, embed) {
    let document = embed.ownerDocument;
    if (!document) return;
    
    let window = document.defaultView;
    let style = window.getComputedStyle(embed, ''); 
    if (!style) return;
    
    const minSize = 32;
    
    let href = url.spec;
    
    let label = "<" + embed.tagName.toUpperCase() + ">";
    let title = label + (mime ? "," + mimeEssentials(mime) : '') + "@" + urlEssentials(href);
    
    let info = {
      embed: embed,
      url: url,
      mime: mime,
      label: label,
      title: title
    }
    
    let outer = document.createElementNS(HTML_NS, "div");
    
    outer.addEventListener("click", onClick, true);
    Var.set(outer, "replaced", info);
    outer.className = "__noscriptPlaceholderOuter__";
    outer.id = embed.id;
    let outStyle = outer.style;

    for(let j = style.length; j-- > 0;) {
      let name = style[j];
      outStyle.setProperty(name, style.getPropertyValue(name), "important");
    }

    let inner = outer.appendChild(document.createElementNS(HTML_NS, "a"));
    inner.className = "__noscriptPlaceholderInner__";
    inner.href = url.spec;
    inner.title = title;
    
    let restrictedSize = style.display === "none" || style.visibility === "hidden";
    
    if (restrictedSize) {
      outStyle.maxWidth = "32px";
      outStyle.maxHeight = "32px";
    } else if (style.height === "100%") {
      outStyle.display = "block";
      outStyle.height = "100%";
    }
    
    let inStyle = inner.style;
    inStyle.backgroundImage = cssMimeIcon(mime, 32);
    
    if(restrictedSize || (64 > (parseInt(style.width) || 0) || 64 > (parseInt(style.height) || 0))) {
      inStyle.backgroundPosition = "bottom right";
      let w = parseInt(style.width) || 0,
          h = parseInt(style.height) || 0;
      if (minSize > w || minSize > h) {
        var rect = embed.getBoundingClientRect();
        let isTop = !window.frameElement;
        outStyle.minWidth = w = Math.max(w, isTop ? minSize : Math.min(document.documentElement.offsetWidth - rect.left, minSize)) + "px";
        outStyle.minHeight = Math.max(h, isTop ? minSize : Math.min(document.documentElement.offsetHeight - rect.top, minSize)) + "px";
        outStyle.overflow = "visible";
        outStyle.float = "left";
      }
    } else {
      inStyle.backgroundPosition = "center";
    }
    
    embed.parentNode.replaceChild(outer, embed);
  },
  
  
  isPlaceholder: function(el) {
    return !!this.getReplacingInfo(el);
  },
  getReplacingInfo: function(el) {
    return Var.get(el, "replaced");
  },
  isActivated: function(embed, url, mime) {
    if (Var.get(embed, "activated")) return true;
    let a = activated;
    if (url.host in a || url.prePath in a) return true;
    let key = url.spec;
    if (key in a || (key += " " + mime) in a) return true;
    let params = extractParams(embed);
    return params && (key + " " + params) in a;
  },
  resetActivated: function() {
    activated = {};
    // TODO: remote activation for process per tab
  },
  
  activate: function(url, mime, embed) {
    if (!(url instanceof Ci.nsIURI)) {
      activated[url] = true;
    } else {
      let key = url.spec;
      if (mime) key += " " + mime;
      if (embed) {
        let params = extractParams(embed);
        if (params) key += " " + extractParams(embed);
        Var.set(embed, "activated", true);
      }
      activated[key] = true;
    }
  }
}

const flashRx = /shockwave|futuresplash/i;
const javaOrSilverlightRx = /java|silverlight/i;
function extractParams(embed) {
  if ("type" in embed) {
    if (Var.exists(embed, "embedParams"))
      return Var.get(embed, "embedParams");

    let type = embed.type;
    return Var.set(embed, 
      flashRx.test(type)
        ? extractFlashvars(embed)
        : javaOrSilverlightRx.test(type)
          ? extractParamChildren(embed)
          : ''
      );
  }
  return '';
}
function extractFlashvars(embed) {
  // add flashvars to have a better URL ID
  try {
    let flashvars = embed.getAttribute("flashvars");
    if (!flashvars) {
      let params = embed.getElementsByTagName("param");
      for (let j = 0, p; (p = params[j]); j++)
        if (p.name && p.name.toLowerCase() === "flashvars")
          flashvars = p.value;
    }
    return encodeURI(flashvars); 
  } catch(e) {
    log("Couldn't extract flashvars:" + e);
  }
  return '';
}
  
function extractParamChildren(embed) {
  try {
    let params = embed.getElementsByTagName("param");
    if (params[0]) {
      let pp = '';
      for(let j = params.length; j-- > 0;)
        pp += encodeURIComponent(params[j].name) + "=" + encodeURIComponent(params[j].value) + "&";

      return pp;
    }
  } catch (e) {
    log("Couldn't add object params:" + e);
  }
  return '';
}


function mimeEssentials(mime) {
  return mime && mime.replace(/^application\/(?:x-)?/, "") || "";
}
function urlEssentials(s) {
  // remove query, hash and intermediate path
  return s.replace(/[#\?].*/g, '').replace(/(.*?\w\/).+?(\/[^\/]+)$/, '$1...$2');
}

function cssMimeIcon(mime, size) {
  return mime == "application/x-shockwave-flash"
  ? // work around for Windows not associating a sane icon to Flash
    'url("' + ICON_PATH + "flash" + size + '.png")'
  : /^application\/x-java\b/i.test(mime)
    ? 'url("' + ICON_PATH + "java" + size + '.png")'
    : /^application\/x-silverlight\b/.test(mime)
      ? 'url("' + ICON_PATH + "somelight" + size + '.png")'
      : /^font\b/i.test(mime)
        ? 'url("' + ICON_PATH + 'font.png")'
        : mime === 'WebGL'
          ? 'url("' + ICON_PATH + "webgl" + size + '.png")'
          : 'url("moz-icon://noscript?size=' + size + '&contentType=' + mime.replace(/[^\w-\/]/g, '') + '")';
}

function onClick(ev) {
  if (ev.button !== 0) return;
  try {
    let ph = ev.currentTarget;
    ev.preventDefault();
    ev.stopPropagation();
    
    if (!ph) return;
    
    let replaced = Var.get(ph, "replaced");
    if (!Services.prompt.confirm(null, "NoScript",
        _("Do you really want to activate\n%S\n%S?",
        replaced.title,
        replaced.mime ? "(" + replaced.mime + ")" : "")
      ))  return;
    
    let embed = replaced.embed.cloneNode(true);
    Placeholder.activate(replaced.url, replaced.mime, embed);
    ph.parentNode.replaceChild(embed, ph);
    log("Activated: " + activated.toSource());
  } catch(e) {
    log(e);
  }
}

