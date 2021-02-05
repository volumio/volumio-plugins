## Peppy alsa pipe + peppyMeter for RPI

### for From Volumio buster >= 3.015* 

*work with 2.861 if modular_alsa enabled

source for peppymeter and peppyalsa : [peppy](https://github.com/project-owner)

![Alt text](peppymeterinvolumio.jpg?raw=true "PeppyMeter plugin in Volumio")

installation for Volumio

You need alsa_modular activated on volumio

You need touch_display plugin installed



You need modular_alsa enabled
```
cd /volumio
git checkout buster/alsa-pipeline
cd..
cd /volumio
nano .env
```
and change lines
```
WRITE_MPD_CONFIGURATION_ON_STARTUP=true
MODULAR_ALSA_PIPELINE=true
```
and restart
```
volumio vrestart
```

Now, install the plugin. It may take several minutes. Wait for it in the UI!


```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/miscellanea/peppyMeter/pipe.zip
mkdir pipe
miniunzip pipe.zip -d ./pipe
cd pipe
volumio plugin install
cd..
rm -Rf pipe*
```

Febuary 5th 2021

- fix for youtube

Febuary 01st 2021

- enabled features for i2c, pwm, serial

January 12th 2021

- switch to disable/enable serial output

January 10th 2021

- switch to disable/enable local display
- install check if peppyalsa is already installed

January 8th 2021

- fix for softvol
