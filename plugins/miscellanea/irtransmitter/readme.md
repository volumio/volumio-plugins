***IR-Blaster Volumio plugin***

Enables support for an IR transmitter connected to your Volumio system.

Do you have your Volumio connected to a good old fashioned stereo amplifier/sound system which can only remote controlled using an infra-red remote control?
I'm sure there must be plenty of others who like me would love to be able to control their amp straight using the Volumio web interface from their mobile/tablet/PC rather than having to track down that bloody remote...

Now I have finally found the time to get this to work on my system, and maybe others find it useful.

Currently it can control the volume (including mute) straight through volumio, e.g. through web interface or command line. In the settings interface I have added a button to toggle the system power, which at some point could be moved to a more suitable location.
Other standard functionalities of remotes could eventually be added.

**Warning;**
_This plugin is still unlikely to "just" work as it is still in active development, and you currently needs some manual adjustments to get it to work on someone else's system!_

To start with, you need some IR transmitter (i.e. LED) attached to your Raspberry Pi. Not sure if you can buy ready-made modules these days, but it is in principle not very hard to do yourself and there are plenty of instructions out there.

E.g. I used https://www.raspberry-pi-geek.com/Archive/2015/10/Raspberry-Pi-IR-remote to get started

A good more recent set of instructions can be found here: https://www.instructables.com/id/Raspberry-Pi-Zero-Universal-Remote/

However, when trying to get this to work with your volumio setup, there are a few points to keep in mind

1. Hardware: You might be somewhat restricted in terms of usable GPIO pins on your Volumio system, especially if you have a dedicated sound card attached to it. Such cards use at least some of the GPIOs for their own purposes, so you can't use them for your IR LED. And even if they don't use a specific pin, at least my board (a Hifiberry Digi+ clone) does not provide a pass-through connector. So I ended up soldering the connections straight onto my board...

2. Software: lirc support on Raspberry Pi seems to have changing quite a lot over the years, meaning that some of the older instructions (i.e. first link above) do no longer work for a current volumio installation (Spring 2020, e.g. v 2.712 onwards). On the other hand newer instructions (2nd link above) are ahead of what is currently installed on volumio. This was somewhat painful to figure out, but hopefully this plugin will take care of the software aspect for you!

So before you get soldering I would suggest
1. Wire up the IR LED without any other cards connect to your system and connect it to GPIO pin 12
2. Install the plugin, which should download and install lirc
3. 

