May 5th April 2017
	BRUTEFIR2 PLUGIN



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
Gain Equalizer
Access to webUI and save configuration
Binaural filtering if correct output set... 
Use of custom filter (just drop your filter in /INTERNAL/brutefirfilters and fill the field in brutefir plugin advanced settings) 

- What is not working :


Equalizer appears on several lines


- Last changes
5th May

- remove brutefir rti index in console

3rd May

- small UI change

2nd May

- working gain equaliser when saving settings (but values not restored....)

- new work on index.js gain is working when enabling/ disabling plugin....

1st May

- new write of index.js


- INSTALLATION WARNING 
If you want to test, just download brutefir.zip file and install it through volumio plugin management UI. You have to reboot after installation so that Loopback module is loaded, select Loopback as output device in volumio playback options and then go to advanced settings in Brutefir plugin change the output to your DAC and save.
If no sound, you can check if brutefir service is working in a ssh terminal "systemctl status brutefir". 

To be continued ;-)

To do list (not exhaustive and not in order)

- file selector for filter file (as for background) - it will save files in /data/configurations/miscellanea/brutefir/ folder
- Several profil for equalizer (pre-set or user pre-set) with naming like rock classical, jazz etc...
- This plugin should be rename as "Volumio DSP center" as it include other filtering than brutefir...
- ....