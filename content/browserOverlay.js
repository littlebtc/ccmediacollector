/* vim: sw=2 ts=2 sts=2 et filetype=javascript
*/

var ccMediaCollector = {};
/* Fire when browser.js is loading. */
ccMediaCollector.onLoad = function() {
  window.removeEventListener("load", ccMediaCollector.onLoad, false);
  /* Apply in-content UI whitelist to about:collection on Firefox 4. http://bugzil.la/571970 */
  if (XULBrowserWindow.inContentWhitelist) {
    XULBrowserWindow.inContentWhitelist.push("about:collection");
  }
  var appcontent = document.getElementById("appcontent");
  if (appcontent) {
    appcontent.addEventListener("DOMContentLoaded", ccMediaCollector.onPageLoad, false);
  }
  gBrowser.addProgressListener(ccMediaCollector.progressListener, Ci.nsIWebProgress.NOTIFY_LOCATION);
  Components.utils.import("resource://ccmediacollector/Library.jsm", ccMediaCollector);
  Components.utils.import("resource://ccmediacollector/ContentSniffer.jsm", ccMediaCollector);
  ccMediaCollector.Library.addListener(ccMediaCollector.libraryListener);
  
};
/* Fire when browser.js is unloading. */
ccMediaCollector.onUnload = function() {
  window.removeEventListener("unload", ccMediaCollector.onUnload, false);
  var appcontent = document.getElementById("appcontent");
  if (appcontent) {
    appcontent.removeEventListener("DOMContentLoaded", ccMediaCollector.onPageLoad, false);
  }
  gBrowser.removeProgressListener(ccMediaCollector.progressListener);
  ccMediaCollector.Library.removeListener(ccMediaCollector.libraryListener);
};
/* Listenes to collection item modification and fetch progress. */
ccMediaCollector.libraryListener = {
  /* Update fetch progress */
  fetchProgress: function(id, value) {
    if (document.getElementById("ccmc-info-title").hasAttribute("ccmc-id") &&
        document.getElementById("ccmc-info-title").getAttribute("ccmc-id") == id) {
      document.getElementById("ccmc-info-collect-button").hidden = true;
      document.getElementById("ccmc-info-fetch-progress").hidden = false;
      document.getElementById("ccmc-info-fetch-progress").setAttribute("mode", "determined");
      document.getElementById("ccmc-info-fetch-progress").setAttribute("value", value.currentBytes);
      document.getElementById("ccmc-info-fetch-progress").setAttribute("max", value.maxBytes);
    }
  },
  /* When fetch completed, hide the progress meter, show "Collected" button */
  fetchCompleted: function(id, value) {
    if (document.getElementById("ccmc-info-title").hasAttribute("ccmc-id") &&
        document.getElementById("ccmc-info-title").getAttribute("ccmc-id") == id) {
      document.getElementById("ccmc-info-collect-button").hidden = false;
      document.getElementById("ccmc-info-fetch-progress").hidden = true;
      document.getElementById("ccmc-info-fetch-progress").setAttribute("mode", "undetermined");
    }
  }
}
/* Listens to browser progress. */
ccMediaCollector.progressListener = {
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
  var info = ccMediaCollector.ContentSniffer.readFromPage(doc);
  if(info) {
    browser.ccmc = info;
    /* Ensure the button is only changed when the document is selected */
    if (gBrowser.selectedBrowser == browser) {
      document.getElementById("ccmc-add-button").hidden = false;
      ccMediaCollector.Library.checkExistence(info.url, ccMediaCollector, "updateExistence");
    }
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
       document.getElementById("ccmc-info-license").src = "chrome://ccmediacollector/skin/ccicons/"+ licensePart[1] +".png";
      }
    }
    if (info.thumbnail_url) {
      document.getElementById("ccmc-info-thumbnail").style.backgroundImage = "url('" + info.thumbnail_url + "')";
    }
    this.Library.checkExistence(info.url, ccMediaCollector, "updateExistence");
  }
};
/* Update the "collect" button */
ccMediaCollector.updateExistence = function(url, id) {
  var info = gBrowser.selectedBrowser.ccmc;
  if(info.url == url) {
    if (id) {
      document.getElementById("ccmc-info-title").setAttribute("ccmc-id", id);
      document.getElementById("ccmc-info-collect-button").setAttribute("collected", "true");
      document.getElementById("ccmc-add-button").setAttribute("src", "chrome://ccmediacollector/skin/note.png");
    } else {
      document.getElementById("ccmc-info-collect-button").removeAttribute("collected");
      document.getElementById("ccmc-add-button").setAttribute("src", "chrome://ccmediacollector/skin/note_add.png");
    }
  }
};

/* Clean everything when page switching... */
ccMediaCollector.cleanPanelInfo = function() {
  document.getElementById("ccmc-info-title").removeAttribute("ccmc-id");
  document.getElementById("ccmc-info-title").value = "";
  document.getElementById("ccmc-info-attribution-name").value = "";
  document.getElementById("ccmc-info-license").src = "";
  document.getElementById("ccmc-info-thumbnail").style.backgroundImage = "";
  document.getElementById("ccmc-info-collect-button").hidden = false;
  document.getElementById("ccmc-info-fetch-progress").hidden = true;
  document.getElementById("ccmc-info-fetch-progress").setAttribute("mode", "undetermined");

};
/* "Collect" the page into the library */
ccMediaCollector.collectCurrentPage = function() {
  var info = gBrowser.selectedBrowser.ccmc;
  var id = this.Library.add(info.url, gBrowser.selectedBrowser.ccmc); 
  document.getElementById("ccmc-info-title").setAttribute("ccmc-id", id);
  document.getElementById("ccmc-info-collect-button").hidden = true;
  document.getElementById("ccmc-info-fetch-progress").hidden = false;
  /* Use checkExistence to change the status to "Collected"
     However, since the button is hidden, it will be displayed after download completed. */
  this.Library.checkExistence(info.url, ccMediaCollector, "updateExistence");
};

window.addEventListener("load", ccMediaCollector.onLoad, false);
window.addEventListener("unload", ccMediaCollector.onUnload, false);

