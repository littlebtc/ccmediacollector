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
                       "`original_title` VARCHAR, `attribution_name` VARCHAR, `attribution_url` VARCHAR, `source` VARCHAR, "+
                       "`license_url` VARCHAR, `license_nc` BOOLEAN, `license_sa` BOOLEAN, `license_nd` BOOLEAN,"+
                       "`more_permission_url` VARCHAR, `tags` VARCHAR, `notes` TEXT, `file` VARCHAR, `thumbnail_url` VARCHAR)";
const dbFields = ["id", "starred", "type", "url", "title", "original_title", "attribution_name", "attribution_url", "source",
                 "license_url", "license_nc", "license_sa", "license_nd", "more_permission_url", "tags", "notes", "file", "thumbnail_url"];

Components.utils.import("resource://ccmediacollector/Services.jsm");

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

/* At startup, create database / tables if needed */
Library.startup = function() {
  var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("ccmediacollector");
  try {
    if (!file.exists()) {
      file.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    } else if (!file.isDirectory() || !file.isWritable()) {
      throw new Error("ccmediacollector must be a writtable directory.");
    }
  } catch(e) {
    Components.utils.reportError("Fail to create directory for ccmediacollector!!");
    return;
  }
  file.append("library.sqlite");

  if (!file.exists()) {
    LibraryPrivate.dbConnection = Services.storage.openDatabase(file);
    /* Add the smilefox database/ table if it is not established */
    LibraryPrivate.createTable();
  } else {
    LibraryPrivate.dbConnection = Services.storage.openDatabase(file);
  }

  /* Create thumbnail cache directory */
  var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("ccmediacollector");
  file.append("thumbnailcache");
  try {
    if (!file.exists()) {
      file.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    } else if (!file.isDirectory() || !file.isWritable()) {
      throw new Error("thumbnailcache must be a writtable directory.");
    }
  } catch(e) {
    Components.utils.reportError("Fail to create directory for ccmediacollector/thumbnailcache!!");
    return;
  }

};

/* Asynchorouslly get all items */
Library.getAll = function(thisObj, successCallback, failCallback) {
  var statement = LibraryPrivate.dbConnection.createStatement("SELECT * FROM `library` ORDER BY `id` DESC");
  var callback = generateStatementCallback("getAll", thisObj, successCallback, failCallback, dbFields);
  statement.executeAsync(callback);
};
/* Is the library item exists ?*/
Library.checkExistence = function(url, thisObj, successCallback) {
  var statement = LibraryPrivate.dbConnection.createStatement("SELECT `url` FROM `library` WHERE `url` = :url");
  statement.params.url = url;
  var innerCallback = {
   successCallback: function(argsArray) { Components.utils.reportError(JSON.stringify(argsArray)); thisObj[successCallback].call(thisObj, url, (argsArray.length > 0)); },
   failCallback: function() { /* Do nothing */ }
  }
  var callback = generateStatementCallback("checkExistence", innerCallback, "successCallback", "failCallback", ["url"]);
  statement.executeAsync(callback);
};
/* Add items into library */
Library.add = function(url, info) {

  var statement = LibraryPrivate.dbConnection.createStatement("INSERT INTO `library` (`type`, `url`, `title`, `original_title`, `attribution_name`, `attribution_url`, `source`, `license_url`, `license_nc`, `license_sa`, `license_nd`, `more_permission_url`, `thumbnail_url`) VALUES (:type, :url, :original_title, :title, :attribution_name, :attribution_url, :source, :license_url, :license_nc, :license_sa, :license_nd, :more_permission_url, :thumbnail_url)");
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
    Components.utils.import("resource://ccmediacollector/DownloadUtils.jsm");
    var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
    file.append("ccmediacollector");
    file.append("thumbnailcache");
    file.append(lastInsertRowID + ".jpg");
    var dlInstance = new DownloadUtils();
    dlInstance.callback = function() {};
    dlInstance.init(info.thumbnail_url, file);
    LibraryPrivate.update(lastInsertRowID, {thumbnail_url: Services.io.newFileURI(file).spec});
  }
};

/* Call ContentFetcher to fetch an original content for a specific id */
Library.fetchOriginalContent = function(id) {
  var statement = LibraryPrivate.dbConnection.createStatement("SELECT * FROM `library` WHERE `id` = :id");
  statement.params.id = id;
  var innerCallback = {
   successCallback: function(argsArray) { 
     if (argsArray.length != 1) { return; }
     Components.utils.import("resource://ccmediacollector/ContentFetcher.jsm");
     ContentFetcher.fetchOriginalContent(argsArray[0].url);
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
     /* Remove thumbnail cache if needed */
     var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
     file.append("ccmediacollector");
     file.append("thumbnailcache");
     file.append(id + ".jpg");
     if (file.exists()) {
       file.remove(false);
     }
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
