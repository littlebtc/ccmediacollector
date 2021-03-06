CC Media Collector - Firefox addon for media collection
=============

This is a git repository for CC Media Collector. For more information, please check the [Creative Commons Taiwan Wiki](http://wiki.creativecommons.org.tw/cc-media-collector).

Grab an Installable Package from Repository
-------------
After you checked out the repository, you can run the following `zip` command to make an installable XPI file:
    zip -r ccmc.xpi install.rdf chrome.manifest content/ locale/ skin/ components/ modules/

Code Overview for Developer
-------------
The `content` contains `browserOverlay.js` and `browserOverlay.xul`, which provides icon and panel to the browser UI.
`content/collection` contains most of the Media Collection UI, while some WIP part of the &lt;richlistitem&gt; binding is in `content/collection.xml`.

The `module` might be the major part of the application, containing `ContentSniffer.jsm` (to fetch the website information from DOM), `Library.jsm` (SQLite database management for library) and more to come.

The `components` contains `aboutCollection.js` to support `about:colleciton` URL and `bootstrap.js` to initialize database work on `Library.jsm`.

License
-------------
The source codes here are licensed under [GPLv3](http://www.gnu.org/licenses/gpl-3.0.html). It uses some image from [Silk Icons](http://www.famfamfam.com/lab/icons/silk/) by Mark James which is licensed under [CC-BY-2.5](http://creativecommons.org/licenses/by/2.5/).
