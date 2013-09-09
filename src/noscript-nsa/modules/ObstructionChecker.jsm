var EXPORTED_SYMBOLS = ["ObstructionChecker"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Var.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DOM.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Prefs.jsm");

const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";

const NO_SCROLLBARS = {w: 0, h: 0};
const CLIP_MIN = 64;
  
function ObstructionChecker(isEmbed, ev, debug) {
  this.isEmbed = isEmbed;
  this.object = ev.target;
  if (typeof ev.button === "number") {
    this.x = ev.pageX;
    this.y = ev.pageY;
    this.debug = debug && ev.ctrlKey && ev.button == 1
  } else {
    this.isMouseEvent = false;
  }
}

ObstructionChecker.prototype = {
  isMouseEvent: true,
  x: 0,
  y: 0,
  
  maxWidth: 350,
  maxHeight: 200,
  minWidth: 160,
  minHeight: 100,
  
  debug: false,
  box: null,
  img: null,
  
  get canvas() {
    delete this.__proto__.canvas;
    return this.__proto__.canvas = Cc["@mozilla.org/xul/xul-document;1"].createInstance(Ci.nsIDOMDocument)
      .implementation.createHTMLDocument("").createElement("canvas");
  },
 
  getBox: function(o, d, w) {
    if (!d) d = o.ownerDocument;
    if (!w) w = d.defaultView;
    var c = o.getBoundingClientRect();
    var x = c.left, y = c.top; // this is relative to the view port, just like mozInnerScreen*
    
    return {
      x: x + w.scrollX, y: y + w.scrollY, // add scroll* to make it absolute
      width: c.width, height: c.height,
      screenX: w.mozInnerScreenX + x, screenY: w.mozInnerScreenY + y
    }
  },

  isObstructed: function() {
    // TODO: remove me and use a SVG filter to mask the object and match color
    if (this.isEmbed) return false;
    
    var
      o = this.object,
      d = o.ownerDocument,
      dElem = d.documentElement,
      w = d.defaultView,
      top = w.top,
      
      sheet = null,
      
      sd = NO_SCROLLBARS,
      
      c = this.canvas,
      g = c.getContext("2d"),
      
      box = this.box || this.getBox(o, d, w);
    
    try {

      if ((frame = w.frameElement))
        sd = computeScrollbarSizes(w, dElem, d.body);
      
      let clientHeight = w.innerHeight - sd.h;
      let clientWidth =  w.innerWidth - sd.w;
     
      let maxWidth = Math.max(Math.min(this.maxWidth, clientWidth), sd.w ? 0 : Math.min(this.minWidth, dElem.offsetWidth), 8);
      let maxHeight = Math.max(Math.min(this.maxHeight, clientHeight), sd.h ? 0 : Math.min(this.minHeight, dElem.offsetHeight, 8));

      // expand to parent form if needed
      let form = o.form;
      if (frame && !this.isEmbed && (form || (form = findParentForm(o)))) {

        let formBox = this.getBox(form, d, w);
        if (!(formBox.width && formBox.height)) { // some idiots put <form> as first child of <table> :(
          formBox = this.getBox(form.offsetParent || form.parentNode, d, w);
          if (!(formBox.width && formBox.height)) {
            formBox = this.getBox(form.parentNode.offsetParent || o.offsetParent, d, w);
          }
        }
  
        if (formBox.width && formBox.height) {
          // form has layout, recenter to show as much as possible
          this.x = this.x || box.x + box.width;   // use mouse coordinates or
          this.y = this.y || box.y + box.height; // rightmost widget position 
          
          box = formBox; // the form is our new reference
          
          var delta;
          
          // move inside the viewport if needed
          if (box.x < 0) {
            box.screenX -= box.x;
            box.x = 0;
          }
          if (box.y < 0) {
            box.screenY -= box.y;
            box.y = 0;
          }
          
          // is our center out of the form?
          if (box.x + Math.min(box.width, maxWidth) < this.x) { 
            box.width = Math.min(box.width, maxWidth);
            delta = this.x + 4 - box.width - box.x;
            box.x += delta;
            box.screenX += delta;
           
          }
          if (box.y + Math.min(box.height, maxHeight) < this.y) {
            box.height = Math.min(box.height, maxHeight);
            delta = this.y + 4 - box.height - box.y;
            box.y += delta;
            box.screenY += delta;
          }
          
          // recenter to the form
          this.x = box.x + box.width / 2;
          this.y = box.y + box.height / 2;
          
          o = form;
        }
      }

   
      // clip, slide in viewport and trim
      
      var vp = { 
        x: w.scrollX, 
        y: w.scrollY, 
        width: Math.max(w.innerWidth - sd.w, 32), 
        height: Math.max(w.innerHeight - sd.h, 16), // Facebook like buttons are 20 pixel high
        frame: frame
      };
      
      let rtlOffset = 0;
      
      if (this.isEmbed) { // check in-page vieport
        vp.frame = null;
        vp.x = Math.max(vp.x, box.x);
        vp.y = Math.max(vp.y, box.y);
        vp.width = Math.min(vp.width, box.width);
        vp.height = Math.min(vp.height, box.height);
        
        for(let ancestor = o; ancestor = ancestor.parentNode;) {

          if ((ancestor.offsetWidth < box.width || ancestor.offsetHeight < box.height) &&
              w.getComputedStyle(ancestor, '').overflow != "visible") {
            
            // check if we're being fooled by some super-zoomed applet
            if (box.width / 4 <= ancestor.offsetWidth && box.height / 4 <= ancestor.offsetHeight) {
              let ancestorBox = this.getBox(ancestor, d, w);
              
              if (box.x < ancestorBox.x) {
                box.x = ancestorBox.x;
                box.screenX = ancestorBox.screenX;
              }
              if (box.y < ancestorBox.y) { 
                box.y = ancestorBox.y;
                box.screenY = ancestorBox.screenY;
              }
              if (box.width + box.x > ancestorBox.width + ancestorBox.x) box.width = Math.max(this.minWidth, ancestor.clientWidth - (box.x - ancestorBox.x));
              if (box.height + box.y > ancestorBox.height + ancestorBox.y) box.height = Math.max(this.minHeight, ancestor.offsetHeight - (box.y - ancestorBox.y));
            }
            break;
          }
        }
      } else {
        
        // correct x offsets according to left scrollbars if needed
        try {
          var adaptiveScrollerSide = false;
          switch(prefSvc.getIntPref("layout.scrollbar.side")) {  
            case 1:
              adaptiveScrollerSide = true;
            case 0:
              if (!adaptiveScrollerSide && prefSvc.getIntPref("bidi.direction") != 2) 
                break;
            case 3:
              vp.x += this._scrollerCorrect(w, adaptiveScrollerSide);
              rtlOffset = this._scrollerCorrect(top, adaptiveScrollerSide);
          }
        } catch(e) {
          if (this.debug) log(e);
        }
      }
      
      // clip viewport intersecting with scrolling parents
      var clip = this.intersect(o.parentNode, frame ? this.getBox(frame) : box);
      if (clip.h != 0) {
        if (vp.height + clip.h >= CLIP_MIN) vp.height += clip.h;
        else vp.height = CLIP_MIN;
        if (maxHeight + clip.h >= CLIP_MIN) maxHeight += clip.h;
        else maxHeight = CLIP_MIN;
      }
      if (clip.w != 0) {
        if (vp.width + clip.w >= CLIP_MIN) vp.width += clip.w;
          else vp.width = CLIP_MIN;
          if (maxWidth + clip.w >= CLIP_MIN) maxWidth += clip.w;
          else maxWidth = CLIP_MIN;
      }
      vp.x += clip.x;
      vp.y += clip.y;
      
      // Fit in viewport
      
      box.oX = box.x;
      box.oY = box.y;
      box.oW = box.width;
      box.oH = box.height;
      
      constrain(box, "x", "width", maxWidth, vp, this.x);
      constrain(box, "y", "height", maxHeight, vp, this.y);
      
      c.width = box.width;
      c.height = box.height;

      let imgData1 = grab(g, w, box);
      
      let rootElement = top.document.documentElement;
      let rootBox = this.getBox(rootElement, top.document, top);

      let offsetY = (box.screenY - rootBox.screenY);
      let offsetX = (box.screenX - rootBox.screenX) + rtlOffset;
      
      var ret = false;
      
      let imgData2 = grab(g, top, {x: offsetX, y: offsetY, width: box.width, height: box.height});
      
      let buf1 = imgData1.data, buf2 = imgData2.data;
      
      let bgR = buf1[0], bgG = buf1[1], bgB = buf1[2];
      let diff = 0, tot = 0, threshold = .05;
      for (let x = 0, w = box.width; x < w; x++) {
        for (let y = 0, h = box.height; y < h; y++) {
          let p = y * h + x * 4;
          let r1 = buf1[p], r2 = buf2[p],
              g1 = buf1[++p], g2 = buf2[p],
              b1 = buf1[++p], b2 = buf2[p];
          if (r1 === r2 && g1 === g2 && b1 === b2 || r1 === 255 && g1 === 255 && b1 === 255) {
            tot++;
          } else if (r1 !== bgR || g1 !== bgG || b1 !== bgB) {
            tot++;
            diff++;
            if (diff / tot > threshold) {
              ret = true;
              break;
            }
          }
        }
      }

      if (this.debug) {
        ret = true;
      }
      
      if (ret) {
        let fakeSrc = c.toDataURL();
        g.putImageData(imgData1, 0, 0);
        this.img =
        {
          realSrc: c.toDataURL(),
          fakeSrc: fakeSrc,
          width: c.width,
          height: c.height
        }
      }
    } finally {
      if (sheet) Style.remove(sheet);
    }
    
    return ret;
  },
  
  intersect: function(parent, box) {
    const MIN = 64;
    
    // backtrack all the overflow~="auto|scroll" parent elements and clip
        
    var pw = parent.ownerDocument.defaultView;
  
    var current, cbox;
    var dw = 0, dh = 0, dx = 0, dy = 0;
  
    var bx = box.screenX;
    var by = box.screenY;
    var bw = box.width;
    var bh = box.height;
    
    const ELEMENT = Ci.nsIDOMElement;
    
    while(parent) {
   
      current = parent; 
      switch (pw.getComputedStyle(current, '').overflow) {
        case "auto" : case "scroll":
        cbox = this.getBox(current);
        
        d = cbox.screenY - by;
        if (d > 0) {
          dy += d;
          dh -= d;
          by += d;
          bh -= d;
        }
        d = cbox.screenX - bx;
        if (d > 0) {
          dx += d;
          dw -= d;
          bx += d;
          bw -= d;
          
        }
        d = by + bh - (cbox.screenY + current.clientHeight);
        if (d > 0) {
          if (cbox.height - current.clientHeight < 10) // compensate for miscalculated scrollbars bug
            d += 20;
          dh -= d;
          bh -= d;
        }
        d = bx + bw - (cbox.screenX + current.clientWidth);
        if (d > 0) {
          if (cbox.width - current.clientWidth < 10) // compensate for miscalculated scrollbars bug
            d += 20;
          dw -= d;
          bw -= d;
        }
      }
      parent = current.parentNode;
      if (parent instanceof ELEMENT) continue;
      parent = pw.frameElement;
      if (parent) pw = parent.ownerDocument.defaultView;
    }
    
    return { x: dx, y: dy, w: dw, h: dh };
  }
  
};


function computeScrollbarSizes(window, dElem, body) {
  var fw = window.innerWidth, fh = window.innerHeight;
  
  if (body && body.ownerDocument.compatMode == "BackCompat") {
    dElem = body;
  }
  
  var dw = dElem.clientWidth, dh = dElem.clientHeight;
  var w = Math.min(fw, dw), h = Math.min(fh, dh);
  var zoom = window.QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindowUtils).screenPixelsPerCSSPixel;

  return { w: (fw - w) * zoom, h: (fh - h) * zoom };
}

