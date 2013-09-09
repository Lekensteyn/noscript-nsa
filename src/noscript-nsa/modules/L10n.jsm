var EXPORTED_SYMBOLS = ["_"];

function _(m) {
  let params = Array.slice(arguments, 1);
  if (params.length) {
    for (let j = 0, len = params.length; j < len; j++) {
      let k = "%" + (j + 1) + "$S";
      if (m.indexOf(k) > -1) m = m.replace(k, params[j]);
      else m = m.replace("%S", params[j]);
    }
  }
  return m; // TODO: replace with a proper l10n module
}
