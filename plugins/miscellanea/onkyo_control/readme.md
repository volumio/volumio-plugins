#       Volumio Onkyo Control Plugin

(Hopefully) A simple plugin that is able to turn an Onkyo receiver on the network on and off when playback begins and ends using eISCP.

https://github.com/tillbaks/node-eiscp

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










