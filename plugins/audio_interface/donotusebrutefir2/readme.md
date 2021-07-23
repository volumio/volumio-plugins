2019 January 19th

# PLEASE DO NOT USE IT. NOT UPDATED!!!

# SEE HERE INSTEAD : [brutefir3](https://github.com/balbuze/volumio-plugins/tree/master/plugins/audio_interface/brutefir3)

































































01st April January 18


#	BRUTEFIR2 PLUGIN



This plugin is designed to use brutefir with volumio2

It provides :
- A automated installation
- A automatic configuration - Just install and enable the plugin. It's ready for use !

- The use of custom filters - for DRC digital room correction

- A 30 bands equalizer (1/3 octave)
	with gain for each band can be set by step of 0.5 (+/-15db)
	several equalizer preset such as loudness, bass, voice, rock, flat etc.. and 3 custom presets.
- Filters (left and right) will be set through webUI by giving the name of the file to use.


![Alt text](volumiobrutefir.png?raw=true "Brutefir plugin settings")


Base scheme

[volumio]--->[Loopback]--->[Brutefir]--->[output /DAC]



## INSTALLATION WARNING 

First, you must have a working configuration with volumio, the dac you want to use and the mixer properly set.

## To install
Before intalling the dev version, REMOVE, if exists, the plugin from your system using the webUI plugins page.

Due to a [Volumio decision](https://volumio.org/forum/require-plugins-uploaded-plugins-repo-t8116-10.html), now third party or dev plugin can only be install through SSH. Here is how:

### 1. Enable SSH and connect to Volumio

For security reasons, SSH is disabled by default on all versions after 2.199 (except first boot). It can be however enabled very easily.

Navigate to the DEV ui by pointing your browser to http://VOLUMIOIP/DEV or http://volumio.local/DEV . Find the SSH section, and click enable. From now on your SSH will be permanently enabled.

Now you can connect to Volumio with username `volumio` and password `volumio`.

```
ssh volumio@volumio.local (if you changed the name of your device, replace the second volumio by it or use its IP address.
```

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/brutefir2/brutefir.zip
mkdir ./brutefir
miniunzip brutefir.zip -d ./brutefir
cd ./brutefir
volumio plugin install
```

### 3. Using the plugin

In webUI, enbable the plugin and wait about 10seconds.

Play ! change the equalizer, try demo filters (not very good) by typing their names in left and right filters.
Have look at the wiki : [wiki](https://github.com/balbuze/volumio-plugins/wiki/Howto-for-Volumio-plugins-by-balbuze)

## What is working :
 

Gain Equalizer
Access to webUI and save configuration
Use of custom filter (just drop your filter in /INTERNAL/brutefirfilters and fill the field in brutefir plugin advanced settings) 

## What is not working :


- Equalizer appears on several lines
- slow to load interface UI (warning in some web browser for script to slow)
- support only file with sample set in advanced settings.
- need to save advanced setting each boot....
- factory preset not functionnal

### 4. Last changes

01st April

- correction in brutefir.conf.tmpl

14th january

- correction for no sound at boot time

13th January

- better translation support
- 3 custom presets

10th January

- move in audio_interface category
- now provide a 30 bands 1/3 octave equalizer
- equalizer range is now 615/+15dB
- code cleaning
- new method to configure to auto config the output

20th October

- update node module
- reference to the wiki in readme.md

18th October

- possible fix with volumio > 2.286
- Loopback loads now only 2 pcm_substream
- code cleaning

21th september

- small change to be compatible with last dev version of volumio >2.277
- pict in readme

11th August

- clearest naming of the output device when the plugin is enabled
- plugin icon 

08 th July

- correct promise onstop

27 th June

- code cleaning

26th June

- snd_aloop dynamically load by the plugin instead of /etc/modules
- no more wrinting in /etc/modprobe.d/alsa-base.conf 

24th June

- working i2s autoconf tested with rpi2 and iqaudio
- still wip on autoconf and still not good...
- first time brutefir config generation

23th June

- new work on autoconf...still not working as expected

17th June

- remove x bit on brutefir.service
- install.sh unload snd_aloop, change index and reload
- index.js work on promises

15 th

- use of promises for synchrone functions

11th

- force loopback index to 7

10th June

- warning if a wrong filter name is given

07th june

- work on i2s dac settings -seems to work. tested with iqaudio

02nd June

- restore initial volumio settings when plugin is disabled
-correction for nosound....

01st June

- full auto conf : just enbale plugin and play ! 
- new filters. Thanks to https://github.com/tomaszrondio

30th may

- save and restore volumio parameters
- Loopback auto set


28th may

- volume control of the dac is now used ! Tested with iqaudio only...
- mkidr demo filters folder properly
- correct install.sh
- correct brutefir.service

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

- file selector for filter file

- ....
