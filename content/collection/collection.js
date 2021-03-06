var collection = {};
const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://ccmediacollector/Services.jsm", collection);
Components.utils.import("resource://ccmediacollector/Library.jsm", collection);

/* Page loading */
collection.onLoad = function() {
  /* Get all contents */
  this.Library.getAll(this, "showItems", "dbError");
};
collection.onUnload = function() {
  this.Library.removeListener(this.listener);
};

collection.updateItem = function(item, info) {

  item.setAttribute("ccmcid", info.id);
  item.setAttribute("ccmctype", info.type);
  item.setAttribute("title", info.title);
  item.setAttribute("original_title", info.original_title);
  item.setAttribute("url", info.url);
  item.setAttribute("attribution_name", info.attribution_name);
  item.setAttribute("attribution_url", info.attribution_url);
    
  if (info.license_url) {
    item.setAttribute("license_url", info.license_url);
    var licensePart = info.license_url.match(/\/(by[a-z\-]*)\//);
    if (licensePart) {
      item.setAttribute("license_part", licensePart[1]);
      var license = document.createElement("image");
      item.setAttribute("licensethumbnail", "chrome://ccmediacollector/skin/ccicons/"+ licensePart[1] +".png");
    }
  }
  if (info.file) {
    item.setAttribute("file", info.file);
  }
  /* Get thumbnail from local or remote site */
  if (info.thumbnail_file) {
    var thumbnailFile = collection._fileInstance(info.thumbnail_file);
    item.thumbnail = this.Services.io.newFileURI(thumbnailFile).spec;
  } else if (info.thumbnail_url) {
    item.thumbnail = info.thumbnail_url;
  }
}

/* Display items after get items */
collection.showItems = function(argsArray) {
  /* Add Listener */
  this.Library.addListener(this.listener);
  
  var list = document.getElementById("collectionList");
  for (var i = 0; i < argsArray.length; i++) {
    var item = document.createElement("richlistitem");
    list.appendChild(item);
    this.updateItem(item, argsArray[i]);
  }
  /* XXX: This is only used to update label on filter buttons. */
  collection.search();
};
collection.dbError = function() {
  alert("Collection DB Error!");
};

/* A very simple search and filtering feature implemented by hidding elements. 
   Mostly modified from chrome/toolkit/content/mozapps/downloads/downloads.js on mozilla-central.
 */
collection.search = function() {
  var value = document.getElementById("searchText").value;
  var list = document.getElementById("collectionList");
  var items = list.children;
  /* Split search terms and set search attributes. */
  var terms = value.replace(/^\s+|\s+$/g, "").toLowerCase().split(/\s+/);
  var searchAttributes = ["title", "original_title", "url", "attribution_name", "attribution_url"];

  /* Fetch the value settings for filters */
  var displayTypeNames = ["Image", "Audio", "Video"];
  var displayType = {};
  var permissionForComNames = ["NotFiltered", "Allowed", "Denied"];
  var permissionForCom = "";
  var permissionForModNames = ["NotFiltered", "Allowed", "ShareAlike", "Denied"];
  var permissionForMod = "";
  var name = "";
  for each (name in displayTypeNames) {
    displayType[name] = Boolean(document.getElementById("typeMenu" + name).getAttribute("checked"));
  }
  for each (name in permissionForComNames) {
    if (document.getElementById("permissionMenuCom" + name).getAttribute("checked")) {
      permissionForCom = name;
      break;
    }
  }
  for each (name in permissionForModNames) {
    if(document.getElementById("permissionMenuMod" + name).getAttribute("checked")) {
      permissionForMod = name;
      break;
    }
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var searchKeyword = "";
    for (var j = 0; j < searchAttributes.length; j++) {
      searchKeyword += item.getAttribute(searchAttributes[j]).toLowerCase() + " ";
    }
    /* Check whether all keywords matched */
    let match = true;
    for (var j = 0; j < terms.length; j++) {
      if (searchKeyword.indexOf(terms[j]) == -1) {
        match = false;
      }
    }
    /* Filter the item */
    if (match) {
      var type = item.getAttribute("ccmctype");
      var licensePart = item.getAttribute("license_part");
      var filterMatch = false;
      if ((
           (displayType["Image"] && type == "dcmitype:StillImage") ||
           (displayType["Audio"] && type == "dcmitype:Sound") ||
           (displayType["Video"] && type == "dcmitype:MovingImage")
          ) && (
           (permissionForCom == "NotFiltered") ||
           (permissionForCom == "Allowed" && !/nc/.test(licensePart)) ||
           (permissionForCom == "Denied" && /nc/.test(licensePart))
          ) && (
           (permissionForMod == "NotFiltered") ||
           (permissionForMod == "Allowed" && !/(?:sa|nd)/.test(licensePart)) ||
           (permissionForMod == "ShareAlike" && /sa/.test(licensePart)) ||
           (permissionForMod == "Denied" && /nd/.test(licensePart))
          ))
      { filterMatch = true; }
      item.hidden = !filterMatch;
    } else {
      item.hidden = true;
    }
  }
  /* Update item label */
  var typeStringComponents = [];
  if (displayType["Image"]) { typeStringComponents.push(document.getElementById("typeMenuImage").label); }
  if (displayType["Audio"]) { typeStringComponents.push(document.getElementById("typeMenuAudio").label); }
  if (displayType["Video"]) { typeStringComponents.push(document.getElementById("typeMenuVideo").label); }
  document.getElementById("typeMenuButton").label = typeStringComponents.join(", ");

  var permissionStringComponents = [];
  var permissionComLabel = document.getElementById("permissionMenuCom" + permissionForCom).label;
  if (permissionForCom != "NotFiltered") permissionStringComponents.push(permissionComLabel);
  var permissionModLabel = document.getElementById("permissionMenuMod" + permissionForMod).label;
  if (permissionForMod != "NotFiltered") permissionStringComponents.push(permissionModLabel);
  if (permissionStringComponents.length > 0) {
    document.getElementById("permissionMenuButton").label = permissionStringComponents.join(", ");
  } else {
    document.getElementById("permissionMenuButton").label = document.getElementById("permissionMenuComNotFiltered").label;
  }
};

collection.onItemSelected = function(obj) {
  /* Update the information <groupbox> */
  var item = obj.selectedItem;
  if (!item) { return; }
  document.getElementById("mediaInfoURL").value = item.getAttribute("url");
  document.getElementById("mediaInfoTitle").value = item.getAttribute("title");
  document.getElementById("mediaInfoOriginalTitle").value = item.getAttribute("original_title");
  document.getElementById("mediaInfoAttributionName").value = item.getAttribute("attribution_name");
  document.getElementById("mediaInfoAttributionURL").value = item.getAttribute("attribution_url");
  if (item.hasAttribute("licensethumbnail")) {
    document.getElementById("mediaInfoLicenseImage").setAttribute("src", item.getAttribute("licensethumbnail"));
  }
  if (item.hasAttribute("thumbnail")) {
    document.getElementById("mediaInfoImage").style.backgroundImage = "url('" + item.getAttribute("thumbnail") + "')";
  }
};

/* Open an URL in a new tab when clicking the URL address */
collection.openURL = function(url) {
  /* Use nsIWindowMediator to get mainWindow and gBrowser */
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);  
  var mainWindow = wm.getMostRecentWindow("navigator:browser");  
  /* Set referrer to make tab opened position smart */
  mainWindow.gBrowser.selectedTab = mainWindow.gBrowser.addTab(url, mainWindow.gBrowser.currentURI);
};

