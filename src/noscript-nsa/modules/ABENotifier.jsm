var EXPORTED_SYMBOLS = ["ABENotifier"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;

Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");
Cu.import("resource://noscript_@VERSION@/modules/ABE.jsm");
Cu.import("resource://noscript_@VERSION@/modules/IPC.jsm");
Cu.import("resource://noscript_@VERSION@/modules/DNS.jsm");

__defineGetter__("loadBreak", function() {
  delete this.loadBreak;
  Cu.import("resource://noscript_@VERSION@/modules/LoadBreak.jsm");
  return this.loadBreak = new LoadBreak(IPC.MSG_ABE_REPORT, ABE);
});

const ABENotifier = {

  notify: function(abeRes, silent) {
    var req = abeRes.request;
    var silentLoopback = true;
    abeRes.rulesets.forEach(
      function(rs) {
        var lastRule = rs.lastMatch;
        var lastPredicate = lastRule.lastMatch;
        if (lastPredicate.permissive) return;
        
        var action = lastPredicate.action;
        
        log("[ABE] <" + lastRule.destinations + "> " + lastPredicate + " on " + req
          + "\n" + rs.name + " rule:\n" + lastRule);
        
        if (silent || rs != abeRes.lastRuleset || lastPredicate.inclusion)
          return;
        
        if (lastRule.local && silentLoopback) {
          var host = req.destinationURI.host;
          if (host != "localhost" && host != "127.0.0.1" && req.destinationURI.port <= 0)
            // this should hugely reduce notifications for users of bogus hosts files, 
            // while keeping "interesting" notifications
            var dnsr = DNS.getCached(host);
            if (dnsr && dnsr.entries.indexOf("127.0.0.1") > -1)
              return;
        }
        
        loadBreak.report({
          request: req.toString(),
          destinations: lastRule.destinations,
          predicate: lastPredicate.toString()
        }, req.channel);
      }, this);
  }
}

