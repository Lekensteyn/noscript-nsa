var EXPORTED_SYMBOLS = ["DOMHelper"];

function DOMHelper(document) {
  this.document = document;
}

DOMHelper.prototype = {
  get $() {
    delete this.$;
    let doc = this.document;
    return this.$ = function(id) doc.getElementById(id);
  },
  get $$() {
    delete this.$$;
    let doc = this.document;
    return this.$$ = function(s) doc.querySelectorAll(s);
  },
  get $x() {
    delete this.$x;
    let doc = this.document;
    return this.$x = function(el, attributes, parent, anchor) {
      if (typeof el == "string") el = doc.createElement(el);
      if (attributes) for (let name in attributes) {
        switch(name) {
          case "_text":
            el.textContent = attributes[name];
            break;
          default:
            el.setAttribute(name, attributes[name])
        }
      }
      if (parent) {
        if (anchor) parent.insertBefore(el, anchor);
        else parent.appendChild(el);
      }
      return el;
    }
  },
}
