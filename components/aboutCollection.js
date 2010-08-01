/* Add about:collection page
 * See https://developer.mozilla.org/En/Custom_about:_URLs */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AboutCollection() { }
AboutCollection.prototype = {
  classDescription: "about:collection",
  contractID: "@mozilla.org/network/protocol/about;1?what=collection",
  classID: Components.ID("{4a4005aa-0ff7-4acc-a0d5-5263c3d0320a}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
  
  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },
  
  newChannel: function(aURI) {
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let channel = ios.newChannel("chrome://ccmediacollector/content/collection/collection.xul",
                                 null, null);
    channel.originalURI = aURI;
    return channel;
  }
};

if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutCollection]);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([AboutCollection]);
}
