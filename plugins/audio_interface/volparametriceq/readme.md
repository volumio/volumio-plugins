29th May 2018
#	VOLUMIO PARAMETRIC EQUALIZER

This plugin is designed to provide a parametric equalizer to Volumio.
It uses caps ladspa plugin
http://quitte.de/dsp/caps.html#EqFA4p


![Alt text](volparametriceq.jpg?raw=true "Parametric Equalizer")

## NOT compatible with softvol or volstereo2mono !

## How to install

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
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/volparametriceq/volparametriceq.zip
mkdir ./volparametriceq
miniunzip volparametriceq.zip -d ./volparametriceq
cd ./volparametriceq
volumio plugin install
```
If the installation fails, remove all file (if any) related to the plugin before retry.

## Tested on :
RPI2
PINE64
x86 (virtual)
RPI0


## Last changes

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
