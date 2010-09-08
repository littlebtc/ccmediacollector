var collection = {};

collection.onLoad = function() {
  Components.utils.import("resource://ccmediacollector/Library.jsm");
  Library.getAll(this, "showItems", "dbError");
};
collection.showItems = function(argsArray) {
  var list = document.getElementById("collectionList");
  for (var i = 0; i < argsArray.length; i++) {
    var item = document.createElement("richlistitem");
    var hbox = document.createElement("hbox");
    var titleLabel = document.createElement("label");
    var thumb = document.createElement("image");
    thumb.style.backgroundImage = "url("+argsArray[i].thumbnail_url+")";
    thumb.style.MozBackgroundSize = "85px";
    thumb.height="75";
    thumb.width="75";
    titleLabel.setAttribute("value", argsArray[i].title);
    hbox.appendChild(thumb);
    hbox.appendChild(titleLabel);
    if (argsArray[i].license_url) {
      var vbox = document.createElement("vbox");
      var licensePart = argsArray[i].license_url.match(/\/(by[a-z\-]*)\//);
      if (licensePart) {
        var license = document.createElement("image");
        license.setAttribute("src", "http://i.creativecommons.org/l/"+ licensePart[1] +"/3.0/80x15.png");
        vbox.appendChild(license);
        hbox.appendChild(vbox);
      }
    }
    item.appendChild(hbox);
    list.appendChild(item);
  }
};
collection.dbError = function() {

};
