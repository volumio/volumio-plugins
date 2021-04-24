April 24th 2021


##  For Volumio >= 3.054




This plugin is designed to apply a Parametric Eq based on [CamillaDsp](https://github.com/HEnquist/camilladsp)

![Alt text](Parameq4Volumio.png?raw=true "Main interface")
![Alt text](Parameq4VolumioAutoEq.png?raw=true "AutoEq selection")


- Up to 14 bands (peaking, lowshelf, highshelf, lowpass, highpass, notch)
- Auto gain
- Toggle with/without effect
- Scope for each band (L, R, L+R)
- 3 preset
- More than 3400 headphones EQ from AutoEQ ! [AutoEq](https://github.com/jaakkopasanen/AutoEq)


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
