/* vim: sw=2 ts=2 sts=2 et filetype=javascript
*/

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "ContentSniffer" ];

let ContentSniffer = {};

/* In the future, we will have a manager to manager these... */
ContentSniffer._supported = [
  {
    regex: /^http\:\/\/www\.flickr\.com\/photos\/[^\/]+\/[0-9]+/,
    file: "flickr.js"
  },
  {
    regex: /^http\:\/\/(?:www\.)?vimeo\.com\/[0-9]+$/,
    file: "vimeo.js"
  },
  {
    regex: /^http\:\/\/soundcloud\.com\//,
    file: "sondcloud.js"
  }
];

/* Load necessary information from a page.
 * @param  document document object for the page.
 * @return A hash of loaded information.
 */
ContentSniffer.readFromPage = function(document) {
  var count = ContentSniffer._supported.length;
  for (var i = 0; i < count; i++) {
    if (document.location.href.search(this._supported[i].regex) != -1) {
      if(i == 0) { /* Flickr-related code */
        var url = document.location.href;
        /* Avoid /sizes/ pages */
        if (url.search(/sizes/) != -1) { return; }
        /* Cleaning URL: Remove trailing slash, filter out /in/xxxx URLs. */
        if (url.search(/\/$/) == -1) { url += "/"; }
        url = url.replace(/(^http\:\/\/www\.flickr\.com\/photos\/[^\/]+\/[0-9]+\/)(.*)$/, "$1");

        /* Fetch the license */
        var license = "";
        var licenseNode = document.querySelector("a[rel~='license']");
        if (licenseNode) {
          /* As Flickr appends deed.xx on rel="license" link, remove it if needed */
          license = licenseNode.href.replace(/\/[^\/]+$/, "/");
        } else {
          /* Workaround for self photo license tag */
            var licenseNode = document.querySelector(".license-setting a[href^='http://creativecommons.org/licenses']");
            if (licenseNode) { license = licenseNode.href.replace(/\/[^\/]+$/, "/"); }
        }
        /* Do nothing for non-CC-licensed Flickr photos */
        if (!license) { return; }

        /* Fetch other information */
        var attributionNode = document.querySelector(".username > a");
        var attributionName = attributionNode.textContent;
        var attributionUrl = attributionNode.href;
         
        var titleNode = document.querySelector("h1[property='dc:title']");
        var title = titleNode.textContent;
        
        var thumbnailNode = document.querySelector("link[rel='image_src']");
        var thumbnail = thumbnailNode.href;

        return { url: url, license_url: license, title: title, original_title: title, attribution_name: attributionName, attribution_url: attributionUrl, original_url: null, thumbnail_url: thumbnail, type:"dcmitype:StillImage"};
      } else if (i == 1) { /* Vimeo-related code */
        var url = document.location.href;
        
        /* Check if we can fetch the license *AND* download the video. 
           (So user may need to have an account to get the video.) */
        var licenseNode = document.querySelector(".vid_info a[href^='http://creativecommons.org/licenses']");
        var downloadNode = document.querySelector(".download > a[href^='/download']");

        if (!licenseNode || !downloadNode) { return; }
        var license = licenseNode.href;
        /* Fetch other information */
        var attributionNode = document.querySelector(".byline > a");
        var attributionName = attributionNode.textContent;
        var attributionUrl = attributionNode.href;
         
        var titleNode = document.querySelector("div.title");
        var title = titleNode.textContent;

        /* Get thumbnail in a very bad way (not using API) */
        var thumbnailNode = document.querySelector("#brozar_current_clip img");
        var thumbnail = thumbnailNode.src;

        /* Get original video URL */
        var original_url = downloadNode.href;
        return { url: url, license_url: license, title: title, original_title: title, attribution_name: attributionName, attribution_url: attributionUrl, original_url: original_url, thumbnail_url: thumbnail, type:"dcmitype:MovingImage"};
      } else if (i == 2) { /* SoundCloud code */
        var url = document.location.href;
        /* Don't do anything if it is not a track. */
        if (document.body.hasAttribute("id") && document.body.getAttribute("id") != "tracks") {
          return;
        }
        /* Check if we can fetch the license *AND* download the video. 
           (So user may need to have an account to get the video.) */
        var licenseNode = document.querySelector("a[rel='license']");
        var downloadNode = document.querySelector("a.download");

        if (!licenseNode || !downloadNode) { return; }
        var license = licenseNode.href;
        /* Fetch other information */
        var attributionNode = document.querySelector("a[property='cc:attributionName']");
        var attributionName = attributionNode.textContent;
        var attributionUrl = attributionNode.href;
        /* Trim quotes in the title. */
        var titleNode = document.querySelector("span[property='dc:title']");
        var title = titleNode.textContent;
        title = title.substr(1, title.length - 2);

        /* Get thumbnail (or "artwork" in SoundCloud's case) */
        var thumbnail = "";
        var thumbnailNode = document.querySelector(".artwork-download-link > a");
        if (thumbnailNode) {
          var thumbnail = thumbnailNode.href;
        }
        /* Get original video URL */
        var original_url = downloadNode.href;
        return { url: url, license_url: license, title: title, original_title: title, attribution_name: attributionName, attribution_url: attributionUrl, original_url: original_url, thumbnail_url: thumbnail, type:"dcmitype:Sound"};
        
      }
    }
  }
  
};

