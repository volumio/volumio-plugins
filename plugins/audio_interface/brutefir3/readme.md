December 27th 2018


#	BRUTEFIR3 PLUGIN

This plugin is designed to use [brutefir](https://www.ludd.ltu.se/~torger/brutefir.html) with volumio2

It provides :

- A automated installation

- A automatic configuration - Just install and enable the plugin. It's ready for use !

- The use of custom filters - for DRC digital room correction

To have a idea of what it is, have look here [brutefir plugin wiki](https://volumio.github.io/docs/Plugins_User_Manuals/brutefir/Drc_with_Volumio.html) 

### filters must be 32/64 bits floas lines (.txt) format from rephase

- Filters (left and right) can be selected in webUI.

- A room settings : add a delay on speakers if distance from listener is not equal left/right to keep a good stereo image.

Base scheme

[volumio]--->[Loopback]--->[Brutefir]--->[output /DAC]


## INSTALLATION WARNING 

First, you must have a working configuration with volumio, the dac you want to use and the mixer properly set.

## To install

Before intalling the dev version, REMOVE, if exists, the plugin from your system using the webUI plugins page.

Due to a [Volumio decision](https://volumio.org/forum/require-plugins-uploaded-plugins-repo-t8116-10.html), now third party or dev plugin can only be install through SSH. Here is how:

### 1. Enable SSH and connect to Volumio

To do that, have a look here :

https://volumio.github.io/docs/User_Manual/SSH.html


### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/brutefir3/brutefir.zip
mkdir ./brutefir
miniunzip brutefir.zip -d ./brutefir
cd ./brutefir
volumio plugin install
cd ..
rm -Rf brutefir*
```

### 3. Using the plugin

In webUI, enbable the plugin and wait about 20seconds.

## What is working :
 
nearly everythings 

## What is not working :

- ?
- mixer is not properly displayed in Volumio's playback option

December, 27 th 2018

- small timer adjustement


### 4. Last changes

December, 15th 2018

- fix for impossible to enable plugin

December, 14th 2018

- add room settings

December, 11th 2018

- support version in plugin manager

December, 2nd 2018

- add 176.4kHz sample rate

November, 17th 2018

- ooops in default sample rate

November, 16th 2018

- correction in UI for sample rate

November, 14th 2018

- sample rate are now dislayed in the form XXkHz
- add 88.2kHz samle rate

November, 13th 2018

- add modal message when installing tools

November, 12th 2018

- installable/removable tools

November, 11th 2018

- correct link to wiki

November, 10th 2018

- add a stop button for sweep files
- hidden menu for sweep
- first work for pink noise

November, 9th 2018

- filters selector

November, 5th 2018

- correction for unsaved parameters
- 96000 is the default sample rate now

November, 4th 2018

- add 3 play buttons to play sweep files
- french translation


November, 2nd 2018

- cosmetic in UI
- info  toast message when clicking "download sweep files"
- link to the doc

November, 1st 2018

- add button to wiki
- better translation support
- node_modules cleaning
 
31 th October

- Add a button to download sweep files in /data/INTERNAL/brutefirfilters/sweep

30 th October

- better translation support
- default parameters in config.json

28 th October

- remove useless parameters
- filter name with no ext

27th October 18

- rewrite from brutefir2
		remove equalizer
		only txt filter is usable
		...
