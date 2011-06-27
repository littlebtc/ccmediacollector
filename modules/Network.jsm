/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 * Network related helpers
 */
var EXPORTED_SYMBOLS = [ "Network" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const PR_UINT32_MAX = 0xffffffff;

let Network = {};

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyGetter(this, "BadCertHandler", function () {
  var obj = {};
  Components.utils.import("resource://gre/modules/CertUtils.jsm", obj);
  return obj.BadCertHandler;
});


/* Asynchrously fetch content of one URL */
Network.fetchUrlAsync = function(url, postQueryString, thisObj, successCallback, failCallback) {
  Components.utils.import("resource://ccmediacollector/Services.jsm");
  
  if (!thisObj || typeof thisObj[successCallback] != "function" || typeof thisObj[failCallback] != "function") {
    throw new Error('Wrong parameter in fetchUrlAsync');
    return;
  }

  var channel = Services.io.newChannel(url, null, null).QueryInterface(Ci.nsIHttpChannel);
  /* Set POST Request if query string available */
  /* https://developer.mozilla.org/en/Creating_Sandboxed_HTTP_Connections#Creating_HTTP_POSTs */
  if (postQueryString) {
    var inputStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);  
    inputStream.setData(postQueryString, postQueryString.length); 
    if (channel instanceof Ci.nsIUploadChannel) {
      channel.setUploadStream(inputStream, "application/x-www-form-urlencoded", -1);
    }
    /* setUploadStream resets to PUT, modify it */
    channel.requestMethod = "POST";
  }
  /* Force allow 3rd party cookies, to make this work when 3rd party cookies are disabled. (Bug 437174) */
  if (channel instanceof Ci.nsIHttpChannelInternal) {
    channel.forceAllowThirdPartyCookie = true;
  }
  /* Assign the callback */
  var callback = function(aInputStream, aResult, aRequest) {
    if (!Components.isSuccessCode(aResult)) {
      thisObj[failCallback].call(thisObj, url);
      return;
    }
    /* Convert utf-8 input stream. From https://developer.mozilla.org/en/Code_snippets/File_I%2f%2fO */
    var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
    converterInputStream.init(aInputStream, "UTF-8", 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    var data = "";
    let (str = {}) {
      let read = 0;
      do { 
        read = converterInputStream.readString(4096, str);
        data += str.value;
      } while (read != 0);
    }
    converterInputStream.close();
    aInputStream.close();
    thisObj[successCallback].call(thisObj, url, data, aRequest);
  };

  /* The following is modified from NetUtil.asyncFetch from netwerk/base/src/NetUtil.jsm in mozilla-central,
     by Boris Zbarsky and Shawn Wilsher.
     (Since Bug 581175 is not implemented on 1.9.2 and I need to get request from callback,
     I re-write my own implementation based on NetUtil.jsm on 2.0. */

  /* Create a pipe that will create our output stream that we can use once we have gotten all the data. */
  var pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
  pipe.init(true, true, 0, PR_UINT32_MAX, null);

  /* Create a listener that will give data to the pipe's output stream. */
  var listener = Cc["@mozilla.org/network/simple-stream-listener;1"].createInstance(Ci.nsISimpleStreamListener);
  listener.init(pipe.outputStream, {
    onStartRequest: function(aRequest, aContext) {},
    onStopRequest: function(aRequest, aContext, aStatusCode) {
      pipe.outputStream.close();
      callback(pipe.inputStream, aStatusCode, aRequest);
    }
  });

  /* Add a BadCertHandler to suppress SSL/cert error dialogs, but only if
   * the channel doesn't already have a notificationCallbacks. */
  if (!channel.notificationCallbacks) {
    /* Pass true to avoid optional redirect-cert-checking behavior. */
    channel.notificationCallbacks = new BadCertHandler(true);
  }

  channel.asyncOpen(listener, null);
}

/* Asynchrously fetch content of one URL, upload edition */
Network.uploadAsync = function(url, fileData, fileName, thisObj, successCallback, failCallback) {
  Components.utils.import("resource://ccmediacollector/Services.jsm");

  if (!thisObj || typeof thisObj[successCallback] != "function" || typeof thisObj[failCallback] != "function") {
    throw new Error('Wrong parameter in uploadAsync');
    return;
  }
  var boundary = "ccmc1ccmc2ccmc3";
  var channel = Services.io.newChannel(url, null, null).QueryInterface(Ci.nsIHttpChannel);
  /* Set MIME Request */
  /* http://mxr.mozilla.org/mozilla-central/source/netwerk/test/unit/test_post.js */
  var body = "--" + boundary + "\r\n";
  body += "Content-Disposition: form-data; name='file'; filename='" + fileName + "'\r\n";
  body += "Content-Type: application/octet-stream\r\n\r\n";
  body += fileData + "\r\n";
  body += "--" + boundary + "--";

  var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  var inputStream = converter.convertToInputStream(body);

  var mime = Cc["@mozilla.org/network/mime-input-stream;1"].
               createInstance(Ci.nsIMIMEInputStream);
  mime.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  mime.setData(inputStream);
  mime.addContentLength = true;

  if (channel instanceof Ci.nsIUploadChannel) {
    channel.setUploadStream(mime, "", mime.available());
  }
  /* setUploadStream resets to PUT, modify it */
  channel.requestMethod = "POST";
  /* Force allow 3rd party cookies, to make this work when 3rd party cookies are disabled. (Bug 437174) */
  if (channel instanceof Ci.nsIHttpChannelInternal) {
    channel.forceAllowThirdPartyCookie = true;
  }
  /* Assign the callback */
  var callback = function(aInputStream, aResult, aRequest) {
    if (!Components.isSuccessCode(aResult)) {
      thisObj[failCallback].call(thisObj, url);
      return;
    }
    /* Convert utf-8 input stream. From https://developer.mozilla.org/en/Code_snippets/File_I%2f%2fO */
    var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
    converterInputStream.init(aInputStream, "UTF-8", 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    var data = "";
    let (str = {}) {
      let read = 0;
      do {
        read = converterInputStream.readString(4096, str);
        data += str.value;
      } while (read != 0);
    }
    converterInputStream.close();
    aInputStream.close();
    thisObj[successCallback].call(thisObj, url, data, aRequest);
  };

  /* The following is modified from NetUtil.asyncFetch from netwerk/base/src/NetUtil.jsm in mozilla-central,
     by Boris Zbarsky and Shawn Wilsher.
     (Since Bug 581175 is not implemented on 1.9.2 and I need to get request from callback,
     I re-write my own implementation based on NetUtil.jsm on 2.0. */

  /* Create a pipe that will create our output stream that we can use once we have gotten all the data. */
  var pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
  pipe.init(true, true, 0, PR_UINT32_MAX, null);

  /* Create a listener that will give data to the pipe's output stream. */
  var listener = Cc["@mozilla.org/network/simple-stream-listener;1"].createInstance(Ci.nsISimpleStreamListener);
  listener.init(pipe.outputStream, {
    onStartRequest: function(aRequest, aContext) {},
    onStopRequest: function(aRequest, aContext, aStatusCode) {
      pipe.outputStream.close();
      callback(pipe.inputStream, aStatusCode, aRequest);
    }
  });

  /* Add a BadCertHandler to suppress SSL/cert error dialogs, but only if
   * the channel doesn't already have a notificationCallbacks. */
  if (!channel.notificationCallbacks) {
    /* Pass true to avoid optional redirect-cert-checking behavior. */
    channel.notificationCallbacks = new BadCertHandler(true);
  }

  channel.asyncOpen(listener, null);
}
