May 27th May 2017
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
If you want to test, just download brutefir.zip file and install it through volumio plugin management UI and Enable the plugin !
Set Loopback as output device in volumio playback options. 


- What is working :


Gain Equalizer
Access to webUI and save configuration
Binaural filtering
Use of custom filter (just drop your filter in /INTERNAL/brutefirfilters and fill the field in brutefir plugin advanced settings) 

- What is not working :

Bauer filter may conflict with softvol
To use with i2s dac, it require some tweak in volumio, let me know if you need help for this point
Can't use hardware volume control of the dac because volumio can't do that (yet).
Equalizer appears on several lines


- Last changes

27th

- new work to auto-confgure the plugin and volumio to use brutefir
- brutefir service run as root to allow RT
- fix no sound -

26th

- new work to keep volume control of the dac when using Loopback output
- auto configure input / output

24th

- brutefir errors handling to avoid UI hanging...

22th

- fix the UI
- change default filter lenght to 32768

21th

- revert in UI so that it loads but values are not restored in UI for equalizer - need a fix

20th

- problem to load Ui (not sure it works all the time)
- minimal brutefir config file is created
- some other fixes

19th

- work to modprobe snd_aloop after installation

17th

- value for Bauer are now restored in UI
- first work to auto load snd_aloop when enabling plugin

12th

- big step ahead thanks to the help of Michelangelo ! 
- now values are restored in equalizer !

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