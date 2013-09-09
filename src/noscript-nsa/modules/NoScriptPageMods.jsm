var EXPORTED_SYMBOLS = ["NoScriptPageMods"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

for each(let name in ["RequestWatchdog", "DOM"])
  XPCOMUtils.defineLazyModuleGetter(this, name, "resource://noscript_@VERSION@/modules/" + name + ".jsm")

const SMILElements = ["set", "animation"];

var NoScriptPageMods = {
  fixLinks: function(doc) {
    let win = doc.defaultView;
    win.addEventListener("click", onClick, true);
    win.addEventListener("change", onChange, true);
  },
  removeSMILKeySniffers: function(doc) {
    for (let j = SMILElements.length; j-- > 0;) {
      let nodes = doc.getElementsByTagName(SMILElements[j]);
      for (let k = nodes.length; k-- > 0;) {
        let node = nodes[k];
        let begin = node.getAttribute("begin");
        if (begin && begin.indexOf("accessKey(") > -1)
          node.removeAttribute("begin");
      }
    }
  },
  checkWindowName: function() {
    
  },
}

function attemptNavigation(doc, destURL, callback) {
  log("Emulated JavaScript navigation to " + destURL);
  if (!callback) callback = navigationCallback;
  var cs = doc.characterSet;
  var uri = Services.io.newURI(destURL, cs, Services.io.newURI(doc.documentURI, cs, null));
  
  if (/^https?:\/\//i.test(destURL)) callback(doc, uri);
  else {
    let done = false;
    let req = RequestWatchdog.createCheckedXHR("HEAD", uri.spec, function() {
      if (req.readyState < 2) return;
      try {
        if (!done && req.status) {
          done = true;
          if (req.status == 200) callback(doc, uri);
          req.abort();
        }
      } catch(e) {}
    });
    req.send(null);
  }
}

function navigationCallback(doc, uri) {
  doc.defaultView.location.href = uri.spec;
}

// simulate onchange on selects if options look like URLs
function onChange(ev) {
  try {
    var s = ev.originalTarget;
    if (!(s instanceof Ci.nsIDOMHTMLSelectElement) ||
        s.hasAttribute("multiple") ||
        !/open|nav|location|\bgo|load/i.test(s.getAttribute("onchange"))) return;
    var doc = s.ownerDocument;
    var win = doc.defaultView;
    var docShell = DOM.getDocShellForWindow(win);
   
    if (docShell.allowJavascript) return;
    
    var opt = s.options[s.selectedIndex];
    if (!opt) return;
    
    if (/[\/\.]/.test(opt.value) && opt.value.indexOf("@") < 0) {
      attemptNavigation(doc, opt.value);
      ev.preventDefault();
    }
  } catch(e) {
    log(e);
  }
}
  
function onClick(ev) {

  if (ev.button == 2) return;
  try {
    var a = ev.originalTarget;
    
    if (a.__noscriptFixed) return;
    
    var doc = a.ownerDocument;
    var win = doc.defaultView;
    var docShell = DOM.getDocShellForWindow(win);
   
    if (docShell.allowJavascript) return;
    
    var onclick;
    
    while (!(a instanceof Ci.nsIDOMHTMLAnchorElement || a instanceof Ci.nsIDOMHTMLAreaElement)) {
      if (typeof(a.getAttribute) == "function" && (onclick = a.getAttribute("onclick"))) break;
      if (!(a = a.parentNode)) return;
    }
    
    const href = a.getAttribute("href");
    // fix JavaScript links
    var jsURL;
    if (href) {
      jsURL = /^javascript:/i.test(href);
      if (!(jsURL || href == "#")) return;
    } else {
      jsURL = "";
    }
    
    onclick = onclick || a.getAttribute("onclick");
    var fixedHref = (onclick && extractJSLink(onclick)) || 
                     (jsURL && extractJSLink(href)) || "";
    
    onclick = onclick || href;
    
    if (/\bsubmit\s*\(\s*\)/.test(onclick)) {
      let form;
      if (fixedHref) {
        form = doc.getElementById(fixedHref); // youtube
        if (!(form instanceof Ci.nsIDOMHTMLFormElement)) {
          form = doc.forms.namedItem(fixedHref);   
        }
      }
      if (!form) {
        let m = onclick.match(/(?:(?:\$|document\.getElementById)\s*\(\s*["']#?([\w\-]+)[^;]+|\bdocument\s*\.\s*(?:forms)?\s*(?:\[\s*["']|\.)?([^\.\;\s"'\]]+).*)\.submit\s*\(\)/);
        form = m && (/\D/.test(m[1]) ? (doc.forms.namedItem(m[1]) || doc.getElementById(m[1])) : doc.forms.item(parseInt(m[1])));
        if (!(form && (form instanceof Ci.nsIDOMHTMLFormElement))) {
          while ((form = a.parentNode) && form != doc && !form instanceof Ci.nsIDOMHTMLFormElement);
        }
      }
      if (form && (form instanceof Ci.nsIDOMHTMLFormElement)) {
        form.submit();
        ev.preventDefault();
      }
      return;
    }
    
    if (fixedHref) {
      let callback;
      if (/^(?:button|input)$/i.test(a.tagName)) { // JS button
        if (a.type == "button" || (a.type == "submit" && !a.form)) {
          callback = navigationCallback; 
        } else return;
      } else {
        var evClone = doc.createEvent("MouseEvents");
        evClone.initMouseEvent("click",ev.canBubble, ev.cancelable, 
                           ev.view, ev.detail, ev.screenX, ev.screenY, 
                           ev.clientX, ev.clientY, 
                           ev.ctrlKey, ev.altKey, ev.shiftKey, ev.metaKey,
                           ev.button, ev.relatedTarget);
        callback =
          function(doc, uri) {
            a.setAttribute("href", fixedHref);
            var title = a.getAttribute("title");
            a.setAttribute("title", title ? "[js] " + title : 
              (onclick || "") + " " + href
            );
            a.dispatchEvent(ev = evClone); // do not remove "ev = " -- for some reason, it works this way only :/
          };
        a.__noscriptFixed = true;
      }
      if (callback) {
        attemptNavigation(doc, fixedHref, callback);
        ev.preventDefault();
      }
    } else { // try processing history.go(n) //
      if(!onclick) return;
      
      jsURL = onclick.match(/history\s*\.\s*(?:go\s*\(\s*(-?\d+)\s*\)|(back|forward)\s*\(\s*)/);
      jsURL = jsURL && (jsURL = jsURL[1] || jsURL[2]) && (jsURL == "back" ? -1 : jsURL == "forward" ? 1 : jsURL); 
  
      if (!jsURL) return;
      
      // jsURL now has our relative history index, let's navigate
      var sh = docShell.sessionHistory;
      if (!sh) return;
      
      var idx = sh.index + jsURL;
      if (idx < 0 || idx >= sh.count) return; // out of history bounds 
      docShell.gotoIndex(idx);
      ev.preventDefault(); // probably not needed
    }
  } catch (e) {
    log(e);
  }
}
  
function extractJSLink(js) {
  const findLink = /(['"])([\/\w-\?\.#%=&:@]+)\1/g;
  findLink.lastIndex = 0;
  var maxScore = -1;
  var score; 
  var m, s, href;
  while ((m = findLink.exec(js))) {
    s = m[2];
    if (/^https?:\/\//.test(s)) return s;
    score = 0;
    if (s.indexOf("/") > -1) score += 2;
    if (s.indexOf(".") > 0) score += 1;
    if (score > maxScore) {
      maxScore = score;
      href = s;
    }
  }
  return href || "";
}
