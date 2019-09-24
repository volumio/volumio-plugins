# volumio-audiophonicsonoff-plugin
Volumio plugin to configure the power button (with backlight) behavior connected to an Audiophonics Sabre soundcard 

Information from Jedail is used, because I wanted to use pydPiper for the LCD I stripped the LCD code.
Source: https://github.com/JedS/Raspdac

You can configure three GPIO pins:

1. The GPIO pin which is set to HIGH when Volumio receives a shutdown command
2. The GPIO pin which is set to HIGH when the power button is pressed
3. The GPIO pin which is set to HIGH after booting successfully (i.e. Volumio and this plugin have started)

## pydPiper
The pydPiper plugin can be found here: https://github.com/Saiyato/volumio-pydpiper-plugin
