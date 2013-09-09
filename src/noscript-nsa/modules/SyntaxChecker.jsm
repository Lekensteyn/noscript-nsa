var EXPORTED_SYMBOLS = ["SyntaxChecker"];

const Cu = Components.utils;

function SyntaxChecker() {
  this.sandbox = new Cu.Sandbox("about:");
}

SyntaxChecker.prototype = {
  lastError: null,
  lastFunction: null,
  check: function(script) {
    this.sandbox.script = script;
     try {
       return !!(this.lastFunction = this.ev("new Function(script)"));
     } catch(e) {
       this.lastError = e;
     }
     return false;
  },
  unquote: function(s, q) {
    if (!(s[0] == q && s[s.length - 1] == q &&
        !s.replace(/\\./g, '').replace(/^(['"])[^\n\r]*?\1/, "")
      )) return null;
    try {
      return this.ev(s);
    } catch(e) {}
    return null;
  },
  ev: function(s) {
    return Cu.evalInSandbox(s, this.sandbox);
  }
};
