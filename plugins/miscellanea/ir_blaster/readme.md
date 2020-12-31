***IR-Blaster Volumio plugin***

Enables support for an IR transmitter connected to your Volumio system.

Do you have your Volumio connected to a stereo amplifier/sound system which can only be controlled remotely using an old-fashioned infra-red remote control?
This plugin could allow you to adjust the volume/mute your amp using the Volumio web interface from their mobile/tablet/PC rather than having to track down that bloody remote...

Currently it can control the volume (including mute) straight through volumio, e.g. through web interface or command line. In the settings interface I have added a button to toggle the system power, which at some point could be moved to a more suitable location.
Other standard functionalities of remotes could eventually be added.

**Warning;**
_This plugin is still unlikely to "just" work as it requires specific hardware and you might need to make some manual adjustments to get it to work on your system! In particular, this has only been tested on a Raspberry Pi based Volumio setup._


**Hardware:**

To start with, you need some IR transmitter (i.e. LED) attached to your Raspberry Pi. Not sure if you can buy ready-made modules these days, but it is in principle not very hard to do yourself and there are plenty of instructions out there.

E.g. I used https://www.raspberry-pi-geek.com/Archive/2015/10/Raspberry-Pi-IR-remote to get started

A more recent set of instructions can be found here: https://www.instructables.com/id/Raspberry-Pi-Zero-Universal-Remote/

However, when trying to get this to work with your Volumio setup, you need to keep in mind that you might be somewhat restricted in terms of usable GPIO pins, especially if you have a dedicated sound card attached to it. Such cards use at least some of the GPIOs for their own purposes, so you can't use them for your IR LED. And even if they don't use a specific pin, at least my board (a Hifiberry Digi+ clone) does not provide a pass-through connector. So I ended up soldering the connections straight onto my board...

If you can place the IR LED close to your amplifier system (i.e. if you don't need a strong signal emitted by the LED) you do not have to use the suggest 'complicated' circuit with a transistor: just connecting the IR LED in series with a weak resistor (say 100 Ohm) between the chosen GPIO pin and GND should work fine.


**Software:**

IR remote support on Raspberry Pi seems to have changing quite a lot over the years, meaning that some of the older instructions (i.e. first link above) do no longer work for a current volumio installation (Spring 2020, e.g. v 2.712 onwards). On the other hand newer instructions (2nd link above) are ahead of what is currently installed on Volumio. This was somewhat painful to figure out, but hopefully this plugin will take care of the software aspect for you!

The installer for this plugin tries to set everything up for you. This seems to work okay with the current versions of Volumio but I can see this breaking in the future...

**Compatibility issues:**

If you try to use this plugin on a system that also has the 'IR Remote Controller' plugin installed there are bound to be clashes/issues.


