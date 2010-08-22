/* vim: sw=2 ts=2 sts=2 et filetype=javascript 
 *
 * Bootstrap program to load media collection db
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const CONTRACT_ID = "@creativecommons.org.tw/media-collector-bootstrap;1";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function CCMediaCollectorBootstrap() {
}

CCMediaCollectorBootstrap.prototype = {
  classDescription: "Startup Loader for CC Media Collector",
  classID: Components.ID("bee043f0-ac94-11df-94e2-0800200c9a66"),
  contractID: CONTRACT_ID,
  _xpcom_categories: [
    { category: "profile-after-change" },
  ],
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIObserver, Ci.nsIWeakReference]),
  /* Implements nsIObserver */
  observe: function(subject, topic, data) {
    /* XXX: Observe the impact on the startup */
    if (topic == "profile-after-change") {
      Components.utils.import("resource://ccmediacollector/Library.jsm");
      Library.startup();
    }
  }
}

if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([CCMediaCollectorBootstrap]);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([CCMediaCollectorBootstrap]);
}

