April 5th 2020



__Base scheme - signal path__

[volumio]--->[Loopback]--->[Dsp4Volumio]--->[output /DAC]


## INSTALLATION WARNING

First, you must have a working configuration with volumio, the dac you want to use and the mixer properly set.

## To install

Before intalling the dev version, __REMOVE__, if exists, the plugin from your system using the webUI plugins page and __REBOOT BEFORE INSTALLING__ a new version!

### 1. Enable SSH and connect to Volumio

To do that, have a look here : [ssh in volumio](https://volumio.github.io/docs/User_Manual/SSH.html)

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/Dsp4Volumio/Dsp4Volumio.zip
mkdir ./Dsp4Volumio
miniunzip Dsp4Volumio.zip -d ./Dsp4Volumio
cd ./Dsp4Volumio
volumio plugin install
cd ..
rm -Rf Dsp4Volumio*
```

### 3. Using the plugin

In webUI, enable the plugin and wait about 20seconds.

## What is working :

nearly everythings


## What is not working :

- ?
- mixer is not properly displayed in Volumio's playback option


### 4. Last changes

April 5th 2020

-