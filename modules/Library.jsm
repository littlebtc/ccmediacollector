/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "Library" ];

let Library = {};
/* Store private objects for library */
let LibraryPrivate = {};

/* Record these in order to help building SQL strings */
const dbSchemaString = "(`id` INTEGER PRIMARY KEY NOT NULL, `starred` INTEGER, `type` VARCHAR, `url` VARCHAR, `title` VARCHAR, " +
                       "`original_title` VARCHAR, `attribution_name` VARCHAR, `attribution_url` VARCHAR, `source` VARCHAR, " +
                       "`license_url` VARCHAR, `license_nc` BOOLEAN, `license_sa` BOOLEAN, `license_nd` BOOLEAN," +
                       "`more_permission_url` VARCHAR, `tags` VARCHAR, `description` TEXT, `notes` TEXT, `original_url` VARCHAR, `thumbnail_url` VARCHAR," +
                       "`created_at` INTEGER, `collected_at` INTEGER, `file` VARCHAR, `thumbnail_file` VARCHAR)";
const dbFields = ["id", "starred", "type", "url", "title", "original_title", "attribution_name", "attribution_url", "source",
                 "license_url", "license_nc", "license_sa", "license_nd", "more_permission_url", "tags", "description", "notes", "original_url", "thumbnail_url",
                 "created_at", "collected_at", "file", "thumbnail_file"];

Components.utils.import("resource://ccmediacollector/Services.jsm");

/* Restore the default path (nsIFile) for libraries / fetched content.
 * XXX: Make it possible to select the path! */
LibraryPrivate.defaultDir = null;

/* Set default path to Documents/CC Media Collector on multiple platforms. */
LibraryPrivate.setDefaultDir = function() {
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
  LibraryPrivate.defaultDir = defaultDir;
  return true;
}
/* Build Library table */
LibraryPrivate.createTable = function() {
  var statement = this.dbConnection.createStatement("CREATE TABLE IF NOT EXISTS library" + dbSchemaString);
  var callback = generateStatementCallback("createTable", this, "finishStartup", "failStartup")
  statement.executeAsync(callback);

};

