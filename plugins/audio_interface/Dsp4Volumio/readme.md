December 18th 2020


##  Experimental version for modular_alsa - Do not use!!!


#	DSP for Volumio (previously Brutefir3)


This plugin is designed to apply FIR filter to your system. It uses [brutefir](https://www.ludd.ltu.se/~torger/brutefir.html) as convolution engine.

It provides :


- A automatic configuration - Just install and enable the plugin. It's ready for use !

- Hardware capabilities detection for output format and number of channels.

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

- Thanks a lot @krunok for your great help and suggestion to design this plugin. Your knowledge was more than helpful! ;-)

## NEW!

Now the plugin allows a fast and smooth swap between 2 set of filters.

you have to create 2 set of left and right filter according to the following naming convention:

for left XXXX_1.YYY and second filter XXXX_2.YYY

for right ZZZZ_1.YYY and second filter ZZZZ_2.YYY

filters must have the same attenuation, same type.

Then in the plugin,, select filter named with _1. Save, a new button appears to enable swapping!

New automatic clipping detection. Attenuation can be set automatcally. 

First experimental multi channel up to 2x4 !!! with hw detection capabilities of the DAC!

The plugin provide an exclusive feature we called __VoBAF__ : Volume Based Adaptativ Filtering ! Different filters may be applied depending on volume level. With that, it can apply filters such as adaptativ loudness.

- Place all VoBAF filters in the required VoBAFfilters shared directory. Up to 7 filters may be used. ( Low, LM1, LM2, LM3, M, HM, High )

- In webUI select first filter and enable VoBAF. Save, it's done!

- Now, when volume is changed, the plugin switches from a filter to an other smmothly!


