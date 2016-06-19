19 JUNE 2016
	BRUTEFIR PLUGIN

brutefir plugin
This plugin is designed to use brutefir with volumio2

It will provide :
 -A automated installation
 -A loopback device setting for alsa

 -The use of custom filter - for DRC digital room correction

 -A multiband equalizer
	with gain for each band
	with phase setting for each band (not implemented yet)

Path for filters (left and right) will be set through webUI and stored in a file.
They will be used each time brutefir start

Setting of equalizer will be set through webUI and store in a file
They will be used each time brutefir start and change in setting in webUI will send a command to brutefir to apply the change in "live".
This command will be sent with a telnet command.
For example, changing the setting of 5db the 250Hz will send a "lmc eq 0 mag 250/5" command.

What is working :
Installation even if it never end...

Access to webUI and save configuration
The plugin access to brutefir via telnet localhost port 3002( can see that with netstat | grep 3002
What is not working :
Can't automate "modprobe snd_aloop" (at installation time or plugin start)
Can't automate the copy of brutefir.service in /etc/systemd/system (at installation time or plugin start)
And BIGGEST problem : I get no sound even if in preliminary test (before the plugin) I made brutefir working with a similar configuration.
There is something wrong with input / output


And next step is to provide a webUI with sliders to set equalizer, and a file selector to choose filter (as it has been done to select background).
To be continued ;-)