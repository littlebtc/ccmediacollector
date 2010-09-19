var collection = {};

/* Page loading */
collection.onLoad = function() {
  Components.utils.import("resource://ccmediacollector/Library.jsm");
  Library.getAll(this, "showItems", "dbError");
};
/* Display items after get items asynchrously */
collection.showItems = function(argsArray) {
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
}
collection.removeItem = function() {
}
