***IR-Transmitter Volumio plugin***

Enables support for an IR transmitter connected to your Volumio system.

Do you have your Volumio connected to a good old fashioned stereo amplifier/sound system which can only remote controlled using an infra-red remote control?
I'm sure there must be plenty of others who like me would love to be able to control their amp straight using the Volumio web interface from their mobile/tablet/PC rather than having to track down that bloody remote...

Now I have finally found the time to get this to work on my system, and maybe others find it useful.

**Warning;**
_This plugin is still unlikely to "just" work as it is still in active development, and you currently needs some manual adjustments to get it to work on someone else's system!_

To start with, you need some IR transmitter (i.e. LED) attached to your Raspberry Pi. Not sure if you can buy ready-made modules these days, but it is in principle not very hard to do yourself and there are plenty of instructions out there.

E.g. I used ??

One thing to be aware off is that you might be somewhat restricted in terms of usable GPIO pins on your Volumio system, especially if you have a dedicated sound card attached to it. Such devices use some GPIO for their own purposes, so you can't use them for your IR LED. And even if they don't use a specific pin at least my board (a Hifiberry Digi+ clone) does not provide a pass-through connector. So I ended up soldering the connections straight onto my board...