/* Update specific params for a library item */
LibraryPrivate.update = function(id, params) {
  var sqlString = "UPDATE `library` SET ";
  for (var key in params) {
    /* Prevent injection */
    if(key.search(/[^[0-9a-z\_]/) != -1) { return; }
    sqlString += "`" + key + "` = :" + key + ",";
  }
  sqlString = sqlString.slice(0, -1) + " WHERE `id` = :id";
  var statement = this.dbConnection.createStatement(sqlString);
  /* Assume params have right params... */
  for (var key in params) {
    statement.params[key] = params[key];
  }
  statement.params.id = id;
  var callback = generateStatementCallback("LibraryPrivate.updateDownload", this, "updateCallback", "dbFail", null, id, params);
  statement.executeAsync(callback);
};

/* After updated successfully, trigger listeners */
LibraryPrivate.updateCallback = function(id, info) {
  triggerListeners("update", id, info);
};

/* Run ContentFetcher for a specific library item 
 * @param info Object of the item that needs to be fetched.
 */
LibraryPrivate.executeFetch = function(info) {
  Components.utils.import("resource://ccmediacollector/ContentFetcher.jsm");
  /* Create a tiny listener to make fetchCallback receive the callback events with item id. */
  var callback = function(type, value) {
    LibraryPrivate.handleDownloadEvent(info.id, type, value);
  };
  ContentFetcher.getOriginalContent(info, this.defaultDir.clone(), callback);
};

/* Handle the DownloadUtils event. */
LibraryPrivate.handleDownloadEvent = function(id, type, value) {
  switch(type) {
    /* Video download is started */
    case "start":
      triggerListeners("fetchStarted", id, value);
    break;
    case "progress_change":
      triggerListeners("fetchProgress", id, value);
    break;
    case "completed":
      /* Record the file name */
      if (value instanceof Ci.nsIFile) {
        LibraryPrivate.update(id, {file: value.path});
      }
      triggerListeners("fetchCompleted", id, value);
    break;
    case "fail":
    break;
  }
};
/* Parse the items to CCREL meanful XHTML using E4X */
LibraryPrivate.parseAndExportItemsToXHTML = function(items) {
  /* nsILocalFile Constructor helper */
  var _fileInstance = Components.Constructor("@mozilla.org/file/local;1", "nsILocalFile", "initWithPath");
  var xhtml = <html xmlns="http://www.w3.org/1999/xhtml" xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <head>
    <title>CC Media Collector</title>
    <meta charset="UTF-8" />
    <style type="text/css">
      <![CDATA[
        h1 {
          font-size: 150%;
        }
        h3 {
          font-size: 120%;
          margin: 0;
          padding: 0;
        }
        .item {
          border-top: 1px dotted;
          padding-top: 0.5em;
        }
        .thumbnail {
          max-width: 7em;
          max-height: 7em;
          height: 5em;
          margin-bottom: 0.5em;
          float: left;
        }
        .itemInfo {
          float: left;
          margin: 0.3em 0 0 0.3em;
        }
        .itemContent {
          padding: 0.5em 0 1em 0;
          clear: both;
        }
        .itemContent > img {
          max-width: 80%;
        }
      ]]>
    </style>
  </head>
  <body>
    <h1>Collected Items in CC Media Collector</h1>
    <div id="collectorItems">
    {function() {
      var resultXHTML = <></>;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        /* Try to match the License name and the version */
        var licenseNameParts = ["Attribution"];
        if (item.license_nc) { licenseNameParts.push("NonCommercial"); }
        if (item.license_sa) { licenseNameParts.push("ShareAlike"); }
        if (item.license_nd) { licenseNameParts.push("NoDerivs"); }
        var licenseNamePart = licenseNameParts.join("-");
        var versionMatch = item.license_url.match(/\/([0-9]+\.[0-9+])\//);
        if (versionMatch) licenseNamePart += " " + versionMatch[1];
        /* Add thumbnail to XHTML if needed. XXX: Is there any metadata vocabulary to meet it? */
        var thumbnailXHTML = <></>
        if (item.thumbnail_file) {
          var thumbnailFileInstance = new _fileInstance(item.thumbnail_file);
          var thumbnailUrl = Services.io.newFileURI(thumbnailFileInstance).spec;
          thumbnailXHTML = <img src={thumbnailUrl} class="thumbnail" />
        }
        /* Fill the dc:type and the content field with XHTML.
           XXX: We should apply some HTML5 player wrapper to make <audio> and <video> work on more browsers */
        var fileInstance = new _fileInstance(item.file);
        var fileUrl = Services.io.newFileURI(fileInstance).spec;
        var contentXHTML = <></>;
        var dcType = "";
        var dcTypeName = "";
        switch (item.type) {
          case "dcmitype:Sound":
            dcType = "http://purl.org/dc/dcmitype/Sound";
            dcTypeName = "Audio";
            contentXHTML = <a href={fileUrl}>File Link</a>;
            break;
          case "dcmitype:StillImage":
            dcType = "http://purl.org/dc/dcmitype/StillImage";
            dcTypeName = "Image";
            contentXHTML = <img src={fileUrl} />;
            break;
          case "dcmitype:MovingImage":
            dcType = "http://purl.org/dc/dcmitype/MovingImage";
            dcTypeName = "Video";
            contentXHTML = <a href={fileUrl}>File Link</a>;
            break;
        }
        resultXHTML += <div class="item">{thumbnailXHTML}
        <div class="itemInfo">
          <h3 property="dc:title">{item.title}</h3>
          <p><span property="dc:type" href={dcType}>{dcTypeName}</span> by <a href={item.attribution_url} rel="cc:attributionURL">{item.attribution_name}</a>, licensed under <a href={item.license_url}>Creative Commons {licenseNamePart}</a></p>
        </div>
        <div class="itemContent">
        {contentXHTML}
        </div>
        </div>;
      }
      return resultXHTML;
    }()}
    </div>
  </body>
  </html>;
  /* Write in into XHTML */
  var outputFile = LibraryPrivate.defaultDir.clone();
  outputFile.append("Library.xhtml");
  var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
  foStream.init(outputFile, 0x02 | 0x08 | 0x20, 0755, 0);
  /* Convert string to input stream, then use asyncCopy
     https://developer.mozilla.org/en/writing_textual_data */
  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);  
  converter.charset = "UTF-8";
  var iStream = converter.convertToInputStream("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"+
                                              "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n" + xhtml.toXMLString());
  
  Components.utils.import("resource://gre/modules/NetUtil.jsm");
  NetUtil.asyncCopy(iStream, foStream);  
}

