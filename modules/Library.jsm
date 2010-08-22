/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "Library" ];

let Library = {};
/* Store private objects for library */
let LibraryPrivate = {};

const dbSchemaString = "(`id` INTEGER PRIMARY KEY NOT NULL, `starred` INTEGER, `type` INTEGER, `url` VARCHAR, `title` VARCHAR, " +
                       "`author_name` VARCHAR, `author_url` VARCHAR, `source` VARCHAR, "+
                       "`license_url` VARCHAR, `premits_reproduction` BOOLEAN, `premits_distribution` BOOLEAN, `premits_derivative_works` BOOLEAN,"+
                       "`more_premission_url` VARCHAR, `tags` VARCHAR, `notes` TEXT, `file` VARCHAR, `thumbnail_file` VARCHAR)";

Components.utils.import("resource://ccmediacollector/Services.jsm");

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

