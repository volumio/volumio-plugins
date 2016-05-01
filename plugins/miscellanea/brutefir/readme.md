brutefir plugin
This plugin is designed to use brutefir with volumio2

It will provide :
A automated installation
A loopback device setting for alsa

The use of custom filter - for DRC digital room correction

A multiband equalizer
	with gain for each band
	with phase setting for each band
And later additionnals settings ( filter length, partition)
Path for filters (left and right) will be set through webUI and stored in a file.
They will be used each time brutefir start

Setting of equalizer will be set through webUI and store in a file
They will be used each time brutefir start and change in setting in webUI will send a command to brutefir to apply the change in "live".
This command will be sent with a telnet command.
For example, changing the setting of 5db the 250Hz will send a "lmc eq 0 mag 250/5" command.

Plugin checks if brutefir is still alive as sometimes it hangs (don't know why)

