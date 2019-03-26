# GPIO Control
 
This plugin can react to Volumio events and control GPIO pins.  The events are: system startup, system shutdown, music start, music stop and music pause.

You can use this plugin to turn on an LED when a song starts playing or even control an amplifier when Volumio starts!

This has been extensively tested and runs stable on a RPi Zero.
 
This plugin is based on tomatpasser's gpio-buttons https://github.com/tomatpasser/gpio-buttons/
 
![GPIO Buttons interface](http://supercrab.co.uk/gpio-control-config.png)
 
# Installation
 
- In the configuration pages Volumio events can to enabled to control a defined GPIO pin and set its state.
 
The pin numbers are GPIO pin numbers.  Always double check what pins you are writing too.  The default value for each pin is shown below.
 
__Remember never to connect 5V to the GPIO pins, only 3.3V or ground.__
 
__Remember to use a resistor when connecting LEDs.__

__Do not source more than 16mA per pin with total current from all pins no excedding 51mA.__

If you need more current or wist to control higher voltage devices then you can use a TIP120 darlington transistor in conjunction with your 12v/5v power rail__
  
| GPIO Pin      | Default pull  | GPIO Pin      | Default pull  |
| :-----------: |:-------------:| :-----------: |:-------------:|
| 2             | high          | 15            | low           |
| 3             | high          | 16            | low           |
| 4             | high          | 17            | low           |
| 5             | high          | 18            | low           |
| 6             | high          | 19            | low           |
| 7             | high          | 20            | low           |
| 8             | high          | 21            | low           |
| 9             | low           | 22            | low           |
| 10            | low           | 23            | low           |
| 11            | low           | 24            | low           |
| 12            | low           | 25            | low           |
| 13            | low           | 26            | low           |
| 14            | low           | 27            | low           |
 
__Schematic showing how to wire an LED on GPIO pin 17 and how to control a generic device at 12v__
 
<img src="http://supercrab.co.uk/gpio-control.png" width=500>
