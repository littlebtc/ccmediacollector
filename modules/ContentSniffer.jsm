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
      return "ok";
    }
  }
  
}
