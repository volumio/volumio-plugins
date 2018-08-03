03rd August 2018
#	VOLUMIO PARAMETRIC EQUALIZER

This plugin is designed to provide a parametric equalizer to Volumio.
It uses caps ladspa plugin
http://quitte.de/dsp/caps.html#EqFA4p


![Alt text](parametric-equalizer.jpg?raw=true "Parametric Equalizer")

![Alt text](parametric-equalizer-ranges-setting.jpg?raw=true "Parametric Equalizer ranges setting")

## NOT compatible with softvol or volstereo2mono !

## How to install

### 1. Enable SSH and connect to Volumio

To do that, have a look here :

https://volumio.github.io/docs/User_Manual/SSH.html


### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/volparametriceq/volparametriceq.zip
mkdir ./volparametriceq
miniunzip volparametriceq.zip -d ./volparametriceq
cd ./volparametriceq
volumio plugin install
```
If the installation fails, remove all file (if any) related to the plugin before retry.

### 3. Enable the plugin

In volumio webUI, go in plugin section and enable it!

## Tested on :
RPI2
PINE64
x86 (virtual)
RPI0

### 4. To do list



...


## Last changes

03rd August

- correction in index.js

02nd August 2018

- startup volume is restored

17th June 2018

- new pictures for readme.md
- small typo correction for strings_fr.json

16th june 2018

- fix install problem for aarch64 and armv7l

15th June 2018

- add a button to restore default settings

13th June 2018

- cosmetic...

10th June  2018

- customisable frequencies and step for each band

29th May

- support for armv6 (rpi0 rpi B). Thank you https://github.com/PieVo !

08th April
- first support for x86

31th january
- gainstep is now 0.1dB


30th January 18
- more precise step for more precise settings....

02nd January 18
- update readme.md

28th december 17
- move switch to the bottom of the page

27th december 17

- correction for unsaved parameter for mid high db
- change index.js for autoconfig
- switch to enable /disable eq

09th december 17

- localization

03rd december 17
- update readme

29th november 17
- second commit (cosmetic)
- first commit