function findParentForm(o) {
  var ftype = Ci.nsIDOMHTMLFormElement;
  while((o = o.parentNode)) {
    if (o instanceof ftype) return o;
  }
  return null;
}

function createCanvas(d) {
  let c = Var.get(d, "clearClickCanvas");
  return c || Var.set(d, "clearClickCanvas", d.createElementNS(HTML_NS, "canvas"));
}

  
function scrollerCorrect(w, adaptive)
  (adaptive && w.getComputedStyle(w.document.body || w.document.documentElement, '').direction != 'rtl')
      ? 0
      : w.innerWidth - w.document.documentElement.clientWidth;

function constrain(box, axys, dim, max, vp, center) {
  var d;
  var scr = "screen" + axys.toUpperCase();
  // trim bounds to take in account fancy overlay borders
  var l = box[dim];
  var n = box[axys];
  
  if (vp.frame && center && l < vp[dim]) { // expand to viewport if possible
    l = vp[dim];
  }
  
  if (l > 6) {
    var bStart = Math.floor(l * .1) // 20% border
    var bEnd = bStart;
    if (bStart + n > center) {
      bStart = center - n;
    } else if (l + n - center < bEnd) {
      bEnd = l + n - center;
    } 
    box[dim] = (l -= (bStart + bEnd));
    box[axys] = (n += bStart);
    box[scr] += bStart;
    
  }

  if (l > max) {
    // resize
    if (center) {
      var halfMax = Math.round(max / 2);
      var nn = center - halfMax;
      if (nn > n && center + halfMax > n + l) nn = (n + l) - max;        
      box[axys] = nn;
      box[scr] += (nn - n);
      n = nn;
    }
    l = box[dim] = max;
  }
  // slide into viewport
  var vpn = vp[axys];
  d = (n < vpn)
      ? vpn - n
      : (n + l) > (vpn + vp[dim])
        ? (vpn + vp[dim]) - (n + l)
        : 0;
  
  if (d) {
    n = (box[axys] += d);
    box[scr] += d;
  }
}


function grab(g, win, box) {
  let w = box.width, h = box.height;
  g.drawWindow(win, Math.round(box.x), Math.round(box.y), w, h, "#ffffff");
  return g.getImageData(0, 0, w, h);
}

// TODO: use this to load SVG synchronously and mask plugin embeddings
const IPH = Ci.nsIProtocolHandler;
Protocol = {

  // nsIProtocolHandler
  scheme: "_clearClick_",
  protocolFlags: IPH.URI_IS_UI_RESOURCE | IPH.URI_OPENING_EXECUTES_SCRIPT,
  defaultPort: -1,
  allowPort: function() false,
  newURI: function(spec, originCharset, baseURI) {
    
  },
  
  createColor: function() {
    let color = Math.round(Math.random() * 0xffffff);
    let cssColor = color.toString(16);
    cssColor = "#" + ("000000".substring(cssColor.length)) + cssColor; 
    let R = color & 0xff0000;
    let G = color & 0x00ff00;
    let B = color & 0x0000ff;
  },
  
  QueryInterface: XPCOMUtils.generateQI([IPH, Ci.nsIFactory,])
}
