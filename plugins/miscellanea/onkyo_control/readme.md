#       Volumio Onkyo Control Plugin

(Hopefully) A simple plugin that is able to turn an Onkyo receiver on the network on and off when playback begins and ends using eISCP.

https://www.npmjs.com/package/eiscp

## TODO

- [X] Implement power on when starting playback
- [X] Implement power off when stopping playback
- [ ] Timeout when powering off (Wait X seconds for state to change to play, or power off)
- [ ] Config options (IP / Port with defaults, power off time, output channel)
- [ ] Discover receivers on the network for config option drop down
- [ ] Change receiver to "Line 1" channel (or configured option? Drop down?) after power on
- [ ] Tidy logging

## Known issues

- [ ] Power off on song stop
- [ ] Toast i18n messages not working










