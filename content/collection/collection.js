var collection = {};

/* Page loading */
collection.onLoad = function() {
  Components.utils.import("resource://ccmediacollector/Library.jsm", collection);
  /* Get all contents */
  this.Library.getAll(this, "showItems", "dbError");
};
/* Display items after get items asynchrously */
collection.showItems = function(argsArray) {
  /* Add Listener */
  this.Library.addListener(this.listener);
  
  var list = document.getElementById("collectionList");
  for (var i = 0; i < argsArray.length; i++) {
    var item = document.createElement("richlistitem");
    item.setAttribute("ccmcid", argsArray[i].id);
    item.setAttribute("title", argsArray[i].title);
    item.setAttribute("url", argsArray[i].url);
    item.setAttribute("attribution_name", argsArray[i].attribution_name);
    item.setAttribute("attribution_url", argsArray[i].attribution_url);
    
    if (argsArray[i].license_url) {
      item.setAttribute("license_url", argsArray[i].license_url);
      var licensePart = argsArray[i].license_url.match(/\/(by[a-z\-]*)\//);
      if (licensePart) {
        var license = document.createElement("image");
        item.setAttribute("licensethumbnail", "http://i.creativecommons.org/l/"+ licensePart[1] +"/3.0/80x15.png");
      }
    }
    list.appendChild(item);
    item.thumbnail = argsArray[i].thumbnail_url;
  }
};
collection.dbError = function() {
  alert("Collection DB Error!");
};
collection.onItemSelected = function(obj) {
  /* Update the information <groupbox> */
  var item = obj.selectedItem;
  document.getElementById("mediaInfoURL").value = item.getAttribute("url");
  document.getElementById("mediaInfoTitle").value = item.getAttribute("title");
  document.getElementById("mediaInfoAttributionName").value = item.getAttribute("attribution_name");
  document.getElementById("mediaInfoAttributionURL").value = item.getAttribute("attribution_url");
  if (item.hasAttribute("licensethumbnail")) {
    document.getElementById("mediaInfoLicenseImage").setAttribute("src", item.getAttribute("licensethumbnail"));
  }
};
collection.changeItem = function() {
  var item = document.getElementById("collectionList").selectedItem;
  if (!item) { return; }
  var id = parseInt(item.getAttribute("ccmcid"), 10);
  if (!id) { return; }
  Components.utils.import("resource://ccmediacollector/Services.jsm", collection);
  this.Library.update(id, { title: document.getElementById("mediaInfoTitle").value });
};
/* Remove from collection: prompt, ask to remove */
collection.removeItem = function() {
  var item = document.getElementById("collectionList").selectedItem;
  if (!item) { return; }
  var id = parseInt(item.getAttribute("ccmcid"), 10);
  if (!id) { return; }
  Components.utils.import("resource://ccmediacollector/Services.jsm", collection);
  /* Confirm dialog */
  var result = this.Services.prompt.confirm(null, "Media Collection", "Are you sure to remove this item from collection?");
  if (!result) { return; }

  this.Library.remove(id);

};
/* A listener to collection's event */
collection.listener = {
  /* When collection is updated */
  update: function(id, info) {
    id = parseInt(id, 10);
    var node = document.getElementById("collectionList").querySelector("richlistitem[ccmcid='" + id + "']");
    if (!node) { return; }
    node.setAttribute("title", info.title);
  },
  /* When collection is removed */
  remove: function(id) {
    id = parseInt(id, 10);
    var node = document.getElementById("collectionList").querySelector("richlistitem[ccmcid='" + id + "']");
    if (!node) { return; }
    node.parentNode.removeChild(node);
  }
};
