/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Handle download process for media collection
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "DownloadUtils" ];
let DownloadUtils = {};

Components.utils.import("resource://ccmediacollector/Services.jsm");


let DownloadUtils = function() { };
DownloadUtils.prototype = {
  /* Store the file instance and the title */
  _file: null,
  _title: null,
  _fileType: null,
  /* Is the download canceled? */
  _canceled: false,
  
  /* Store video download progress */
  _currentBytes: 0,
  _maxBytes: 0,
  
  /* Download item ID in database. Should be assigned from the outside */
  dbId: null,
  
  /* Initialize download for specific URL. */
  init: function(url, path, title) {
    /* Temp workaround: if title is set, it means we didn't know the actual fileType.
       As we didn't recognize file type at this time, set the extension to be .part */
    this._file = path.clone();
    if (typeof title != "undefined") {
      this._file.append(title + ".part");
      this._file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      /* Save the title for future use. */
      this._title = title;
    }
    /* Don't waste time */
    if (this._canceled) { return; }
    
    /* Make URI and cache key */
    var videoUri = Services.io.newURI(url, null, null);

    this._persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
                    createInstance(Ci.nsIWebBrowserPersist);

    var flags =  this._persist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 this._persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                 this._persist.PERSIST_FLAGS_CLEANUP_ON_FAILURE;
    this._persist.persistFlags = flags; 

    /* We need a listener to watch the download progress */
    var listener = {
      _parentInstance: this,
      _unsuccessfulStart: false,
      onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        if (this._parentInstance._canceled) { return; }
        if (aStateFlags & 1) {
          /* Get HTTP Channel. */
          var channel = aRequest.QueryInterface(Ci.nsIHttpChannel);

          /* Try to find the correct file type if we are unsure. */
          if (this._parentInstance._title) {
            /* Set default file extension to HTML. */
            this._parentInstance._fileType = "htm";
            /* Use Content-Disposition if available */
            var contentDisposition = channel.getResponseHeader("Content-Disposition");
            if (contentDisposition) {
              /* Try to find filename="xxx.mp3" prt */
              var fileTypeMatch = /\.([0-9a-z]{1,4})\"?;?/i.exec(contentDisposition);
              if (fileTypeMatch) {
                this._parentInstance._fileType = fileTypeMatch[1].toLowerCase();
              }
            } else {
              /* Then try to sniff URL */
              var newUrl = channel.URI.spec;
              newUrl = newUrl.replace(/\?.*$/, "");
              var fileTypeMatch = /\.([0-9a-z]{1,4})$/i.exec(newUrl);
              if (fileTypeMatch) {
                this._parentInstance._fileType = fileTypeMatch[1].toLowerCase();
              }
            }
          }
          /* Process HTTP Errors
	         * nsIChannel will throw NS_ERROR_NOT_AVAILABLE when there is no connection
           * (even for requestSucceeded), so use the try-catch way  */
          try {
            if (channel.responseStatus != 200) {
              Components.utils.reportError("Hit 403!");
              throw new Error();
            }
            this._parentInstance.callback("start", {});
          } catch(e) {
            this._unsuccessfulStart = true;
          }
        }
        else if (aStateFlags & 16) {
          /* Download failed. In this case, PERSIST_FLAGS_CLEANUP_ON_FAILURE will done the cleanup */
	        if (aStatus != 0 /* NS_OK */) {
            this._parentInstance.failDownload();
            return;
          }
          /* Donwnload incompleted or connection error or initial response is 403. Will not clean up file, we should do it manually. */
          if (this._unsuccessfulStart || this._parentInstance._currentBytes != this._parentInstance._maxBytes) {
            Components.utils.reportError("incomplete!");
            this._parentInstance.failDownload();
            return;
          }
          /* Download successfully, notify the listener */
          this._parentInstance.completeAll();
        }
      },
      onProgressChange: function (aWebProgress, aRequest,
                                 aCurSelfProgress, aMaxSelfProgress,
                                 aCurTotalProgress, aMaxTotalProgress) {
        this._parentInstance._currentBytes = aCurSelfProgress;
        this._parentInstance._maxBytes = aMaxSelfProgress;
        this._parentInstance.callback('progress_change', {currentBytes: aCurSelfProgress, maxBytes: aMaxSelfProgress});
      },
      onLocationChange: function (aWebProgress, aRequest, aLocation) {},
      onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function (aWebProgress, aRequest, aState) {},
    };

    this._persist.progressListener = listener;
    this._persist.saveURI(videoUri, null, null, null, null, this._file);

  },
  /* Call when video downloads failed */
  failDownload: function() {
    this._canceled = true;
    if (this._file.exists()) {
      this._file.remove(false);
    }
    this.callback("fail", {});
  },
  completeAll: function() {
    /* Set the file type and final file name. from DownloadPaths.jsm (temp workaround) */
    /* XXX: Should find a better way to handle conflict */
    if (this._title) {
      var curFile = this._file.clone();
      var ext = "." + this._fileType;
      curFile.leafName = this._title + ext;
      for (let i = 1; i < 10000 && curFile.exists(); i++) {
        curFile.leafName = this._title + "(" + i + ")" + ext;
      }
      this._file.moveTo(null, curFile.leafName);
    }
    /* Return the nsIFile instance to make Library.jsm record the file name. */
    this.callback("completed", this._file);
  },
  /* Cancel by download manager action */
  cancel: function() {
    this._canceled = true;

    if(this._persist != undefined) {
      this._persist.cancelSave();
    }
    this.callback("cancel",{});
  }
};

