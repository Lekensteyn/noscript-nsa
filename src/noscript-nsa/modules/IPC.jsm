var EXPORTED_SYMBOLS = ["IPC"];

const {interfaces: Ci, classes: Cc, utils: Cu} = Components;


const IPC = {
  MSG_GET_POLICY: "noscript_@VERSION@:GetPolicy",
  MSG_REFRESH_POLICY: "noscript_@VERSION@:RefreshPolicy",
  MSG_REQUEST_SOURCES: "noscript_@VERSION@:RequestSources",
  MSG_RECEIVE_SOURCES: "noscript_@VERSION@:ReceiveSources",
  MSG_RELOAD_PAGE: "noscript_@VERSION@:ReloadPage",
  MSG_ABE_REPORT: "noscript_@VERSION@:ABEReport",
  MSG_XSS_REPORT: "noscript_@VERSION@:XSSReport",
  MSG_CONTINUE_LOAD: "noscript_@VERSION@:ContinueLoad",
  MSG_CLEARCLICK_REPORT: "noscript_@VERSION@:ClearClickReport",
  MSG_CLEARCLICK_UNLOCK: "noscript_@VERSION@:ClearClickUnlock",
  MSG_SHUTDOWN: "noscript_@VERSION@:Shutdown",
  
  get processType() {
    delete this.processType;
    return this.processType = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).processType;
  },
  
  get isChildProcess() {
    delete this.isChildProcess;
    return this.isChildProcess = this.processType === 2;
  },
  
  get globalManager() {
    delete this.globalManager;
    return this.globalManager = !this.isChildProcess &&
      Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageBroadcaster);
  },
  
  get parentManager() {
    delete this.parentManager;
    return this.parentManager = !this.isChildProcess &&
      Cc["@mozilla.org/parentprocessmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
  },
  
  get childManager() {
    delete this.childManager;
    return this.childManager = this.isChildProcess &&
      Cc["@mozilla.org/childprocessmessagemanager;1"].getService(Ci.nsISyncMessageSender);
  },
  
  get DOMMessages() {
    delete this.DOMMessages;
    Cu.import("resource://noscript_@VERSION@/modules/DOMMessages.jsm");
    return this.DOMMessages = DOMMessages;
  },
  
  get isAndroidNative() {
    delete this.isAndroidNative;
    return this.isAndroidNative =
      Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo)
        .ID == "{aa3c5121-dab2-40e2-81ca-7ea25febc110}";
  }

}
