March 30th 2021


##  For Volumio >3.054


#	DSP for Volumio. Based on [CamillaDSP](https://github.com/HEnquist/camilladsp)

It provides :


- A automatic configuration - Just install and enable the plugin. It's ready for use !

- The use of custom filters - for DRC digital room correction.

Supported :

    text- 32/64 bits floats line (.txt) in rephase
    S16_LE- 16 bits LPCM mono (.wav) in rePhase
    S24_LE- 24 bits LPCM mono (.wav) in rePhase
    S24_LE- 32 bits LPCM mono (.wav) in rePhase
    FLOAT_LE- 32 bits floating point (.pcm)
    FLOAT64_LE- 64 bits mono (.wav) from Acourate
    FLOAT64_LE- 64 bits IEEE-754 (.dbl) in rephase

- Specific attenuation for each pair of channels, with detection for the 2 first channels.

- The creation of filter from an impulse

# Special thanks

- Thanks a lot @krunok for your great help and suggestion to design the brutefir version of this plugin. Your knowledge was more than helpful! ;-)



## To install


### 1. Enable SSH and connect to Volumio

To do that, have a look here : [ssh in volumio](https://volumio.github.io/docs/User_Manual/SSH.html)

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/Dsp4Volumio/Dsp4Volumio.zip
mkdir ./Dsp4Volumio
miniunzip Dsp4Volumio.zip -d ./Dsp4Volumio
cd ./Dsp4Volumio
volumio plugin install
cd ..
rm -Rf Dsp4Volumio*
```

### 3. Using the plugin

In webUI, enable the plugin and wait about 20seconds.
A

## What is working :

nearly everythings


## What is not working :
- Does note mute while doing auto clipping detection

### 4. Last changes

March 30th 2021

- clipping detection with output /dev/null

March 28th

- socket io

- autoclipping
- camilladsp config