LibraryPrivate.finishStartup = function() {
};
LibraryPrivate.failStartup = function() {
};
LibraryPrivate.dbFail = function() {
};
/* Generate a mozIStorageStatementCallback implementation.
 * @param callerName       Function name using the callback. Used in error log message.
 * @param thisObj          this object for the callback
 * @param successCallback  Name of callback function in thisObj, called if the statement finished successfully
 * @param failCallback     Name of callback function in thisObj, called if the statement failed.
 * @param selectFields     Array, if assigned, it will generate handleResult() implementation, read fields assigned in this array.
 * If there is more parameter present, they will be appended into successCallback.
 */
function generateStatementCallback(callerName, thisObj, successCallback, failCallback, selectFields) {
  /* Prepare a callback storage */
  var callback = {};
  var functionArguments = Array.prototype.slice.call(arguments);
  /* Implement handleResult if needed */
  if (selectFields && Object.prototype.toString.call(selectFields) === "[object Array]") {
    if (selectFields.length > 0) {
      callback.resultArray = [];
      callback.handleResult = function(aResultSet) {
        for (var row = aResultSet.getNextRow(); row ; row = aResultSet.getNextRow()) {
	        var rowObj = new Object();
          for (var i = 0; i < selectFields.length; i++) {
            rowObj[selectFields[i]] = row.getResultByName(selectFields[i]); 
          }
          this.resultArray.push(rowObj);
        }
      };
    }
  }
  callback.handleError =  function(aError) {
    Components.utils.reportError("NicoFox DownloadManager Down: Error during SQLite Queries on " + callerName + ":" + aError.message);
    thisObj[failCallback].call(thisObj);
  };
  callback.handleCompletion = function(aReason) {
    /* Check for completion reason */
    if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
      Components.utils.reportError("NicoFox DownloadManager Down: Error during SQLite Queries on " + callerName + ", Reason:" + aReason);
      return;
    }
    /* Append extra parameters */
    var argsArray = [];
    if (this.resultArray) {
      argsArray.push(this.resultArray);
    }
    if (functionArguments.length > 5) {
      for (var i = 5; i < functionArguments.length; i++) {
      argsArray.push(functionArguments[i]);
      }
    }
    /* Call the callback */
    thisObj[successCallback].apply(thisObj, argsArray);
  };
  return callback;  
}

/* Startup: check the folder, add database if needed */
Library.startup = function() {
  if (!LibraryPrivate.setDefaultDir()) {
    Components.utils.reportError("Unable to set default download directory!");
    return;
  }
  /* Check and create database if needed */
  var file = LibraryPrivate.defaultDir.clone();
  file.append("library.sqlite");

  if (!file.exists()) {
    LibraryPrivate.dbConnection = Services.storage.openDatabase(file);
    /* Add the smilefox database/ table if it is not established */
    LibraryPrivate.createTable();
  } else {
    LibraryPrivate.dbConnection = Services.storage.openDatabase(file);
  }
};

