/* vim: sw=2 ts=2 sts=2 et filetype=javascript
*/

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "ContentSniffer" ];

let ContentSniffer = {};

/* In the future, we will have a manager to manager these... */
ContentSniffer._supported = [
  {regex: /^http\:\/\/www\.flickr\.com\/photos\/[^\/]+\/[0-9]+/}
];

/* Load necessary information from a page.
 * @param  document document object for the page.
 * @return A hash of loaded information.
 */
ContentSniffer.readFromPage = function(document) {
  var count = ContentSniffer._supported.length;
  for (var i = 0; i < count; i++) {
    if (document.location.href.search(this._supported[i].regex) != -1) {
      if(1/*Flickr code */) {
        /* Avoid /sizes/ pages */
        if (document.location.href.search(/sizes/) != -1) { return; }

        /* Fetch the license */
        var license = "";
        var licenseNode = document.querySelector("a[rel~='license']");
        if (licenseNode) {
          /* As Flickr appends deed.xx on rel="license" link, remove it if needed */
          license = licenseNode.href.replace(/\/[^\/]+$/, "/");
        }
        /* Fetch other information */
        var attributionNode = document.querySelector(".username > a");
        var attributionName = attributionNode.textContent;
        var attributionUrl = attributionNode.href;
         
        var titleNode = document.querySelector("h1[property='dc:title']");
        var title = titleNode.textContent;
        
        var thumbnailNode = document.querySelector("link[rel='image_src']");
        var thumbnail = thumbnailNode.href;
        return { license: license, title: title, attributionName: attributionName, attributionUrl: attributionUrl, thumbnail: thumbnail};
      }
    }
  }
  
}
