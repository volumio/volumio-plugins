Information on New 50 plugin setup

- Icons should be 300x300 PNG files (pick example under music_service/mpd/*.png)
- pretty name is related to name in configuration panel
- i18n in conf files is related to configuration panel not main panel
- to translate string in main panel, edit the file /volumio/app/musiclibrary.js to add an entry point (correponding to the uri in index.js in the plugin directory)
- Add an entry into /volumio/app/i18n/strings_fr.json for your Tile Label name

- To install the plugin use: volumio plugin install
For refreshing after modifications: volumio plugin refresh 
If you forgot the install phase, uninstall the plugin through the UI and edit the file /data/configuration/plugins.json to remove mention of the plugin, then restart volumio.

Debug: look at journalctl -f to see plugin errors
