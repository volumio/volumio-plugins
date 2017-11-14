november 12th th 2017
	VOLUMIO SPOTIFY CONNECT PLUGIN

IMPORTANT

- Requires a Premium or Family account


IMPORTANT 2

- Now the plugin works with armv6 RPI (previvous to RPI 2) even if just tested on RPI B...And of course with armv7 device (RPI 2, RPI3, Sparky ) 

- Version for armV6 requires a chroot system (11Mo). Installation may be long...10min! Be patient !	

This plugin is designed to use Spotify connect web with volumio
Base on this work : https://github.com/Fornoth/spotify-connect-web
With the great work of ashthespy for the webUI integration!
Thank you to all developpers !

To start, it is a very basic plugin.
It just allow you tou install and configure spotify connect-web in Volumio 2
It will not (for the moment) display album art, title or allow changing track from volumio.
But from a external device and the offcial Spotify app, you'll be able to send your music to your device.

- This version supports Family account : every member can use the device !


To install
- You only need to download volspotconnect.zip. Take care to download the "raw" file, not only html from github...
- From Volumio UI choose "plugins" in setting, then "upload plugin" and select the file you have downloaded
- First start may take several seconds, especially with armv6 because the chroot structure is built a this moment. 

Last changes

November 14th

fix for jack output (maybe hdmi ?)

November 12th

possible fix for some dac / board (kali+piano)
correction for UI not login after install

November 11th

correction for no sound for arm6 (rpi 0 rpi B)
correct display for sample rate
works with volspimpleequal and softvol

November 8th

use of speexrate for resampling
force sample to 44100Hz
fix for the issue when changing user thanks to : https://github.com/markubiak and https://github.com/ashthespy

November 7th

correction
possible fix for the no sound problem...

October 8th

Now works with volsimpleequal and brutefir plugin

September 30th

GReat improvement : info title album artist album art in webUI! Thanks ashthespy!
warning webUI buttons not operationnal (yet)!
solved some problem with armv7 version ( mixer error )

June 17th 2017

merged PR from Saiyato

Febuary 5th

Better translation for help tips

January 27th

add support for aarch64 cpu (odroid c2)
reverse - escape special characters in password - because it does not work in some case. Need to investigate

January 26th

Merge branch 'petternorman-master' volspotconnect - escape special chars in password

January 14th

change in install (downloaded files location) are nox in /tmp
remove redondant message in webUI 

December 27th

autoconfig mixer_device_index from alsa setting

December 24th

ver1.5.5 seems to works with software mixer !!!!

add missing alsa mixer in chroot package

December 23th

correction for some case of dac/mixer setting - ! something is broken with softvol ! 

December 21th

Fix the problem when no mixer is selected ("none" setting) 

December 19th

Chroot Version Revert some file removing... Should be solved : laggy sound, unworking plugin with softvol, unworking plugin....

December 18th

Correction for in volspotconnectchroot.tar.xz Fails to work due to a missing file

December 16th

New cleanup to reduce packages size

December 15th

new volspotconnectchroot.tar.xz with new sorting and new compression : 11Mo !!! ( 180Mo at the begining)

December 13th

Thanks to a drastic sorting, Volspotconnectchroot.tar.gz in now 55Mo ! (prévious was 180Mo )

December 11th

correction for low bitrate

December 8th

new repo (github) to store package
Change in avahi config. Share device should be seenable by any user on the local network

November 30 th

changes in install
chroot version should uninstall properly now ( without braking volumio)

November 27 th

change output hw in plughw
copy asound.conf in chroot /etc in case of software mixer

November 26 th

desinstall now remove configuration file
remove x bit on volspotconnect.service chroot

November 20th

- change to suppport mixer name with space

October 24 th

- update readme

October 21th

- work on install script - a special service is used for rpi1

October 20th

- properly stop chroot system with RPI 1

October 18th

- uncomment avahi installation in install script

October 17th

- correction in install script

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

- Software mixer support
- now the plugin is automatically updated when output or device or device name is changed in volumio

Issues : 

- wrong music speed on some usb dac
- some problem to uninstall plugin with armv6 devices if plugin not disabled before uninstall


Todo

- Add album art and working button in volumio UI
