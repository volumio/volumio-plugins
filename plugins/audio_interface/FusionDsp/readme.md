June 23th 2021


##  For Volumio3




This plugin is designed to apply different type of Dsp on Volumio using [CamillaDsp](https://github.com/HEnquist/camilladsp)



Provide
- A 15 bands graphic equalizer
- Or a 2x15 bands graphic equalizer
- Or a Parametric eequalizer with :
    - Up to 50 bands (peaking, lowshelf, highshelf, lowpass, highpass, notch)
    - Scope for each band (L, R, L+R)
    - More than 3800 variant of headphones EQ from AutoEQ ! [AutoEq](https://github.com/jaakkopasanen/AutoEq)
    - import for local EQ file (must be in /data/INTERNAM/FusionDsp/peq/)
- 3 preset
- Or a convolution filters (FIR)

For all type
- Auto gain
- Toggle with/without effect
- Separate volume level for left an right
- 4 crossfeed for headphone (Bauer, Chu Moy, Jan Meier, Linkwitz)
- High quality resampling

For PEQ equalizer, while importing file 
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

For FIR, supported filters format

```
text- 32/64 bits floats line (.txt) in rephase
S16_LE- 16 bits LPCM mono (.wav) in rePhase
S24_LE- 24 bits LPCM mono (.wav) in rePhase
S24_LE- 32 bits LPCM mono (.wav) in rePhase
FLOAT_LE- 32 bits floating point (.pcm)
FLOAT64_LE- 64 bits mono (.wav) from Acourate
FLOAT64_LE- 64 bits IEEE-754 (.dbl) in rephase

```

Some screenshots


![Alt text](15.png?raw=true "15 bands graphic")

![Alt text](2x15.png?raw=true "2x15 bands graphic")

![Alt text](peq.png?raw=true "Parametric Eq")

![Alt text](fir.png?raw=true "FIR")

![Alt text](resampling.png?raw=true "Resampling")

![Alt text](autoeq.png?raw=true "AutoEq selection")

![Alt text](localimport.png?raw=true "Rew import")

![Alt text](preset.png?raw=true "preset")

![Alt text](crossfeed.png?raw=true "crossfeed")



## INSTALLATION WARNING

First, you must have a working configuration with volumio.

#
## To install

### 1. Enable SSH and connect to Volumio

To do that, have a look here : [ssh in volumio](https://volumio.github.io/docs/User_Manual/SSH.html)

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/fusiondsp/fusiondsp.zip
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

June 13th 2021

- first version RC1

