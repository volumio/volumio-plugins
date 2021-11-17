November 17th 2021


##  For Volumio3


This plugin is designed to apply different type of Dsp on Volumio using [CamillaDsp](https://github.com/HEnquist/camilladsp)


Provides
- A 15 bands graphic equalizer
- Or a 2x15 bands graphic equalizer
- Or a Parametric equalizer with :
    - Up to 50 bands (peaking, lowshelf, highshelf, lowpass, highpass, notch)
    - Equalizer scope for each band (L, R, L+R)
    - More than 3800 variant of headphones EQ from AutoEQ ! [AutoEq](https://github.com/jaakkopasanen/AutoEq)
    - import for local EQ file (must be in /data/INTERNAL/FusionDsp/peq/)
- 3 preset
- Or a convolution filters (FIR) with autoswitch samplerate for filters
    - DRC-FIR to create filter with an impulse

For all 
- Progressive Loudness effect with threshold setting - sort of equal loudness curve
- Auto gain
- Toggle with/without effect
- Separate volume level for left an right
- 4 crossfeed for headphone (Bauer, Chu Moy, Jan Meier, Linkwitz)
- Mono / stereo toggle
- High quality resampling
- tools to easily plays test files (pink noise, sweep) to help measurments 

For PEQ equalizer, while importing file, you can add or replace values to EQ the setting.
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

For FIR, supported filters format

```
text- 32/64 bits floats line (.txt) in rephase
FLOAT_LE- 32 bits floating point (.pcm)
FLOAT64_LE- 64 bits IEEE-754 (.dbl) in rephase
Wav Files are automatically converted in RAW format to be used
```

Some screenshots

![Alt text](select-dsp.png?raw=true "Select Dsp")

![Alt text](15.png?raw=true "15 bands graphic")

![Alt text](2x15.png?raw=true "2x15 bands graphic")

![Alt text](peq.png?raw=true "Parametric Eq")

![Alt text](fir.png?raw=true "FIR")

![Alt text](resampling.png?raw=true "Resampling")

![Alt text](autoeq.png?raw=true "AutoEq selection")

![Alt text](localimport.png?raw=true "Rew import")

![Alt text](preset.png?raw=true "preset")

![Alt text](crossfeed.png?raw=true "crossfeed")

![Alt text](tools.png?raw=true "tools")

![Alt text](drc-fir.png?raw=true "drc-fir")

![Alt text](loudnesscurve.png?raw=true "Loudness curve")


## INSTALLATION WARNING

First, you must have a working configuration with volumio.

#
## To install

### 1. Enable SSH and connect to Volumio

To do that, have a look here : [ssh in volumio](https://volumio.github.io/docs/User_Manual/SSH.html)

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/FusionDsp/fusiondsp.zip
mkdir fusion
miniunzip fusiondsp.zip -d ./fusion
cd fusion
volumio plugin install
cd ..
rm -Rf fusion*

```

### 3. Using the plugin

In webUI, enable the plugin.

## What is working :

nearly everythings ;-)


## What is not working :
?
- 

### 4. Last changes

November 17th 2021

- max frequuency is now 22049Hz

November 14th 2021

- tools album art
- mpdignore peq
- tools source path

November 13th 2021

- Output is now S32LE instead of S24LE3 to support Allo kali reclocker

November 10th 2021

- code cleaning

October 29th 2021

- RPI Zero insttall correction

October 28th 2021

- RPI Zero (to be tested...)

October 23th 2021

- Fix Q value issue with Highshelf2, Lowshelf2
- Lowpass label was missing 

October 17th 2021

- close Modals on all screen
- hw probe for samplerate instead of volumioDsp

October 14th 2021

- DRC-FIR was not installed

October 9th 2021

- resampling only if disabled in playback settings
- publish for amd64

October 2nd 2021

- Do not show Loudness settings if mixer type is None

September 24th 201

- package.json conform for volumio3

September 10th 2021

- CamillaDsp v0.6.3

August 29th

- cosmetic
- correction translation

August 22th 2021

- rounded values in loudness
- fix config first start
- socket off when disabling the plugin

August 21th 2021

- remove toast message when volume level changes
- fix config at first start for EQ15
- alsa contrib - copy plugin -> empty plugin
- Camilla config   chunksize: 8192->  chunksize: 4096

August 2nd 2021

- Fix for UI not loading...
- fiix preset

July 23th 2021

- More values saved in preset

July 13th 2021

- Loudnesss curve almost like equal loudness curve

July 8th 2021

- Loudness curve adjustement
- Fir help

July 7th 2021

- FIR wav files are auto converted in RAW

July 4th 2021

- Fix for Loudness not correctly applied

July 3rd 2021

- New PEQ according to CamillaDsp v 0;5.2
- Fix for settings unsaved when lesssettings was activated
- Updated screenshot

June 28th 2021

- remove some log files
- better Q value for graphic EQ 

June 27th 2021

- Progressiv Loudness
- UI rework

June 21th 2021

- Add mono/streo selector

June 19th 2021

- FIR autiiswitch filter with samplerate
- DRC-fir création
- Tools installation

June 13th 2021

- first version RC1

