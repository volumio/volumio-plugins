October, 3rd th 2016
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

October 3rd

- remove useless node modules
- clean code

October 2nd

- work to remove mixer settings if no mixer in volumio. Should help with hifiberry digi+ 
- correct output device

October 1st

- volspotconnect is now managed as a systemctl service
- add switch to enable/ disable family share 

Previous changes...

- future software mixer support
- now the plugin is automatically updated when output or device or device name is changed in volumio

Issues : 

- complex password works, but are not saved properly in config.json
- wrong music speed on some usb dac

Todo

- Add album art and working button in volumio UI