/* Asynchorouslly get all items */
Library.getAll = function(thisObj, successCallback, failCallback) {
  var statement = LibraryPrivate.dbConnection.createStatement("SELECT * FROM `library` ORDER BY `id` DESC");
  var callback = generateStatementCallback("getAll", thisObj, successCallback, failCallback, dbFields);
  statement.executeAsync(callback);
};
/* Asynchorouslly get all items, sorted in ascending order */
Library.getAllAsc = function(thisObj, successCallback, failCallback) {
  var statement = LibraryPrivate.dbConnection.createStatement("SELECT * FROM `library` ORDER BY `id` ASC");
  var callback = generateStatementCallback("getAll", thisObj, successCallback, failCallback, dbFields);
  statement.executeAsync(callback);
};
/* Is the library item exists ? If yes, return the id of the item. */
Library.checkExistence = function(url, thisObj, successCallback) {
  var statement = LibraryPrivate.dbConnection.createStatement("SELECT `id`, `url` FROM `library` WHERE `url` = :url");
  statement.params.url = url;
  var innerCallback = {
   successCallback: function(argsArray) { thisObj[successCallback].call(thisObj, url, (argsArray.length > 0)? argsArray[0].id : null); },
   failCallback: function() { /* Do nothing */ }
  }
  var callback = generateStatementCallback("checkExistence", innerCallback, "successCallback", "failCallback", ["id", "url"]);
  statement.executeAsync(callback);
};
/* Add items into library */
Library.add = function(url, info) {

  var statement = LibraryPrivate.dbConnection.createStatement("INSERT INTO `library` (`type`, `url`, `title`, `original_title`, `attribution_name`, `attribution_url`, `source`, `license_url`, `license_nc`, `license_sa`, `license_nd`, `more_permission_url`, `original_url`, `thumbnail_url`) VALUES (:type, :url, :original_title, :title, :attribution_name, :attribution_url, :source, :license_url, :license_nc, :license_sa, :license_nd, :more_permission_url, :original_url, :thumbnail_url)");
  statement.params["url"] = url;
  /* Fill license information if needed */
  if (info.license_url && info.license_url.search(/creativecommons/) != -1) {
    statement.params["license_nc"] = (info.license_url.search(/\-nc/) != -1);
    statement.params["license_sa"] = (info.license_url.search(/\-sa/) != -1);
    statement.params["license_nd"] = (info.license_url.search(/\-nd/) != -1);
  }
  for (var key in info) {
    statement.params[key] = info[key];
  }
  statement.execute();
  statement.reset();
  var lastInsertRowID = LibraryPrivate.dbConnection.lastInsertRowID;
  if (info.thumbnail_url) {
    /* Thumbnail cache, XXX: Should be split out and error-safe */
    Components.utils.import("resource://ccmediacollector/DownloadPaths.jsm");
    Components.utils.import("resource://ccmediacollector/DownloadUtils.jsm");
    var file = LibraryPrivate.defaultDir.clone();
    file.append(info.title + ".thumb.jpg");
    file = DownloadPaths.createNiceUniqueFile(file)
    var dlInstance = new DownloadUtils();
    dlInstance.callback = function() {};
    dlInstance.init(info.thumbnail_url, file);
    LibraryPrivate.update(lastInsertRowID, {thumbnail_file: file.path});
  }
  /* Call executeFetch to get original content. XXX: Should we add another addAndFetch function? */
  info.id = lastInsertRowID;
  LibraryPrivate.executeFetch(info);
  return lastInsertRowID;
};

/* Fetch an original content for a specific id */
Library.fetchOriginalContent = function(id) {
  var statement = LibraryPrivate.dbConnection.createStatement("SELECT * FROM `library` WHERE `id` = :id");
  statement.params.id = id;
  var innerCallback = {
   successCallback: function(argsArray) { 
     if (argsArray.length != 1) { return; }
     LibraryPrivate.executeFetch(argsArray[0]);
   },
   failCallback: function() { /* Do nothing */ }
  };
  var callback = generateStatementCallback("fetchOriginalContent", innerCallback, "successCallback", "failCallback", dbFields);
  statement.executeAsync(callback);
};

/* Remove item with specific id from library */ 
Library.remove = function(id) {
  if (!id) { return; }
  var statement = LibraryPrivate.dbConnection.createStatement("DELETE FROM `library` WHERE `id` = :id");
  statement.params.id = id;
  /* After item removed, notify listeners */
  var innerCallback = {
   successCallback: function() { 
     triggerListeners("remove", id, null);
     /* Remove related files if needed */

   },
   failCallback: function() { /* Do nothing */ }
  };
  var callback = generateStatementCallback("remove", innerCallback, "successCallback", "failCallback", dbFields);
  statement.executeAsync(callback);
};

/* Change to some public infos (with filtering) */
Library.update = function(id, params) {
  LibraryPrivate.update(id, {title: params['title']});
};

Library.exportToXHTML = function() {
  /* First get all items in the library. */
  this.getAllAsc(LibraryPrivate, "parseAndExportItemsToXHTML", "dbFail");  
};

/* Make other instances listens to the changes to the library. */
let libraryListeners = [];

Library.addListener = function(listener) {
 libraryListeners.push(listener);
};
Library.removeListener = function(listener) {
  if (libraryListeners.indexOf(listener) > -1) {
    libraryListeners.splice(libraryListeners.indexOf(listener), 1);
  }
};

/* Trigger all listers for specific event */
function triggerListeners(eventName, id, content) {
  for (var i = 0; i < libraryListeners.length; i++)
  { 
    if ((typeof libraryListeners[i][eventName]) == 'function') { libraryListeners[i][eventName].call(libraryListeners[i], id, content); }
  }
}
