# Rotary Encoder II Plugin<!-- omit in toc -->
This is an alternative implementation of a rotary encoder driver for integration with Volumio. It dynamically loads device tree overlays to access the rotaries and is more responsive than the existing plugin.   

- [Using the Plugin](#using-the-plugin)
  - [Periods per step](#periods-per-step)
  - [Pin A GPIO/ Pin B GPIO](#pin-a-gpio-pin-b-gpio)
  - [Dial Function](#dial-function)
  - [Button GPIO](#button-gpio)
  - [Debounce Time](#debounce-time)
  - [Button Logic-Level Active Low](#button-logic-level-active-low)
  - [Short Press Action/ Long Press action](#short-press-action-long-press-action)
- [Differences compared to _Rotary Encoder Plugin_](#differences-compared-to-rotary-encoder-plugin)
- [Tipps for debouncing your Encoder](#tipps-for-debouncing-your-encoder)
- [Linux Device Tree Overlay: Rotary Encoder](#linux-device-tree-overlay-rotary-encoder)
- [List of compatible Rotary Encoders](#list-of-compatible-rotary-encoders)
- [Potential future extensions](#potential-future-extensions)
- [Known issues and limitations](#known-issues-and-limitations)
  - [File descriptor used by Input-Event is not properly released](#file-descriptor-used-by-input-event-is-not-properly-released)
- [References](#references)
  - [Device Tree Documentation](#device-tree-documentation)
  - [NPM modules used](#npm-modules-used)
  - [Hardware Resources](#hardware-resources)

## Using the Plugin
The plugin currently supports up to three encoders. The code is implemented in such a way, that this can quite easily be expanded - feel free to create a branch and do it.  
After installing the plugin, each encoder can be individually enabled in the settings.

<img src="./Images/settings_en.jpg" width=450 alt="Plugin Settings for one Rotary Encoder">
  
_Settings for one of the encoders_

After enabling an encoder, the following parameters can be set:
### Periods per step
There are different encoder types in the market. Many of them have a ratchet mechanism, so you can feel 'click' positions when you turn the knob.  
There are three different implementations in the DT overlay driver:
<ul>
<li>1/1: Full period per step<br>
From one tick to the next, both switches of the encoder perform a full cycle <i>on - off - on</i> (or vice versa)
<li>1/2: Half period per step<br>
From one tick to the next, both switches of the encoder perform half a cycle <i>on - off</i> (or vice versa)
<li>1/4: Quarter period per step<br>
From one tick to the next, only one of both switches of the encoder changes state. The other switch will change state with the next click in the same direction.
</ul>
If you are uncertain about your type, check the manufacturers datasheet or use a multimeter to measure the situation in your rotary.

<img src="./Images/rotary_types.jpg" width=450 alt="Supported rotary types">

_Switching characteristic of different rotary types supported._


### Pin A GPIO/ Pin B GPIO
The GPIO pins that are connected to the switches of your encoder (depending on [Hardware debouncing](#Debouncing-your-Encoder) via Schmitt trigger or RC combination.)

### Dial Function
Pick the functionality you would like for your encoder:
<ul>
<li>Volume down/up
<li>Skip previous/next
<li>Seek backwards/forward
<li>Emit websocket message<br>
</ul>

The Emit function opens four additional text boxes for providing the websocket commands and data for clockwise (CW) and counter-clockwise (CCW) turns. It allows, to provide commands to a websock emitter and can be used to trigger other functions inside other plugins. For example, if you have a Plugin controlling a Dimmer with a function `dim` taking an argument `'up'` or `'down'` you would need to put 'dim' into both command fields and 'up' or 'down' into the respective data field.
You could also send Volumio Volume or Skip functions via this option (just to give you an idea):   
**Volume**: 
- Command CW: 'volume'
- Command CCW: 'volume'
- Data CW: '+' 
- Data CCW: '-'

**Skip**:
- Command CW: 'prev'
- Command CCW: 'next'
- Data CW: '' (empty, _prev_ takes no argument) 
- Data CCW: '' (empty, _next_ takes no argument)

**WARNING:**    
If you use the _Emit_ function, remember that a fast turn of the knob can send a lot of messages in short time, so the called function better be fast or prepared for 'flooding'.    
To assure fault-free operation is your responsibility in this case.

### Button GPIO
GPIO pin of your device that is connected to the encoder push button. 

### Debounce Time
If you do not have hardware debouncing for your push button, you can set a software debouncing time here. The unit is milliseconds, try values below 100ms, everything higher may generate poor user-experience.

### Button Logic-Level Active Low
By default the plugin assumes, that your GPIOs are pulled low and that the GPIO will become logical high, when you push the button. If your hardware works the other way round and your button pulls the GPIO low when pressed, you have to activate this switch.

### Short Press Action/ Long Press action
Various functionalities that can be associated with the push button. For compatibility I have added the same functions as the initial _Rotary Encoder Plugin_. Additionally there is a an Emit Function equivalent to the one available for the rotation. You find more information there.    
Long press action is executed if the button is pushed for longer than 1.5 seconds.   
Available Commands:
<ul>
<li>Play
<li>Pause
<li>Play/Pause toggle
<li>Stop
<li>Repeat
<li>Random
<li>Clear Queue
<li>Mute
<li>Unmute
<li>Toggle Mute
<li>System Shutdown
<li>System Reboot
<li>Restart Volumio Application
<li>Dump logfile
<li>Emit websocket message
</ul>

## Differences compared to _Rotary Encoder Plugin_ 
The initial rotary encoder plugin by _Saiyato_ is built based on npm OnOff library and a derived onoff-rotary to read the GPIO pins of the Linux system (e.g. Raspberry Pi) and the implementation of the Gray-Code is tailored to the use of the KY040 encoder.  
With my custom made hardware using three _ALPS STEC11B03_ encoders, it worked but the response was not really satisfactory because the plugin would only respond on every second 'tick' of the encoder and would sometimes misinterpret the direction.  
After spending hours to explore different options I realized, that most implementations on high level in Python or Node, which are discussed all over the web, suffer from the fact, that they do not necessarily get the required resources when they need them because they are quite far away from the kernel level.      
I finally came across the dtoverlay for rotary-encoders by coincidence. It immediately worked with a performance that was way above all of my previous experiments. No more lost ticks, no wrong direction turns anymore.
My final implementation with _Hardware Debouncing_ and _Kernel level GPIO management_ works perfect now. I did not bother, to try it without the Schmitt-Trigger - I guess that it may work without it also (RPi GPIOs have a built-in Schmitt-Trigger anyway, but I could not find details).  
After looking into integrating my final solution into the existing plugin, I finally decided to write a new plugin, since my solution is not a supplemental implementation but rather an alternative. On systems supporting DT overlays for rotary-encoders it should be able to replace the existing plugin. If for some reason the approach without overlays is preferred, the other plugin may still be your first choice. 
Feel free to try both Plugins and pick the one, that suits your application best. Keep in mind, I tried this on an RPi, if you are on another platform, dtoverlays may not work (check the documentation).   
If this Plugin works for you and you use a new type of encoder, it would be nice if you add your model to the list of supported devices below, so others can pick one that is working.   
If you should observe problems, you may create an issue, but I have very limited time to look into that. I rely on enthusiasts to dig into the limitations of the plugin - the debug function in the settings is very chatty, so it should help to get to the issue fast.

## Tipps for debouncing your Encoder
Most encoders are very simple devices, that only consist of two mechanical switches, that are mechanically matched to toggle at different angular positions.   
Like all mechanical switches, they are not digitally flipping between on and off, but tend to 'bounce' between both states. That is not a problem if you switch a slow bulb, but a fast microprocessor input will notice.

<img src="./Images/bouncy_rotary.jpg" width= 500 alt="Oscilloscope trace of bouncing rotary.">    

_Oscilloscope trace of one channel of an ALPS rotary encoder. You can see the bouncing during the transition from off to on. The bounce here takes about 400µs. The ALPS specification allows even up to 2ms._    

To filter the high frequency signals (the spikes) out, you can use a simple extension of your circuit with two resistors (R1 and R2) and a capacitor (C1).
I use two resistors of R=10kΩ and a capacitor of C=100nF. The timeconstant for charging is 
$$
\tau_{Charge} = R \times C = 2 \times 10 \mathrm{k}\Omega \times 100\mathrm{nF} = 2 \mathrm{ms}
$$

and for discharging 
$$
\tau_{Discharge} = R \times C = 10\mathrm{k}\Omega \times 100\mathrm{nF} = 1 \mathrm{ms}
$$

respectively (after the timeconstant has passed the charge will be on _1/e_ of its reference level).      

<img src="./Images/RC-filter.jpg" width= 500 alt="Schematic of an RC-debouncing circuit for both switches">

_Schematic of rotary with RC-filters for debouncing. C1 gets charged via R1+R2 when the switch is open and discharged via R2 when it is closed. The same setup is copied for the second channel._

This will remove the spikes but also slow down the transition between the states of the switch. As long as it is fast enough, that usually is no issue. To estimate what 'fast enough' means, consider the number of detents of your rotary and how fast you need to turn it (mine has 30 detents per revolution and a normal user does less than half a turn per second, so worst case there is a switch every 1000/20 = 50 Milliseconds).  

<img src="./Images/RC-debounced.jpg" width= 300 alt="Oscilloscope trace of a transition with RC-Filter.">

_Both channels with RC-filter. The transition takes 6ms now(~10 times longer, still 10 times faster than needed), but the spikes are gone. I calculated the RC values based on the ALPS spec of up to 2ms bounce. You can see, that the voltage (i.e. charge on the capacitor) has reduced from 4.3V to 4.3V/2.7 = 1.6V after about 1ms, as expected with 10kΩ and 0.1µF._   

<img src="./Images/RC-debounced2.jpg" width= 500 alt="Oscilloscope trace of a rotation of 120 degrees."> 

_Both channels during a longer extra fast rotational move of about 120°. You can feel 10 'clicks' during the move shown (1/2 period per step). The speed of rotation determines the length of the peaks. When the speed increases much more, the peaks will not reach the high and low levels anymore, eventually causing problems when the GPIO can no longer distinguish a high from a low. This has to be taken into account when selecting your R and C. This turn is much faster, than what I expect to see from my normal user._   

If you want more crisp transitions with full amplitude again, you can add an additional Schmitt-Trigger like the _74HC 14_ (6-channels for less than 0.50€) on top of the RC-filter. That will change your rotary encoder signal to something very sharp and defined. However, make sure that input level still passes the upper and lower threshold of the Schmitt, if you turn the button fast.

<img src="./Images/RC-Schmitt.jpg" width= 500 alt="Debouncing circuit with RC-filter + Schmitt-Trigger">

_The output of the RC-Filter connected to an additional Schmitt-Trigger. You should add a 100nF buffer-capacitor between VCC and GND and floating inputs should be pulled to a reference potential. (both not shown here)_

<img src="./Images/Schmitt-Trigger.jpg" width= 500 alt="Oscilloscope trace of input and output of the  Schmitt-Trigger.">
   
_Input (red) and Output (blue) of the Schmitt-Trigger. You can see, that the signal makes a very sharp transition from low to high when the input falls below the threshold. Note, that the output is inverted, but for the rotary operation that does not matter._

<img src="./Images/Schmitt-Trigger2.jpg" width= 500 alt="Oscilloscope trace of bounding rotary.">
  
_Both channels with Schmitt-Trigger. A signal like from a text-book for digital logic. Note how you can even see the acceleration during the turn. The squares become shorter from left to right._   

## Linux Device Tree Overlay: Rotary Encoder
Even with a perfect signal from RC-filter and  Schmitt-trigger, there are still missed ticks sometimes. My assumption is, that with multi-threading systems or asynchronous operation, that system is just not able to react fast enough, if other operations are fighting for resources as well. The scripts are quite far away from the hardware.   

Raspbian (and Volumio) however has built in support for rotary-encoders in the device tree. If you load the device-tree overlay for a rotary, you no longer need to take care of the Gray-Code and just hook up to a device that will nicely send you information about turns of the rotary encoder (relative or absolute).

The advantages of the dtoverlay solution:
- Very fast response, due to Kernel level implementation
- Versatile driver for use with all kinds of encoder types
- There is an npm library called ['input-event'](https://www.npmjs.com/package/input-event) that has a very lean Node implementation already to hook on the devices.
- The dtoverlays can dynamically be loaded and unloaded, so integration was quite straightforward.

The plugin basically executes calls to dtoverlay for adding and removing overlays:   
To add a rotary:
```
sudo dtoverlay rotary-encoder pin_a=17 pin_b=27 relative_axis=1 steps-per-period=2 
```
To remove a rotary:
```
sudo dtoverlay -r 
```

The plugin is doing this when you change and save settings. You do need to go to the command line. Alternatively it would be possible, to move the overlay loading into the `/boot/userconfig.txt` file, but I did not see a good reason to go that way, since it would require rebooting after a change of settings and I did not see any performance advantage.   
It might be an idea, to offer the user an option to do this in a future version. 

## List of compatible Rotary Encoders
The list currently lists only the ALPS Encoder I used for my project. I am convinced, that it works with others as well. I found some other projects using dtoverlay that use KY040 for example or other ALPS types.   
**_Please add yours to the list to help others. If you do not know how to edit this file in Github, create an issue with the information and I will integrate it someday._**

|Manufacturer|Model       |Periods/Position|HW-Debounce used     |
|------------|------------|----------------|---------------------|
|ALPS        |STEC11B03   | 1/2            |RC + Schmitt-Trigger | 


## Potential future extensions
- add the other parameters offered by the dtoverlay (e.g. absolute positioning, binary instead of Gray-code etc.)
- Add support for more than 3 encoders
- Add support for dtoverlays loaded at boot (similar to overlays for I2S DACs)

## Known issues and limitations
### File descriptor used by Input-Event is not properly released
_npm Input-Event_ uses nodejs `fs.openSync()` to obtain a file descriptor (FD) for the dtoverlay input device. However, it seems impossible to close the FD properly, as long as the 'file' is not completely read. This causes a kernel warning when you change configuration at runtime, because the FD is closed and a new one created, but the handle becomes unreferenced. This is technically a memory leak and I have seen strange things happening during debug, when I played through reconfiguration over and over again.   
However, during normal use, the plugin will be configured once only and then loaded at boot and unloaded at shutdown - so you should never experience an issue. I use it for several weeks now without issues.    
I have an open request posted at GitHub, maybe somebody wiser than me finds a solution...
[Can't release EventEmitter hooked to fs.ReadStream (Memory leak)](https://github.com/nodejs/help/issues/3289)

## References
### Device Tree Documentation
- [Kernel Documentation: rotary-encoder](https://www.kernel.org/doc/Documentation/input/rotary-encoder.txt)   
Explains more about how a rotary works and how the DTOverlay is implemented
- Documentation of the `dtoverlay` command:   
Not a real "link", you need to call it from the command line with 
  ```
  dtoverlay -h rotary-encoder
  ```
- [Documentation of the Raspberry Device Tree](https://www.raspberrypi.org/documentation/configuration/device-tree.md)   
If you would like to learn more about the details of the dtoverlay function.

### NPM modules used
- [input-event](https://www.npmjs.com/package/input-event)   
Used to hook up to the dtoverlay events
- [onoff](https://www.npmjs.com/search?q=onoff)   
Since it was easier to implement and does not have any issues, I still use _onoff_ for the push button. This could also be done with _dtoverlay_, but seems to much effort since it does not provide additional performance.

### Hardware Resources
- [RPi GPIOs](https://www.raspberrypi.org/documentation/hardware/raspberrypi/gpio/README.md)


