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
  gBrowser.removeProgressListener(this.listener);  
  
};
ccMediaCollector.listener = {
  QueryInterface: function(aIID) {
   if (aIID.equals(Ci.nsIWebProgressListener) ||
       aIID.equals(Ci.nsISupportsWeakReference) ||
       aIID.equals(Ci.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    /* When start loading, remove current rendering result from <browser> */
    /* From: browser/base/content/browser.js, XULBrowserWindow.onStateChange() */
    if(aStateFlags & Ci.nsIWebProgressListener.STATE_START &&
       aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK &&
       aRequest && aWebProgress.DOMWindow == content) {
      gBrowser.selectedBrowser.ccmc = null;
    }
  },

  onLocationChange: function(aProgress, aRequest, aURI) {
    if (gBrowser.selectedBrowser.ccmc) {
      document.getElementById("ccmc-add-button").hidden = false;
    } else {
      document.getElementById("ccmc-add-button").hidden = true;
    }
    document.getElementById("ccmc-info").hidePopup();
    ccMediaCollector.cleanPanelInfo();
  },

  // For definitions of the remaining functions see related documentation
  onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) { },
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) { },
  onSecurityChange: function(aWebProgress, aRequest, aState) { }
};

/* Fire when DOMContentLoaded fired for any <tabbrowser> pages. */
ccMediaCollector.onPageLoad = function(aEvent) {
  /* Don't cope with <iframe> and non-webpage loading. */
  if (!aEvent.originalTarget instanceof HTMLDocument) { return; }
  /* We don't want frameElement for now. */
  var doc = aEvent.originalTarget;
  var win = aEvent.originalTarget.defaultView;
  var browser =  gBrowser.getBrowserForDocument(doc);
  if (win.frameElement || !browser) { return; }
  //gBrowser.selectedBrowser
  Components.utils.import("resource://ccmediacollector/ContentSniffer.jsm");
  var info = ContentSniffer.readFromPage(doc);
  if(info) {
    document.getElementById("ccmc-add-button").hidden = false;
    browser.ccmc = info;
  } else {
    document.getElementById("ccmc-add-button").hidden = true;
  }
};

/* Open the panel if needed */
ccMediaCollector.openPanel = function(anchor) {
  if(gBrowser.selectedBrowser.ccmc) {
    document.getElementById("ccmc-info").openPopup(anchor, 'before_end', 0, 0, false, false);;
  }
};
/* When popup is showing, fill info into panel */
ccMediaCollector.fillPanelInfo = function(anchor) {
  if(gBrowser.selectedBrowser.ccmc) {
    var info = gBrowser.selectedBrowser.ccmc;
    document.getElementById("ccmc-info-title").value = info.title;
    document.getElementById("ccmc-info-attribution-name").value = info.attribution_name;
    /* Fetch the CC license elements, and display the right icon. XXX: non-cc license? */
    if (info.license_url) {
      var licensePart = info.license_url.match(/\/(by[a-z\-]*)\//)
      if (licensePart) {
       document.getElementById("ccmc-info-license").src = "http://i.creativecommons.org/l/"+ licensePart[1] +"/3.0/80x15.png";
      }
    }
    if (info.thumbnail_url) {
      document.getElementById("ccmc-info-thumbnail").src = info.thumbnail_url;
    }
    Components.utils.import("resource://ccmediacollector/Library.jsm");
    Library.checkExistence(info.url, ccMediaCollector, "updateExistence");
  }
};
/* Update the "collect" button */
ccMediaCollector.updateExistence = function(url, result) {
  var info = gBrowser.selectedBrowser.ccmc;
  if(info.url == url) {
    if (result) {
      document.getElementById("ccmc-info-collect-button").label = "Collected";
      document.getElementById("ccmc-info-collect-button").disabled = true;
    } else {
      document.getElementById("ccmc-info-collect-button").label = "Collect!";
      document.getElementById("ccmc-info-collect-button").disabled = false;
    }
  }
};

/* Clean everything when page switching... */
ccMediaCollector.cleanPanelInfo = function() {
  document.getElementById("ccmc-info-title").value = "";
  document.getElementById("ccmc-info-attribution-name").value = "";
  document.getElementById("ccmc-info-license").src = "";
  document.getElementById("ccmc-info-thumbnail").src = "";

};
/* "Collect" the page into the library */
ccMediaCollector.collectCurrentPage = function() {
  var info = gBrowser.selectedBrowser.ccmc;
  Components.utils.import("resource://ccmediacollector/Library.jsm");
  Library.add(info.url, gBrowser.selectedBrowser.ccmc); 
  Library.checkExistence(info.url, ccMediaCollector, "updateExistence");
};

window.addEventListener("load", function() { ccMediaCollector.onLoad(); } , false);
window.addEventListener("unload", function() { ccMediaCollector.onUnload(); } , false);

