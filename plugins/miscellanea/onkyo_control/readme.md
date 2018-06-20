#       Volumio Onkyo Control Plugin

(Hopefully) A simple plugin that is able to turn an Onkyo receiver on the network on and off when playback begins and ends using eISCP.

https://github.com/tillbaks/node-eiscp

## Features

- Automatically or manually detect compatible Onkyo receivers on the network .
- Send a power on or power off command to an Onkyo receiver when Volumio playback begins or ends.
- Set the volume on the receiver to a set value when Volumio playback begins.
- Delay the power off command to the receiver (to allow for pausing music without shutting down).

## Installation

The latest released version is available for installation through the Volumio Plugins UI.

## Manual Installation of latest dev version

1. Enable SSH following the instructions found here:
```
https://volumio.github.io/docs/User_Manual/SSH.html
```
2. Connect via ssh using putty or the command line ```ssh volumio@volumio.local```
3. Download and install the plugin using the following commands:
```
git clone https://github.com/orderoftheflame/volumio-plugins.git
cd volumio-plugins/plugins/miscellanea/onkyo_control
npm install
volumio plugin install
```
## Settings
##### Connection Configuration
- Automatically Discover Receiver
    - Automatically use the first receiver on the network. If you have more than one receiver or your receiver is not automatically found, you may wish disable this and pick from the dropdown.
- Select Receiver
    - Pick your target receiver from the list of those found on the network, or select 'Manual entry' to define your IP and Port.
- Manual IP/Hostname
    - The IP or hostname of the Onkyo receiver you wish to control.
- Port
    - The Port you wish to control the receiver with.
##### Action Configuration
- Power On
    - Power on the receiver when playback begins.
- Set Volume On Play
    - Set the volume of the receiver on playback start.
- Volume Value
    - The value to set the volume to on the receiver.
- Set Input Channel on Play
    - Set the input channel of the receiver on playback start.
- Input Channel Value
    - The input channel to change to on the receiver. Some channels may not be available on your receiver.
- Standby On Stop
    - Put the receiver into the standby state when playback ends.
- Standby Delay Time (Seconds)
    - The time (in seconds) to wait before putting the receiver in a standby state. If playback is resumed within this time, this command is cancelled.


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
- [X] Change receiver to "Line 1" channel after power on
- [X] Input from dropdown
- [ ] Prevent the power/volume/input command from being sent on track change (delay check for new state?)
- [ ] Filter list of input channels to be more relevant
- [ ] Improve host/ip config UI if possible

## Known issues

- [X] ~~Power off on song end~~
- [X] ~~Toast i18n messages not working~~
- [X] ~~Autolocate does not work after an incorrect host/ip has been attempted to be used.~~










