October, 16th th 2016
	VOLUMIO SPOTIFY CONNECT PLUGIN

IMPORTANT

- Requires a Premium or Family account
- Requires a Family account to use Family shared device

IMPORTANT 2

- Version for armV6 requires to download a large file (180Mo). It is long and installation is very long...25min! Be patient !	

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

October 16th

- install script now return a error if download lib failed

October 14th

- correction for software mixer

October 13th

- correction in install.sh
- armv6 now supported !

October 12th

- Support for armv6l ( rpi B, B+) - but fails to install...
- spotify connect lib are downloaded from volumio repo

October 8th

- correction mixer_device_index

October 7th

- new work in case of software mixer or No mixer - seems to work ;-)
- mod in volspotconnect.service (set user as root) (useful for a next release suppporting RPI 1 and ZERO !

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

- wrong music speed on some usb dac

Todo

- Add album art and working button in volumio UI
- support for Rpi <2