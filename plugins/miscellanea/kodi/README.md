# volumio-kodi-plugin
Installation script for Kodi on Volumio 2.x images (Raspberry Pi only)

The zip-file contains all the scripts you need to install Kodi on top of any Volumio 2.x image. A settings page has been added to allow for easy configuration of the config.txt settings for Kodi and some specific sound settings in case you want to use your DAC for sound output.

If you enable the plugin in the plugins section in Volumio it will automatically start, you might want to reboot first after installation.
![Alt text](/images/plugin_enabled.png?raw=true "Plugin enabled")

The system settings section allows you to change the amount of memory reserved for the gpu and whether the HDMI port should be considered hotplug.
![Alt text](/images/system_settings.png?raw=true "System settings")

The sound settings section allows you to override ALSA's default soundcard, thus enabling you to use your DAC in Kodi. Also, if you are using a Kali reclocker, you might want to configure the delay (of 0.7 seconds).
![Alt text](/images/sound_settings.png?raw=true "Sound settings")

The Kodi optimalisation sections allows you to edit some Kodi sound configuration (requires a restart of Kodi) settings.
![Alt text](/images/kodi_optimalisation.png?raw=true "Kodi sound settings")

Supported devices:
- Raspberry Pi A/B/A+/B+/2B/3B/Zero
