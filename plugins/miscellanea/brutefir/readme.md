May 8th April 2017
	BRUTEFIR2 PLUGIN



This plugin is designed to use brutefir with volumio2

It provides :
- A automated installation
- A loopback device setting for alsa

- The use of custom filters - for DRC digital room correction

- A multiband equalizer
	with gain for each band
	several equalizer preset such as loudness, bass, voice, rock, flat

- A stereo to binaural filtering using BAUER alsa ladspa plugin

Path for filters (left and right) will be set through webUI and stored in a file.
They will be used each time brutefir start

Setting of equalizer will be set through webUI and store in a file
They will be used each time brutefir start and change in setting in webUI will send a command to brutefir to apply the change in "live".
This command will be sent with a telnet command.
For example, changing the setting of 5db the 250Hz will send a "lmc eq 0 mag 250/5" command.

Base scheme

[volumio]--->[Loopback]--->[Brutefir]--->[output /DAC]



- INSTALLATION WARNING 
If you want to test, just download brutefir.zip file and install it through volumio plugin management UI. 
You have to reboot after installation so that Loopback module is loaded, select Loopback as output device in volumio playback options. Go to advanced settings in Brutefir plugin change the output to your DAC and save.
When you first enable the plugin, the webUI restart beceause the plugin can't connect to brutefir, cause it is not configured. To do that go to advanced settings in Brutefir plugin change the output to your DAC and save.

- What is working :

Sound if I/O is in brutefir config is correctly set. (could work by saving advanced settings) 
Gain Equalizer
Access to webUI and save configuration
Binaural filtering if correct output set... 
Use of custom filter (just drop your filter in /INTERNAL/brutefirfilters and fill the field in brutefir plugin advanced settings) 

- What is not working :

Bauer filter may conflict with softvol
To use with i2s dac, it require some tweak in volumio, let me know if you need help for this point
Can't use hardware volume control of the dac because volumio can't do that (yet).
Equalizer appears on several lines
setting for equalizer are not restored in the UI, even if correct values are sent. 

- Last changes

8th


- better handling for output "audiojack" and "hdmi"
- handling for error connection to deamon - not ok....

7th

- update readme.md

6th

- add eq profiles

5th May

- remove brutefir rti index in console

3rd May

- small UI change

2nd May

- working gain equaliser when saving settings (but values not restored....)

- new work on index.js gain is working when enabling/ disabling plugin....

1st May

- new write of index.js

To be continued ;-)

To do list (not exhaustive and not in order)

- file selector for filter file (as for background) - it will save files in /data/configurations/miscellanea/brutefir/ folder


- ....