/* Change item in collection */
collection.changeItem = function() {
  var item = document.getElementById("collectionList").selectedItem;
  if (!item) { return; }
  var id = parseInt(item.getAttribute("ccmcid"), 10);
  if (!id) { return; }
  this.Library.update(id, { title: document.getElementById("mediaInfoTitle").value });
};

/* Remove from collection: prompt, ask to remove */
collection.removeItem = function() {
  var item = document.getElementById("collectionList").selectedItem;
  if (!item) { return; }
  var id = parseInt(item.getAttribute("ccmcid"), 10);
  if (!id) { return; }
  /* Confirm dialog */
  var strings = document.getElementById("ccmc-strings");
  var result = this.Services.prompt.confirm(null, strings.getString("alertRemoveTitle"), strings.getString("alertRemoveText"));
  if (!result) { return; }

  this.Library.remove(id);

  /* Clean all items on the right panel */
  document.getElementById("mediaInfoURL").value = "";
  document.getElementById("mediaInfoTitle").value = "";
  document.getElementById("mediaInfoOriginalTitle").value = "";
  document.getElementById("mediaInfoAttributionName").value = "";
  document.getElementById("mediaInfoAttributionURL").value = "";
  document.getElementById("mediaInfoLicenseImage").removeAttribute("src");
  document.getElementById("mediaInfoImage").style.backgroundImage = "";
};

/* Call the Library.jsm to export items to XHTML */
collection.export = function() {
  this.Library.exportToXHTML();
};

