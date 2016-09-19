September, 19th 2016
	VOLUMIO SPOTIFY CONNECT PLUGIN

For armv7+ (Rpi 2, Rpi 3, etc, but not Rpi 1/Rpi Zero) devices only for now

This plugin is designed to use Spotify connect web with volumio
Base on this work : https://github.com/Fornoth/spotify-connect-web
Thank you to all developpers !

To start it is a very basic plugin.
It just allow you tou install and configure spotify connect-web in Volumio 2
It will not (for the moment) display album art, title or allow changing track from volumio.
But from a external device and the offcial Spotify app, you'll be able to send your music to your device.

- This version supports Family account : every member can use the device !

- This version includes its own spotify_app_key, so you don't need to get one anymore

To install
- You only need to download volspotconnect.zip
- From Volumio UI choose "plugins" in setting, then "upload plugin" and select the file you have downloaded 

Last changes
- add --dbrange 45 to allow wider range of volume control
- reverse too add mixer settings
- allow complex password containing (&@!;,$)...

Issues : 
- no feed back from UI when settings are saved
- UI only works with English language. So choose English in appearance, set the plugin (credentials) and after you can choose your language. 



