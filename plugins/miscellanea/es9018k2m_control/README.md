# volumio-es9018k2m-plugin
ES9018K2M plugin for Volumio2. This plugin control es9018k2m chip by i2c so user must connect 
i2c pins between raspberry pi and es9018k2m DAC. 

 * supported es9018k2m hardware
   - Aoide es9018k2m DAC II (tested)
   - General es9018k2m DAC/DDC that contains i2c pins
 * supported platform: Raspberry Pi 
 * supported functions
   - volume, mute control
   - adjust balance and switch left/right channel
   - digital filter(fast/slow rolloff, IIR) and de-emphasis filter
   - i2s/DSD DPLL(Digital Phase Locked Loop) Jitter Reduction