/* Generate context menu item right when user right-click on the item */
collection.generateContextMenu = function(aEvent) {
  /* Check for context menu showing */
  if (aEvent.target.id != "libraryItemPopup") {
    return false;
  }
  var selectedItem = document.getElementById("collectionList").selectedItem;
  if (!selectedItem) { return false; }
  
  /* Create context menu, depending on the selected item */
  var popup = document.getElementById("libraryItemPopup");
   
  var menuitems = popup.childNodes;
  for (var i = 0; i < menuitems.length; i++) {
    menuitems[i].hidden = true;
  } 
  
  /* Check if we have the file */
  if (selectedItem.hasAttribute("file")) {
    var file = new this._fileInstance(selectedItem.getAttribute("file"));
    if (file.exists()) {
      document.getElementById("libraryItemPopupOpen").hidden = false;
      document.getElementById("libraryItemPopupOpenFolder").hidden = false;
      document.getElementById("libraryItemPopupSeparator1").hidden = false;
    } else {
      //document.getElementById("libraryItemPopupFetch").hidden = false;
    }
  }
  /* Some required items, hard-coded for now */
  //document.getElementById("libraryItemPopupSeparator1").hidden = false;
  document.getElementById("libraryItemPopupGo").hidden = false;
  document.getElementById("libraryItemPopupCopy").hidden = false;
  document.getElementById("libraryItemPopupSeparator2").hidden = false;
  document.getElementById("libraryItemPopupRemove").hidden = false;
  return true;
}

/* Context menu commands */
collection.popup = {
  open: function(selectedItem) {
    /* Open if the file exists */
    var file = new collection._fileInstance(selectedItem.getAttribute("file"));
    if (!file.exists()) { return; }
    /* Try to do the default action */
    try {
      file.launch();
    } catch(e) {
      /* For *nix, launch() didn't work, so...  */
      /* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
      var fileUri = this.Services.io.newFileURI(file);
      var protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
      protocolService.loadUrl(fileUri);
    }
    
  },
  openFolder: function(selectedItem) {
    /* Open if the file exists */
    var file = new collection._fileInstance(selectedItem.getAttribute("file"));
    if (!file.exists()) { return; }
    try {
      file.reveal();
    } catch(e) {
      /* For *nix, reveal() didn't work, so...  */
      /* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
      var filePathUri = nicofox.Services.io.newFileURI(file.parent);
      var protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
      protocolService.loadUrl(filePathUri);
    }
  },
  go: function(selectedItem) {
    var url = selectedItem.getAttribute("url");
    collection.openURL(url);
  },
  /* Copy the video URL */
  copy: function(selectedItem) {
    var url = selectedItem.getAttribute("url");
    var clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);  
    clipboardHelper.copyString(url);  
  },
  
};

/* A listener to collection's event */
collection.listener = {
  /* When collection item is added */
  add: function(id, info){
    var list = document.getElementById("collectionList");
    var listItem = document.createElement("richlistitem");
    listItem.setAttribute("fetching", "true");
    listItem.setAttribute("progresstype", "undetermined");
    list.insertBefore(listItem, list.firstChild);
    collection.updateItem(listItem, info);
  },
  /* When collection is updated */
  update: function(id, info) {
    id = parseInt(id, 10);
    var listItem = document.getElementById("collectionList").querySelector("richlistitem[ccmcid='" + id + "']");
    if (!listItem) { return; }
    /* Update info if needed */
    if (info.title) {
      listItem.setAttribute("title", info.title);
    }
    if (info.file) {
      listItem.setAttribute("file", info.file);
      listItem.removeAttribute("fetching");
    }
    if (info.thumbnail_file) {
      var thumbnailFile = collection._fileInstance(info.thumbnail_file);
      listItem.thumbnail = collection.Services.io.newFileURI(thumbnailFile).spec;
    }
  },
  /* When collection is updated */
  fetchProgress: function(id, content) {
    id = parseInt(id, 10);
    var listItem = document.getElementById("collectionList").querySelector("richlistitem[ccmcid='" + id + "']");
    if (!listItem) { return; }
    listItem.setAttribute("fetching", "true");
    listItem.setAttribute("progresstype", "determined");
    listItem.setAttribute("currentbytes", content.currentBytes);
    listItem.setAttribute("maxbytes", content.maxBytes);
  },
  /* When collection is removed */
  remove: function(id) {
    id = parseInt(id, 10);
    var listItem = document.getElementById("collectionList").querySelector("richlistitem[ccmcid='" + id + "']");
    if (!listItem) { return; }
    /* Deselect before removing, fix strange selectedItem behavior. */
    document.getElementById("collectionList").removeItemFromSelection(listItem);
    document.getElementById("collectionList").removeChild(listItem);
  }
};
/* Helper: Get a nsILocalFile instance from a path */
collection._fileInstance = Components.Constructor("@mozilla.org/file/local;1", "nsILocalFile", "initWithPath");
