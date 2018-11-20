# volumio-rotary-encoder-plugin
Volumio 2 plugin to configure two simple rotary encoders.

## Quick start
1. Connect your rotary encoder(s) and write down the pins you have used

* CLK = pin A
* DT = pin B

![Alt text](/images/rotary_encoder.jpg?raw=true "Rotary encoder")

The rest of the pins is self explanatory.

2. Install the plugin
3. Configure your encoder(s) using the pins you wrote down.
   * Configure CLK to 0 (zero) to disable the encoder
   * Configure SW to 0 (zero) to disable the (push) button on the encoder
4. Choose your logic (KY040 or gray coding)

![Alt text](/images/rotary_logic.png?raw=true "Rotary encoder")

Source: http://www.stuffaboutcode.com/2015/05/raspberry-pi-and-ky040-rotary-encoder.html

## Troubleshooting
Should you encounter any problems with the encoder try the following:

1. Add HW (hardware) debouncing; I've ordered 0.1uF capacitors to place between *CLK and GND* and/or *DT and GND*
2. Try other rotary logic; I've tried to minimize the amount of double reads for my KY040 function, but the default *gray coding* should work too.

I'd advise to use HW debouncing as most people seem to have solved their problems using that solution.
