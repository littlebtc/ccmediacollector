/* vim: sw=2 ts=2 sts=2 et filetype=javascript
*/

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "ContentFetcher" ];

let ContentFetcher = {};

/* Restore the default path (nsIFile) for fetching content.
 * XXX: Make it possible to select the path! */
ContentFetcher.defaultDir = null;

/* Set default path to Documents/CC Media Collector on multiple platforms. */
function setDefaultDir() {
  var defaultDir = null;
  Components.utils.import("resource://ccmediacollector/Services.jsm");
  var os = Services.appinfo.OS;
  if (os == "WINNT") {
    defaultDir = Services.dirsvc.get("Pers", Ci.nsILocalFile);
  } else if (os == "Darwin") {
    defaultDir = Services.dirsvc.get("UsrDocs", Ci.nsILocalFile);
  } else {
    /* If we fail to use XDGDocs, use home directory. */
    try {
      defaultDir = Services.dirsvc.get("XDGDocs", Ci.nsILocalFile);
    } catch(e) {
      defaultDir = Services.dirsvc.get("Home", Ci.nsILocalFile);
    }
  }
  /* Step 2: Append NicoFox and do some check; create if not exists. */
  defaultDir.append("CC Media Collector");
  if (defaultDir.exists()) {
    if (!defaultDir.isWritable() || !defaultDir.isDirectory()) {
      return false;
    }
  } else {
    try {
      defaultDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    } catch(e) {
      return false;
    }
  }
  ContentFetcher.defaultDir = defaultDir;
  return true;
}

/* Use for <iframe> workers.
 * Modified from Bug 546740 (http://bugzil.la/546740) patch for Jetpack SDK. */
var hostFrame, hostDocument, isHostFrameReady = false;

/* When the <html:iframe> ready (see ContentFetcher.startup), set hostDocument and marked it as ready. */
function setHostFrameReady(event) {
  hostDocument = hostFrame.contentDocument;
  hostFrame.removeEventListener("DOMContentLoaded", setHostFrameReady, false);  
  isHostFrameReady = true;
}

/* Set a new <xul:iframe> to parse the item */
function initParser(targetUrl, path, title, callback) {
  /* https://developer.mozilla.org/en/Code_snippets/HTML_to_DOM */
  /* XXX: Create cache for <iframe> elements */
  if (!hostDocument) {
    hostDocument = hostFrame.contentDocument;
  }
  var iframe = hostDocument.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "iframe"); 
  iframe.setAttribute("type", "content");
  iframe.setAttribute("collapsed", "true");
  hostDocument.documentElement.appendChild(iframe);
  /* Restriction */
  iframe.webNavigation.allowAuth = false;
  iframe.webNavigation.allowImages = false;
	iframe.webNavigation.allowJavascript = false;
	iframe.webNavigation.allowMetaRedirects = true;
	iframe.webNavigation.allowPlugins = false;
	iframe.webNavigation.allowSubframes = false;
  /* Listen to loading */
  iframe.addEventListener("DOMContentLoaded", function(event) { originalContentReceiver.success(event, path, title, callback); }, false );
  /* Go */
  iframe.contentDocument.location.href = targetUrl;
};

/* Receive the hidden <iframe> result. Should be done with evalInSandbox scripts in the future. */
let originalContentReceiver = {};
originalContentReceiver.success = function(event, path, title, callback) {
  var document = event.originalTarget;
  if (!document) { return; }
  /* Flickr only */
  var fetchUrl = document.querySelector("#allsizes-photo img").src;
  if (fetchUrl && /http\:\/\//.test(fetchUrl)) {
    initDownload(fetchUrl, path, title, callback);
  }
};

originalContentReceiver.fail = function() {
  Components.utils.reportError("Unable to reach original content URL!");
};

/* Really initialize download. */
function initDownload(fetchUrl, path, title, callback) {
  Components.utils.import("resource://ccmediacollector/DownloadUtils.jsm");
  /* Initial DownloadUtils to fetch the content. */
  var download = new DownloadUtils();
  download.callback = callback;
  download.init(fetchUrl, path, title);
}

/* The Download Queue, will record items waiting to be downloaded. Currently not used.*/
var downloadQueue = [

];

/* Public Methods */

/* During the content fetcher startup, find and set the download target directory. */
ContentFetcher.startup = function() {
  if (!setDefaultDir()) {
    Components.utils.reportError("Unable to set default download directory!");
  }
}

/* Sometimes we need to get "Original Content", which might need another instruction to get */
ContentFetcher.getOriginalContent = function(info, path, callback) {
  if (!path instanceof Ci.nsIFile || typeof callback != "function") { return; }
  var url = info.url;
  var title = info.title;
  /* If we already know the original url, get it. */
  if (info.original_url) {
    initDownload(info.original_url, path, title, callback);
  } else {
    /* Extra URL Fetch and DOM Parsing is needed */
    /* In the future, we will make every site code to be written as a script, and run it through evalInSandbox. */
    /* Flickr only code. Acesss /sizes/o/ to get the largest size possible to reach. */
    var targetUrl = url + "/sizes/o/";
  
    /* In some OS, hidden window is an XHTML/XUL document so we can directly put <xul:iframe> into it.
     * However if the hidden window a HTML document, we need to append a <html:iframe> with XHTML document, and put <xul:iframe> in XHTML.
     * Modified from Bug 546740 (http://bugzil.la/546740) patch for Jetpack SDK.
     */
    if (!hostFrame) {
      var appShellService = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);
      var hiddenWindow = appShellService.hiddenDOMWindow;
      if (hiddenWindow.location.protocol == "chrome:" &&
          (hiddenWindow.document.contentType == "application/vnd.mozilla.xul+xml" ||
          hiddenWindow.document.contentType == "application/xhtml+xml")) {
        hostFrame = hiddenWindow;
        hostDocument = hiddenWindow.document;
        isHostFrameReady = true;
      } else {
        hostFrame = hiddenWindow.document.createElement("iframe");
        /* Hack because we need chrome:// URL. */
        hostFrame.setAttribute("src", "chrome://ccmediacollector/content/hiddenWindowContainer.xhtml");
        hostFrame.addEventListener("DOMContentLoaded", setHostFrameReady, false);
        hiddenWindow.document.body.appendChild(hostFrame);
      }
    }
    if (isHostFrameReady) {
      initParser(targetUrl, path, title, callback);
    } else {
      hostFrame.addEventListener("DOMContentLoaded", function() {
        hostFrame.removeEventListener("DOMContentLoaded", arguments.callee, false);
        initParser(targetUrl, path, title, callback);
      }, false);
    }
  }
};
