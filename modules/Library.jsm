/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "Library" ];

let Library = {};
/* Store private objects for library */
let LibraryPrivate = {};

const dbSchemaString = "(`id` INTEGER PRIMARY KEY NOT NULL, `starred` INTEGER, `type` VARCHAR, `url` VARCHAR, `title` VARCHAR, " +
                       "`attribution_name` VARCHAR, `attribution_url` VARCHAR, `source` VARCHAR, "+
                       "`license_url` VARCHAR, `license_nc` BOOLEAN, `license_sa` BOOLEAN, `license_nd` BOOLEAN,"+
                       "`more_permission_url` VARCHAR, `tags` VARCHAR, `notes` TEXT, `file` VARCHAR, `thumbnail_url` VARCHAR)";
const dbFields = ["id", "starred", "type", "url", "title", "attribution_name", "attribution_url", "source",
                 "license_url", "license_nc", "license_sa", "license_nd", "more_permission_url", "tags", "notes", "file", "thumbnail_url"];

Components.utils.import("resource://ccmediacollector/Services.jsm");

LibraryPrivate.createTable = function() {
  var statement = this.dbConnection.createStatement("CREATE TABLE IF NOT EXISTS library" + dbSchemaString);
  var callback = generateStatementCallback("createTable", this, "finishStartup", "failStartup")
  statement.executeAsync(callback);

};
LibraryPrivate.finishStartup = function() {
};
LibraryPrivate.failStartup = function() {
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
/* Add items into library  XXX: Async */
Library.add = function(url, info) {
  var statement = LibraryPrivate.dbConnection.createStatement("INSERT INTO `library` (`type`, `url`, `title`, `attribution_name`, `attribution_url`, `source`, `license_url`, `license_nc`, `license_sa`, `license_nd`, `more_permission_url`, `thumbnail_url`) VALUES (:type, :url, :title, :attribution_name, :attribution_url, :source, :license_url, :license_nc, :license_sa, :license_nd, :more_permission_url, :thumbnail_url)");
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
};
