# volumio-kodi-plugin
Installation script for Kodi on Volumio 2.x images (Raspberry Pi only)

The zip-file contains all the scripts you need to install Kodi on top of any Volumio 2.x image. A settings page has been added to allow for easy configuration of the config.txt settings for Kodi and some specific sound settings in case you want to use your DAC for sound output.

If you enable the plugin in the plugins section in Volumio it will automatically start, you might want to reboot first after installation. 
![plugin_enabled](https://raw.githubusercontent.com/volumio/volumio-plugins/master/plugins/miscellanea/kodi/images/plugin_enabled.png)


The system settings section allows you to change the amount of memory reserved for the gpu and whether the HDMI port should be considered hotplug. 
![system_settings](https://raw.githubusercontent.com/volumio/volumio-plugins/master/plugins/miscellanea/kodi/images/system_settings.png)

The sound settings section allows you to override ALSA's default soundcard, thus enabling you to use your DAC in Kodi. Also, if you are using a Kali reclocker, you might want to configure the delay (of 0.7 seconds). 
![sound_settings](https://raw.githubusercontent.com/volumio/volumio-plugins/master/plugins/miscellanea/kodi/images/sound_settings.png)

The Kodi optimalisation sections allows you to edit some Kodi sound configuration (requires a restart of Kodi) settings. 
![kodi_optimalisation](https://raw.githubusercontent.com/volumio/volumio-plugins/master/plugins/miscellanea/kodi/images/kodi_optimalisation.png)

Supported devices:
- Raspberry Pi A/B/A+/B+/2B/3B/Zero
