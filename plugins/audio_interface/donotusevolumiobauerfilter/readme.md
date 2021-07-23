August 22th 2020
## beta version for modular_alsa ! do not use!

#	VOLUMIO BAUER FILTER PLUGIN


This plugin is designed to provide Bauer filter to Volumio with custom setting and 3 preset.
It use bs2b-ladspa plugin
More info : http://bs2b.sourceforge.net/

## NOT compatible with softvol or volstereo2mono or equlizer !

![Alt text](volbinaural1.jpg?raw=true "My setting")
![Alt text](volbinaural2.jpg?raw=true "Preset")

## How to install

### 1. Enable SSH and connect to Volumio

To do that, have a look here :

[ssh in volumio](https://volumio.github.io/docs/User_Manual/SSH.html)


### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/volumiobauerfilter/volbinauralfilter.zip
mkdir ./volbinauralfilter
miniunzip volbinauralfilter.zip -d ./volbinauralfilter
cd ./volbinauralfilter
volumio plugin install
cd ..
rm -Rf volbinauralfilter*
```

If the installation fails, remove all file (if any) related to the plugin before retry.

### Enable the plugin

Enable the plugin and wait about 10 seconds

### Last change

22th december 2018

- small correction in install.sh

16th May 2018

- add preset
- update readme

27th november

- translation
- switch to enable/disable filter

24th november 17

- first commit



