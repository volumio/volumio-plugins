May 7th April 2017
	BRUTEFIR PLUGIN

DO NOT USE ANYMORE.
USE BRUTEFIR2 PLUGIN INSTEAD : https://github.com/balbuze/volumio-plugins/tree/master/plugins/miscellanea/brutefir2

This plugin is designed to use brutefir with volumio2

It will provide :
- A automated installation
- A loopback device setting for alsa

- The use of custom filter - for DRC digital room correction

- A multiband equalizer
	with gain for each band
	with phase setting for each band (not implemented yet)
- A stereo to binaural filtering using BAUER alsa ladspa plugin

Path for filters (left and right) will be set through webUI and stored in a file.
They will be used each time brutefir start

Setting of equalizer will be set through webUI and store in a file
They will be used each time brutefir start and change in setting in webUI will send a command to brutefir to apply the change in "live".
This command will be sent with a telnet command.
For example, changing the setting of 5db the 250Hz will send a "lmc eq 0 mag 250/5" command.

Base scheme

[volumio]--->[Loopback]--->[Brutefir]--->[output /DAC]

- What is working :

Sound if I/O is in brutefir config is correctly set. (could work by saving advanced settings) 
Access to webUI and save configuration
Binaural filtering if correct output set... 
Use of personnal filter (just drop your filter in /INTERNAL/brutefirfilters and fill the field in brutefir plugin advanced settings) 

- What is not working :

No change in sound when setting equalizer
Equalizer appears on several line / label are unreadable


- Last changes

1st May

add return libQ.resolve(); in index.js

26th April

toast messages

7th April

corrected a variable undeclared that hanged the plugin

2nd April 2017
correction bauer

1st April 2017

re-enable Bauer binaural

before...

just to update brutefir.zip

correction in output selector

new way for filter size calculation

Small correction in default output value

Add a output selector !

indication in webUi

software volume control is now working !* WITH DEV VERSION
disbled bauer because onfilct with soft vol
add new filter for testing

correction in index.js
remove useless node modules

- INSTALLATION WARNING 
If you want to test, just download brutefir.zip file and install it through volumio plugin management UI. You have to reboot after installation so that Loopback module is loaded, select Loopback as output device in volumio playback options and then go to advanced settings in Brutefir plugin change the output to your DAC and save.
If no sound, you can check if brutefir service is working in a ssh terminal "systemctl status brutefir". 

To be continued ;-)

To do list (not exhaustive and not in order)

- file selector for filter file (as for background) - it will save files in /data/configurations/miscellanea/brutefir/ folder
- Several profil for equalizer (pre-set or user pre-set) with naming like rock classical, jazz etc...
- This plugin should be rename as "Volumio DSP center" as it include other filtering than brutefir...
- ....