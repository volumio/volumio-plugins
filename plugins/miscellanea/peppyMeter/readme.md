## Peppy alsa pipe + peppyMeter for RPI

### for From Volumio buster >= 3.054


source for peppymeter and peppyalsa : [peppy](https://github.com/project-owner)

![Alt text](peppymeterinvolumio.jpg?raw=true "PeppyMeter plugin in Volumio")

installation for Volumio


You need touch_display plugin installed


```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/miscellanea/peppyMeter/pipe.zip
mkdir pipe
miniunzip pipe.zip -d ./pipe
cd pipe
volumio plugin install
cd..
rm -Rf pipe*
```
March 13th 2021

- peppy service was not installed


March 12th 2021

- precompiled version of peppyalsa (very fast installation)

Febuary 14th 2021

- better compatibility with high res file

Febuary 6th 2021

- dummy device index=- and one substream
- now creates /tmp/myfifosapeppy

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
