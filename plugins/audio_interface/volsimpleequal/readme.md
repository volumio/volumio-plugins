10th September 2020


	Volsimpleequal volumio simple equalizer

# A simple 15 bands graphic Equalizer plugin for Volumio2 with preset and 3 cutom preset.


Based on alsaequal [alsaequal](https://github.com/raedwulf/alsaequal)
and mbeq from [mbeq](https://github.com/swh/ladspa)

![Alt text](volsimpleequal.png?raw=true "Equalizer")


Can't work with softvol !!!!

## Requirement

 A working well configured volumio > 2.041

## How to install ?

### 1. Enable SSH and connect to Volumio

To do that, have a look here :

https://volumio.github.io/docs/User_Manual/SSH.html

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/volsimpleequal/volsimpleequal.zip
mkdir ./volsimpleequal
miniunzip volsimpleequal.zip -d ./volsimpleequal
cd ./volsimpleequal
volumio plugin install
```
If the installation fails, remove all file (if any) related to the plugin before retry.

### 3. Enable the plugin

In volumio webUI, go in plugin section and enable it!
## What is working ?

 Install, equalizer settings, presets settings

## What is not working

 May not work with some source / output.


## Last changes

September 11th 2020

- 15 band using mbeq
- new layout for mypreset

7thh July 19

- sliders step is now 0.5

1st August 18

- cleaning code
- readme update

31th July 18

- startup volume properly restored

13th January

- correction for preset saving

20th december

- move to audio_service category

16th december
- miscellanea fixes for autoconfig. Should work for rpi0...

09th december

- localization
- cosmetic improvement...

19th november

- revert (temporary) to alsaequal (10bands) against mbeq (15bands)

18th november

- correction when mypreset are saved (previous overwrited preset)

04th november

- correction in install.sh

03rd november

- redefine sliders ranges from -10/10 step 1 with an offset 60

02nd november

- reduce range of sliders from 0/100 step 5 to 30/70 step 1
- hard preset now stored in config.json

01st November

- now the plugin uses mbeq, a 15 bands equalizer

30th October

- preset setting with sliders in webUI!

29th October

-
- add 3 custom preset in webUI !

10th October

- small timer adjustement for alsaloop bridge to avoid the 'no sound' problem at start time

25th september

- alsaloop run now as a service

24 th september

timer to make it work with last volumio dev 2.279

- change some ti

20th september

- small change to work with last dev version of volumio >2.277

02nd September 17

- correction for "classic" preset
- Now only two Loopback substreams are loaded
- boot priorpity
- more clear naming for output device when plugin is activated

11th August

- more clear naming for output device when plugin is activated
- plugin icon
- update readme
- add a new preset "soundtrack"
- change to better restore volumio initial volume

14th July

- add png in readme

12th July
- small tweak for alsaloop command

07th
- fix for audio jack
- probable fix for miscellaneous formats -> float
- onstop now kills alsaloop
- redefine order in autoconfig

06th
- remove useless node modules
- add comment in index.js
- change loudness values
- preset  scrolling list ok
- code cleaning

05th
- mod timeout settings in index.js
- correct values for presets - but srcolling list not working

04th July
- correction in install.sh

03rd July
- add onStop promise
- plugequal instead of equal

2nd July
- working version ! But Presets non working...

01st July
- nearly working - but output mdp doesn't work
