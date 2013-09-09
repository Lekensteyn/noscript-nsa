var EXPORTED_SYMBOLS = ["FS"];

const {interfaces: Ci, classes: Cc, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://noscript_@VERSION@/modules/Log.jsm");

const FS = {
  localFile: function(x) {
    if (x instanceof Ci.nsILocalFile) return x;
    if (x instanceof Ci.nsIFileURL) return x.file;
    if ("substring" in x) {
      if (x.substring(0, 5) === "file:") return this.localFile(Services.io.newURI(x, null, null));
      let f = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      f.initWithPath(x);
      return f;
    }
    return x;
  },
  readFile: function(file, charset) {
    var res;
    
    const is = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream );
    is.init(this.localFile(file) ,0x01, 256 /*0400*/, null);
    const sis = Cc["@mozilla.org/scriptableinputstream;1"]
      .createInstance(Ci.nsIScriptableInputStream);
    sis.init(is);
    
    res = sis.read(sis.available());
    is.close();
    
    if (charset !== null) { // use "null" if you want uncoverted data...
      const unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(Ci.nsIScriptableUnicodeConverter);
      try {
        unicodeConverter.charset = charset || "UTF-8";
      } catch(ex) {
        unicodeConverter.charset = "UTF-8";
      }
      res = unicodeConverter.ConvertToUnicode(res);
    }
  
    return res;
  },
  writeFile: function(file, content, charset) {
    const unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Ci.nsIScriptableUnicodeConverter);
    try {
      unicodeConverter.charset = charset || "UTF-8";
    } catch(ex) {
      unicodeConverter.charset = "UTF-8";
    }
    
    content = unicodeConverter.ConvertFromUnicode(content);
    const os = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
    os.init(this.localFile(file), 0x02 | 0x08 | 0x20, 448 /*0700*/, 0);
    os.write(content, content.length);
    os.close();
  },
  
  safeWriteFile: function(file, content, charset) {
    file = this.localFile(file);
    var tmp = file.clone();
    var name = file.leafName;
    tmp.leafName = name + ".tmp";
    tmp.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, file.exists() ? file.permissions : 384 /*0600*/);
    this.writeFile(tmp, content, charset);
    tmp.moveTo(file.parent, name);
  }
};