The plugin is also able to auto generate filter in few clicks, just using a impluse from REW. To do that, it uses [DRC-FIR](http://drc-fir.sourceforge.net/). It gives very good results in few click!!!

 It will be documented soon!


To have a idea of what it is, have look here [brutefir plugin wiki](https://volumio.github.io/docs/Plugins_User_Manuals/brutefir/Drc_with_Volumio.html)




__Base scheme - signal path__

[volumio]--->[Loopback]--->[Brutefir]--->[output /DAC]


## INSTALLATION WARNING

First, you must have a working configuration with volumio, the dac you want to use and the mixer properly set.

# __ !!!! Does not work with RPI jack output !!!!__

## To install


Before intalling the dev version, __REMOVE__, if exists, the plugin from your system using the webUI plugins page and __REBOOT BEFORE INSTALLING__ a new version!

### 1. Enable SSH and connect to Volumio

To do that, have a look here : [ssh in volumio](https://volumio.github.io/docs/User_Manual/SSH.html)

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/brutefir3/brutefir.zip
mkdir ./brutefir
miniunzip brutefir.zip -d ./brutefir
cd ./brutefir
volumio plugin install
cd ..
rm -Rf brutefir*
```

### 3. Using the plugin

In webUI, enable the plugin and wait about 20seconds.
A reboot is required for HW detection.

## What is working :

nearly everythings


## What is not working :

- ?
- Conf for the output is corrupted if something is saved in mixer settings...


### 4. Last changes

December 18th 2020

- better compatibility with other audio plugin

November 29th 2020

- support for filter length 524288

November 20th 2020

- small fix for DRC

November 16th 2020

- activation VoBAF

November 11th 2020

- fix for DRC filter generation
- new increase for auto attenuation offset (loudness war!!!)
- add HK11 target curve

October 26th 2020

- re HW detection (sample rate/ nbre of channels)

October 24th 2020

- Warning when space in filter name
- Alsa modular layout
- fix for swap filters
- attenutation +1dB if > 0
- sample rate always shown
- close modals on all screen

August 4th 2020

- reset button - useful if output has changed
- tools cleaning

July 5th 2020

- Auto update Db when tools are installed or removed
- New swap demo filters files
- New sweep file for REW beta >55 (may work with prior version)

July 1st 2020

- work on auto conf for output format
- new target curves HK9, HK10

June 23th 2020

- I2s dac at boot

June 22th 2020

- Correction for i2s dac

June 12th 2020

- small correction when resoring volumio config

June 9th 2020

- work on resilience
- work on swap filters

June 5th 2020

- .mpdignore in Dsp folder to avoid scanning filters
- filter length message when detected

May 27th 2020

- remove useless node_modules...

May 24th 2020

- Filter size is now auto set, using file size and type, and vaiable header size for wav file

May 21th 2020

- fix for UI not loading in some case

May 20th 2020

- attenuation is set to 0 if filter is 'None'
- VoBAF is hidden if mixer type is 'None'

May 19th 2020

- possible fix for no library when plugin is enable...

May 18th 2020

- restored output at boot

May 17th 2020

- possible fix with some i2s DAC
- misconfigured DAC after boot in some case
- no clipping test if filter set to 'None'

May 16th 2020

- new handling for mixer - requires Volumo => 2.776
- small fixes
- translation

May 12th 2020

- more translation
- UI behaviour
- readme.md 

May 11th 2020

- work on translation
- new name for output device
- fix for hang with wav file
- fix for empty message box
- better resilience if a file is not found
- miscellanea fixes
- internal naming for path

May 10th 2020

- New work for translation

May 9th 2020

- replace _ by - in file renaming

May 8th 2020

- complete rewriting for tools section, with scrolling list selector
- tools are now played by mpd instead of aplay
- source filter with space in the name are allowed. Space replaced by _
- readme.txt update

May 5th 2020

- fix for swap filters

May 4th 2020

- fix install bug (no filters folder created)
- readme in /Dsp
- translation

May 3rd 2020

- translation - first pass
- new location for Filters in /INTERNAL/Dsp

May 1st 2020

- warning on first use to reboot
- code

April 26th 2020

- fix for dbl files
- fix for clipping detection if playing
- support for FLOAT64_LE wav file from Acourate

April 20th 2020

- correction for tools (missing options)
- tools 'stop to play button' work properly
- UI is now not blinking when refreshed (volumio >2.753)

April 5th 2020

- first version with filter swapping!!!

April 3rd 2020

- clipping detection as an option

April 2nd 2020

- code reorganisation

April 1st 2020

- first version with clipping detection

March 30th 2020

- fix auto filter format regression

March 28th 2020

- code cleaning

March 24th 2020

- now supprts acourate Float64_le wav file
- correction for multi channels

March 23th 2020

- add missing demo filters
- separated attenuation for left and right channels
- code cleaning and modernised...

March 14th 2020

- new UI management when install/remove tools

Febuary 28st 2020

- reverse to 8 partition
- fix for hw outyput format detection
- DRC remove normalization : Warning, clipping may occurs if no attenuation set


Febuary 1st 2020

- add VoBAFfilters
- attenuation step is now 0.5dB
- add HK8 target curve
- remove .rephase in format name
- Use of --PSNormType=S --PSNormFactor=1 to avoid clipping with DRC-fir generation

December 06th 2019

- small tweak for better support for Primo

november 10th 2019

- improved messages for filter type

november 9th 2019

- better handling for auto select filter type

november 7th 2019

- revert simplified UI for output format, waiting hw detect to be reliable....
- new fix for "sPECIAL" output format handling
- case for "None" filter for auto select

november 6th

- new auto format selection for filter. No more need to select it.
- simplified interface

november 4th 2019

- new hw detection for sample rate available on DAC

november 3rd 2019

- drc config order
- revert some hw detection for samplerate as some dac does not returns what expected...

November 2nd 2019

- new hw detection for sample rate. Now only hw supported displayed

October 31 th

- work in UI

October 30 th

- better handling for autoselect output formats (khadas board)
- target curve

October 28th 2019

- miscellaneous change in template file

October 27th 2019

- number of partition is now 32 to reduce latency
- remove -1 process flag and set to 0 and 1 (brutefir multicore handling)
- small code cleaning

October 13th

- update readme.md  

October 12th

- dedicated attenuation for each pair of channels
- correction for filter generation (hang of volumio)
- auto set output format when enabling the plugin
- default format for filter is FLOAT_LE (.pcm)
- correction for pink noise both channels
- adjustement in DRC-FIR to generate filter with no clipping at attenuation=0

October 10th 2019

- fix install for armv7l

October 8th 2019

- small correction in filters list display

October 6th 2019

- 2x4 multi channels
- new hw detection
- Tons of mod....

September 20th 2019

- first multi channel (2x2) - experimental!

July 13th 2019

- correction in VoBAF messages when a filter does not exist.
- M threshold was not saved
- spelling correction

July 10th 2019

- fix VoBAF for right channel
- correction in config for Vobaf filter extension

July 9th 2019

- treshold detection order
- add vobaf format filters
- correction

July 8th 2019

-  correction for VoBAF conditions

July 7th 2019

- add LM3 filter
- add VoBAF attenuation
- correction in VoBAF

July 6th 2019

- new version of VoBAF...

June 29th 2019

- correction in VoBAF

June 27th 2019

- configurable volume point for VoBAF

June 26th 2019

- work on VoBAF

June 25th 2019

- first VoBAF implementation

May 25th 2019

- small fixes in index.js

May 24th 2019

- no "skip" if dirac pulse and wav format

May 19th 2019

- small adjustements with timer...

May 16th 2019

- small code cleaning

May 15th 2019

- set PPType=N for DRC
- change onstart cmde in index.js

May 6th 2019

- minor changes in index...

April 30th 2019

- small change in timer....

April 27th 2019

- code cleaning + comments
- text in UI
- new demo filter + impulse


April 26th 2019

- more warnings in UI
- new work on timers...

April 22th 2019

- warning if sample rate >96kHz for DRC-fir generation
- startup promise
- code cleaning
- update doc

April 19th 2019

- add targeet curve HK5 TY Krunok!
- small cosmetics

April 11th 2019

- remove target-curves and filters-sources from selectable scrolling list
- sweep files in 44.1Khz 16b for better compatibility

April 10th 2019

- add drcconfig

April 7th 2019

- Improvement for file name of generated filter. If field empty, use the name of file to convert.

April 6th 2019

- correction in file name generated for filter

April 5th 2019

- fix no sound at boot time
- Improve UI
- Readme

April 4th 2019

- Tools fix

April 2nd 2019

- new work on filter generation

April 1st 2019

- first version with filter generation using drc

March 29th 2019

- add FLOAT_LE – 32bit floating point (.pcm)

March 25th 2019

- reverse some timer...

March 24th 2019

- better plugin startup promise

March 03rd 2019

- add Factory values for output format sample

Febuary, 28th  2019

- correct default Dirac pulse
- small improvement
- code cleaning

Febuary, 27th  2019

- fix for ouput format selector. Should be ok with ver 0.8.1...

Febuary, 25th  2019

- filter format selector
- first work for output sample format from hw

Febuary, 8th 2019

- internal default input is now s32_le
- default output is now s32_le

Febuary, 5th 2019

- sweep files with timing reft on right channel. (thanks merlin2222 ;-))

Febuary, 2nd 2019

- merge left and right attenuation
- timer adjustement (no idea if it could solve some startup prob...)

December, 27 th 2018

- small timer adjustement

December, 15th 2018

- fix for impossible to enable plugin

December, 14th 2018

- add room settings

December, 11th 2018

- support version in plugin manager

December, 2nd 2018

- add 176.4kHz sample rate

November, 17th 2018

- ooops in default sample rate

November, 16th 2018

- correction in UI for sample rate

November, 14th 2018

- sample rate are now dislayed in the form XXkHz
- add 88.2kHz samle rate

November, 13th 2018

- add modal message when installing tools

November, 12th 2018

- installable/removable tools

November, 11th 2018

- correct link to wiki

November, 10th 2018

- add a stop button for sweep files
- hidden menu for sweep
- first work for pink noise

November, 9th 2018

- filters selector

November, 5th 2018

- correction for unsaved parameters
- 96000 is the default sample rate now

November, 4th 2018

- add 3 play buttons to play sweep files
- french translation


November, 2nd 2018

- cosmetic in UI
- info  toast message when clicking "download sweep files"
- link to the doc

November, 1st 2018

- add button to wiki
- better translation support
- node_modules cleaning

31 th October

- Add a button to download sweep files in /data/INTERNAL/brutefirfilters/sweep

30 th October

- better translation support
- default parameters in config.json

28 th October

- remove useless parameters
- filter name with no ext

27th October 18

- rewrite from brutefir2
		remove equalizer
		only txt filter is usable
		...
