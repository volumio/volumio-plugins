## Peppy alsa pipe + peppyMeter for RPI

### for From Volumio buster >= 3.015

source for peppymeter and peppyalsa : [peppy](https://github.com/project-owner)

January 2nd 2021

installation for Volumio

You need alsa_modular activated on volumio

You need touch_display plugin installed



You need modular_alsa enabled
```
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

Now, install the plugin. It may takes several minutes. Wait for it in the UI!


```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/miscellanea/peppyMeter/pipe.zip
mkdir pipe
miniunzip pipe.zip -d ./pipe
cd pipe
volumio plugin install
cd..
rm -Rf pipe*
```
## Does not work (yet) with software volume
