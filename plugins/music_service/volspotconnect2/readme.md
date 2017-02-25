Febuary 25th 2017
	VOLUMIO SPOTIFY CONNECT 2 PLUGIN

This new version use librespot https://github.com/plietar/librespot
If it works as expected, it will remplace volspotconnect
It is just a prototype, and may not work as expected


IMPORTANT

- Requires a Premium or Family account

To install
- You only need to download volspotconnect2.zip. Take care to download the "raw" file, not only html from github...
- From Volumio UI choose "plugins" in setting, then "upload plugin" and select the file you have downloaded

Last changes

Febuary 25th

new librespot library.
support x86 arch
cache written in /tmp

Febuary 19th

cache is now written in /dev/shm to preserve sd card
better global responsivness
better handling multi users

Febuary 17th
correction when switching users

Febuary 16th

correction in remove.sh
correction volspotconnectpurgecache.service
correction onstart

Febuary 15th

New librespot libirary
Cache is now set to 64Mo with auto purge
  
Febuary 11th

New librespot version

January 25th

volumio is set on pause when start playing
add volspotconnect22.service

January 24th

fix drop when stop playing
allow multiple accounts

January 22th

crendetials autoremove when stop playing : discovery mode ok


January 21th

fix output device
try to autoremove credentials at stop
new work - first almost working plugin
remove x bit on service

January 20th

- First commit

Issues : 

Todo

- Add album art and working button in volumio UI
