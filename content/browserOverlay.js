/* vim: sw=2 ts=2 sts=2 et filetype=javascript
*/

var ccMediaCollector = {};
/* Fire when browser.js is loading. */
ccMediaCollector.onLoad = function() {
  var appcontent = document.getElementById("appcontent");
  appcontent.addEventListener("DOMContentLoaded", ccMediaCollector.onPageLoad, true);
  gBrowser.addProgressListener(this.listener, Ci.nsIWebProgress.NOTIFY_LOCATION);  
  
};
/* Fire when browser.js is unloading. */
ccMediaCollector.onUnload = function() {
  
};
ccMediaCollector.listener = {
  QueryInterface: function(aIID) {
   if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
       aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
       aIID.equals(Components.interfaces.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {

  },

  onLocationChange: function(aProgress, aRequest, aURI) {
    Components.utils.reportError(gBrowser.selectedBrowser.ccurl);
  },

  // For definitions of the remaining functions see related documentation
  onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) { },
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) { },
  onSecurityChange: function(aWebProgress, aRequest, aState) { }
};

/* Fire when DOMContentLoaded fired for any <tabbrowser> pages. */
ccMediaCollector.onPageLoad = function(aEvent) {
  if (!aEvent.originalTarget instanceof HTMLDocument) { return; }
  /* We don't want frameElement for now. */
  var doc = aEvent.originalTarget;
  var win = aEvent.originalTarget.defaultView;
  if (win.frameElement) { return; }
  gBrowser.selectedBrowser.ccurl = "Hello" + doc.location.href;
};

window.addEventListener("load", function() { ccMediaCollector.onLoad(); } , false);
window.addEventListener("unload", function() { ccMediaCollector.onUnload(); } , false);

