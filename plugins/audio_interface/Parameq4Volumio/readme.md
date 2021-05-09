May 9th 2021


##  For Volumio >= 3.054




This plugin is designed to apply a Parametric Eq based on [CamillaDsp](https://github.com/HEnquist/camilladsp)

![Alt text](Parameq4Volumio.png?raw=true "Main interface")
![Alt text](Parameq4VolumioAutoEq.png?raw=true "AutoEq selection")


- Up to 50 bands (peaking, lowshelf, highshelf, lowpass, highpass, notch)
- Auto gain
- Toggle with/without effect
- Scope for each band (L, R, L+R)
- 3 preset
- More than 3800 variant of headphones EQ from AutoEQ ! [AutoEq](https://github.com/jaakkopasanen/AutoEq)
- import for local EQ file (must be in /data/INTERNAM/Parameq4Volumio/)

You can add or replace EQ while importing.
- Select the file for left channel
- choose the scope L
- Choose the mode REPLACE
- Click Import
- choose the file for right channel
- choose the scope R
- chosse the mode ADD
- Click Import

Now EQ are loaded

Datas follow format below (max total 50 bands). Only PK (peaking) filters are imported. From REW, export 'filter settings as text' in Filter tasks tab.

```
Filter 4: ON PK Fc 48.05 Hz Gain -0.70 dB Q 23.967
Filter 5: ON PK Fc 53.10 Hz Gain -7.90 dB Q 3.340
Filter 6: ON PK Fc 57.20 Hz Gain -1.90 dB Q 10.194
Filter 7: ON PK Fc 60.00 Hz Gain -1.70 dB Q 13.930
Filter 8: ON PK Fc 62.30 Hz Gain -1.20 dB Q 22.931
Filter 9: ON PK Fc 133.5 Hz Gain -4.80 dB Q 4.247
Filter 10: ON PK Fc 178.5 Hz Gain 4.10 dB Q 2.002
Filter 11: ON PK Fc 249.0 Hz Gain -2.80 dB Q 8.261

```

## INSTALLATION WARNING

First, you must have a working configuration with volumio.

#
## To install

### 1. Enable SSH and connect to Volumio

To do that, have a look here : [ssh in volumio](https://volumio.github.io/docs/User_Manual/SSH.html)

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/Parameq4Volumio/Parameq4Volumio.zip
mkdir eq
miniunzip Parameq4Volumio.zip -d ./eq
cd eq
volumio plugin install
cd ..
rm -Rf eq
rm Parameq4Volumio.zip
```

### 3. Using the plugin

In webUI, enable the plugin.

## What is working :

nearly everythings


## What is not working :
?
- 

### 4. Last changes

May 9th 2021

- small correction for hide/show settings

May 8th 2021

- complete UI rewrite with no Eq number limmit (but set to 50)

May 5th 2021

- miscellanea fixes for import

May 4th 2021

- Import from local can chain files and scope can be set

May 2nd 2021

- improve import from REW EQ

May 1st 2021

- Add gain setting for for each channel
- Import EQ from local file

April 29th 2021

- improve Eq import from AutoEq for n eq variable

April 24th 2021

- bump to camilladsp 0.5.0-s24test

April 22th 2021

- support for translation + french language

April 21th 2021

- number in front headphones list
- Ui tweaks

April 16th 2021

- preset used is shown until values are changed
- switch to hide values for eq

April 15th 2021

- Gain can be a float

April 14th 2021

- updatable list of headphones

April 10th 2021

- AutoEq profil for headphones

March 26th 2021

- adjustement camilliadasp config

March 24th 2021

- Correction in UI

March 15th 2021

- Small fix in value checking if none

Mars 7th 2021

- preset can be renamed by user

Mars 5th 2021

- improvement in UI
- now the global gain is used when effects are disabled
- new image in readme
- 3 preset!

Mars 4th 2021

- correction for unsaved values
- new setting order to match with REW : Freq, Gain, Q

Mars 2nd 2021

- add buttons to enable/disable effects

Febuary 25th 2021

- install for x86_64

Febuary 24th 2021

- Integrity checking for values in each eq

Febuary 22th 2021

- fix for values not restored in UI
- add notch filter

Febuary 20th 2021

- 14 eq
- adapativ UI

Febuary 19th 2021

- equalizer scope

Febuary 17th 2021

- add lowpass and highpass filters
- attenuation fix

Febuary 15th 2021

- first usable (?) version
- autoset attenuation
- misc fixes

Febuary 12th 2021
- 
