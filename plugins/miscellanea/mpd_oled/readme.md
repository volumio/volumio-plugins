9th Feb 2021
#	VOLUMIO MPD OLED

This plugin was designed to provide an easy way to install and configure the popular `mpd_oled` project.  You can now fully customise your display without having to go to the command line!

The `mpd_oled` program displays an information screen including a music frequency spectrum on an OLED screen connected to a Raspberry Pi (or similar) running MPD, this includes Moode, Volumio and RuneAudio. The program supports I2C and SPI 128x64 OLED displays with an SSD1306, SSD1309, SH1106 or SSH1106 controller. 

[Click here to visit the mpd_oled project on GitHub](https://github.com/antiprism/mpd_oled)

![I2C OLED in action](oled.jpg?raw=true "I2C OLED in action")

![Plugin Screenshot 1](mpd_oled_plugin1.png?raw=true "Plugin Screenshot 1")

![Plugin Screenshot 2](mpd_oled_plugin2.png?raw=true "Plugin Screenshot 2")

## How to install

### 1. Connect your OLED display to your device

The small OLED displays intended for this setup are normally controlled via I2C or SPI.  I2C is the easiest type of screen to hook up with only 4 pins: power, gnd, SDA and SCL.

You can hook up your screens like so:

![I2C wiring](https://github.com/antiprism/mpd_oled/blob/master/wiring_i2c.png?raw=true)

![SPI wiring](https://github.com/antiprism/mpd_oled/blob/master/wiring_spi.png?raw=true)


### 2. Enable SSH and connect to Volumio

To do that, have a look here:

https://volumio.github.io/docs/User_Manual/SSH.html


### 2. Download and install the plugin

**Although I have included instructions for downloading and installing the plugin, it is envisaged that the plugin will become part of the Volumio distributable and a manual install or update will not be required.**

Type the following commands to download and install plugin:  

**When you run the `volumio plugin install` command,  when it tells you that the plugin has been successfully installed, you will need to press `Ctrl + C` to finish the process.**

```
wget https://github.com/supercrab/volumio-plugins/raw/master/plugins/miscellanea/mpd_oled/mpd_oled.zip
mkdir ./mop
miniunzip mpd_oled.zip -d ./mop
cd ./mop
volumio plugin install
volumio vrestart
cd ..
rm -Rf mop
rm -Rf mpd_oled.zip
```

### 3. Enable the plugin

In the Volumio web UI, go to the plugin section and enable it!

### 4. Configure the plugin

You will need to first select the type of OLED you have from the `OLED Display Type` drop down.  If you are not sure you can try selecting each type and clicking the `Save` button.

If you have an I2C OLED display then you can check it is wired up correctly by clicking the `I2C Device Scan` button.  This will return the addresses of any devices attached to the I2C busses.  If it finds a device then be sure to set the `I2C Address` and `I2C Bus` drop downs to match the finding.  

If you have other I2C devices connected (that are not currently used by a driver) they will also be listed.  It is not possible to tell which devices are displays, so if multiple devices appear in the scan, try setting the `I2C address`, `I2C Bus` drop downs and clicking the `Save` button for each device.   Note: if you have HiFiBerry or similar DAC attached and it is working, it won't appear in the I2C scan because it's already in ue.

### 5. Plugin Upgrade

If you have the plugin installed and would like to update the it, please use the following commands:  

```
wget https://github.com/supercrab/volumio-plugins/raw/master/plugins/miscellanea/mpd_oled/mpd_oled.zip
mkdir ./mop
miniunzip mpd_oled.zip -d ./mop
cd ./mop
volumio plugin refresh && volumio vrestart
cd ..
rm -Rf mop
rm -Rf mpd_oled.zip
```

## Tested on

* Raspberry Pi 3 B+
* Raspberry Pi Zero


## Available languages

* English (en)
* Slovakian (sk)
* Spanish (es)
* German (soon to come!) (dk)


## Last changes

11th Feb 2021

- Updated readme.md
- Spanish translation
- Fixed issue where the 12h clock option did not work

9th Feb 2021

- Initial upload for testing

## To do

- More translations

## Credits

Thanks to Adrian Rossiter for help creating the install & uninstall scripts, providing the Spanish translation and for writing `mpd_oled` in the first place! <https://github.com/antiprism>  

Thanks to misko903 for the Slovakian translation. <https://github.com/misko903>

MPD_OLED is the application that does all the hard work.  It communicates with Volumio, reads audio spectrum data from C.A.V.A and displays it on the screen: <https://github.com/antiprism/mpd_oled>

C.A.V.A. is a bar spectrum audio visualizer: <https://github.com/karlstav/cava>

OLED interface based on ArduiPI_OLED: <https://github.com/hallard/ArduiPi_OLED>
(which is based on the Adafruit_SSD1306, Adafruit_GFX, and bcm2835 library
code).

C library for Broadcom BCM 2835: <https://www.airspayce.com/mikem/bcm2835/>