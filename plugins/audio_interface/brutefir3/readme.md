28th October 18


#	BRUTEFIR3 PLUGIN



This plugin is designed to use brutefir with volumio2

It provides :
- A automated installation
- A automatic configuration - Just install and enable the plugin. It's ready for use !

- The use of custom filters - for DRC digital room correction

### use 32/64 bits floas lines (.txt) format from rephase

- Filters (left and right) will be set through webUI by giving the name of the file to use.



Base scheme

[volumio]--->[Loopback]--->[Brutefir]--->[output /DAC]


## INSTALLATION WARNING 

First, you must have a working configuration with volumio, the dac you want to use and the mixer properly set.

## To install
Before intalling the dev version, REMOVE, if exists, the plugin from your system using the webUI plugins page.

Due to a [Volumio decision](https://volumio.org/forum/require-plugins-uploaded-plugins-repo-t8116-10.html), now third party or dev plugin can only be install through SSH. Here is how:

### 1. Enable SSH and connect to Volumio

To do that, have a look here :

https://volumio.github.io/docs/User_Manual/SSH.html


### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/brutefir3/brutefir.zip
mkdir ./brutefir
miniunzip brutefir.zip -d ./brutefir
cd ./brutefir
volumio plugin install
```

### 3. Using the plugin

In webUI, enbable the plugin and wait about 20seconds.

Play ! change the equalizer, try demo filters (not very good) by typing their names in left and right filters.
Have look at the wiki : [wiki](https://github.com/balbuze/volumio-plugins/wiki/Howto-for-Volumio-plugins-by-balbuze)

## What is working :
 
nearly everythings 

## What is not working :

- drc with some sample rate / bit depth

### 4. Last changes

28 th October

- remove useless parameters
- filter name with no ext

27th October 18

- rewrite from brutefir2
		remove equalizer
		only txt filter is usable
		...
