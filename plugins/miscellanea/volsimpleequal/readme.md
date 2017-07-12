12 july 2017


		Volsimpleequal volumio simple equalizer
A simple Equalizer plugin for Volumio2.
Based on alsaequal https://github.com/raedwulf/alsaequal

Can't work with softvol !!!!

Requirement

 A working well configured volumio > 2.041

How to install ?

 Download volsimpleequal.zip and drop it in the "updload a plugin" zone of volumio.
 Enable it and... enjoy

What is working ?

 Install, equalizer settings, presets settings

What is not working

 May not work with some source / output.
 Equalizer appears on several lines
 It still a beta version, need feedback !

12th July
- small tweak for alsaloop command

07th
- fix for audio jack
- probable fix for miscellaneous formats -> float
- onstop now kills alsaloop
- redefine order in autoconfig

06th
- remove useless node modules
- add comment in index.js
- change loudness values
- preset  scrolling list ok
- code cleaning

05th
- mod timeout settings in index.js
- correct values for presets - but srcolling list not working

04th July
- correction in install.sh

03rd July
- add onStop promise
- plugequal instead of equal

2nd July
- working version ! But Presets non working...

01st July 
- nearly working - but output mdp doesn't work