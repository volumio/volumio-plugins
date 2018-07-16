16th july 2018
#	VOLUMIO GENERAL RESAMPLING PLUGIN


This plugin is designed to resample all source of music send to volumio
It uses alsa speex resampler.

## NOT compatible with softvol or volstereo2mono or equalizer !



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
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/volgrp/volgrp.zip
mkdir ./volgrp
miniunzip volgrp.zip -d ./volgrp
cd ./volgrp
volumio plugin install
```
If the installation fails, remove all file (if any) related to the plugin before retry.

### Enable the plugin

# Do not enable resampling in Volumio with this plugin

Enable the plugin and wait about 10 seconds

### Last change

16th July 2018

- better handling for i2s dac... (maybe)

08th july 2018

- add bitdepth

07th july 2018
- second commit - seems to work

06th July 18
- first commit - not working plugin yet....
