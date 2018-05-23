#       Volumio Onkyo Control Plugin

(Hopefully) A simple plugin that is able to turn an Onkyo receiver on the network on and off when playback begins and ends using eISCP.

https://github.com/tillbaks/node-eiscp

## Features

- Automatically or manually detect compatible Onkyo receivers on the network .
- Send a power on or power off command to an Onkyo receiver when Volumio playback begins or ends.
- Set the volume on the receiver to a set value when Volumio playback begins.
- Delay the power off command to the receiver (to allow for pausing music without shutting down).

## Manual Installation of latest version

1. Enable SSH following the instructions found here:
```
https://volumio.github.io/docs/User_Manual/SSH.html
```
2. Connect via ssh using putty or the command line ```ssh volumio@volumio.local```
3. Download and install the plugin using the following commands:
```
wget https://github.com/orderoftheflame/volumio-plugins/raw/master/plugins/miscellanea/onkyo_control/onkyo_control.zip
mkdir onkyo_control
miniunzip onkyo_control.zip -d ./onkyo_control
cd onkyo_control
volumio plugin install
```
## Settings

![Alt text](settings.jpg?raw=true "Settings and configuration")

## TODO

- [X] Implement power on when starting playback
- [X] Implement power off when stopping playback
- [X] Timeout when powering off (Wait X seconds for state to change to play, or power off)
- [X] Config options (IP / Port with defaults, power off time, output channel)
- [X] I18N
- [X] Manual hostname / ip / port entry
- [X] Discover receivers on the network for config option drop down
- [X] Change receiver volume after power on
- [X] Tidy logging
- [ ] Change receiver to "Line 1" channel (or configured option? Drop down?) after power on
- [ ] Improve host/ip config UI if possible

## Known issues

- [X] ~~Power off on song end~~
- [X] ~~Toast i18n messages not working~~
- [X] ~~Autolocate does not work after an incorrect host/ip has been attempted to be used.~~










