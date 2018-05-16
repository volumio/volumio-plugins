16th May 2018
#	VOLUMIO BAUER FILTER PLUGIN


This plugin is designed to provide Bauer filter to Volumio with custom setting and 3 preset.
It use bs2b-ladspa plugin
More info : http://bs2b.sourceforge.net/

## NOT compatible with softvol or volstereo2mono or equlizer !

![Alt text](volbinaural1.jpg?raw=true "My setting")
![Alt text](volbinaural2.jpg?raw=true "Preset")

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
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/volumiobauerfilter/volbinauralfilter.zip
mkdir ./volbinauralfilter
miniunzip volbinauralfilter.zip -d ./volbinauralfilter
cd ./volbinauralfilter
volumio plugin install
```
If the installation fails, remove all file (if any) related to the plugin before retry.

### Enable the plugin

Enable the plugin and wait about 10 seconds

### Last change

16th May 2018

- add preset
- update readme

27th november

- translation
- switch to enable/disable filter

24th november 17

- first commit



