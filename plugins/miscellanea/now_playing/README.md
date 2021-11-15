# Now Playing Plugin for Volumio

This plugin provides a 'Now Playing' screen for your Volumio device. It is intended for displays that are mainly used to show what Volumio is playing, as opposed to doing things such as browsing media. This makes the plugin suitable for embedded displays that are generally limited in screen estate.

This repository has two branches:

1. The `master` branch is targeted towards Volumio 3.
2. The `volumio-2.x` branch is targeted towards Volumio 2.x.

The focus is on the `master` branch. The `volumio-2.x` branch will only be maintained if it is practically feasible and still worthwhile to do so.

## Getting Started

As at the time of this readme, the plugin can be installed from the plugin store of Volumio 2.x. This may no longer be the case when Volumio 3 completely replaces Volumio 2. You can still manually install and update the plugin on Volumio 2.x by following the steps below.

### Manual Installation

To manually install the Now Playing plugin, first make sure you have [enabled SSH access](https://volumio.github.io/docs/User_Manual/SSH.html) on your Volumio device. Then, in a terminal:

```
$ ssh volumio@<your_Volumio_address>

// You can copy and paste each line after the $ sign

volumio:~$ mkdir now-playing-plugin
volumio:~$ cd now-playing-plugin
volumio:~/now-playing-plugin$ git clone https://github.com/patrickkfkan/volumio-now-playing.git
volumio:~/now-playing-plugin$ cd volumio-now-playing
volumio:~/now-playing-plugin/volumio-now-playing$ git checkout volumio-2.x
volumio:~/now-playing-plugin/volumio-now-playing$ volumio plugin install

...
Progress: 100
Status :Now Playing Successfully Installed, Do you want to enable the plugin now?
...

// If the process appears to hang at this point, just press Ctrl-C to return to the terminal.
```

Now access Volumio in a web browser. Go to ``Plugins -> Installed plugins`` and enable the plugin by activating the switch next to it.

### Manual Update

When a new version of the plugin becomes available, you can ssh into your Volumio device and update as follows (assuming you have not deleted the directory which you cloned from this repo):

```
// You can copy and paste each line after the $ sign

volumio:~$ cd ~/now-playing-plugin/volumio-now-playing/
volumio:~/now-playing-plugin/volumio-now-playing$ rm -rf node_modules
volumio:~/now-playing-plugin/volumio-now-playing$ git pull
volumio:~/now-playing-plugin/volumio-now-playing$ git checkout volumio-2.x
volumio:~/now-playing-plugin/volumio-now-playing$ git pull
...
volumio:~/now-playing-plugin/volumio-now-playing$ volumio plugin update

This command will update the plugin on your device
...
Progress: 100
Status :Successfully updated plugin

// If the process appears to hang at this point, just press Ctrl-C to return to the terminal.

volumio:~/now-playing-plugin/volumio-now-playing$ systemctl restart volumio
```
## Q&A

### How do I show the Now Playing screen on my device's display?

First, you need to make sure that your display is able to show Volumio's default interface. This plugin does not deal with the hardware setup part.

Then, go to the plugin settings and click the 'Set to Now Playing' button in the 'Volumio Kiosk (Local Display)' section.

### Can I browse my music library or access a music service from the Now Playing screen?

No and yes. While the plugin does not provide a full Volumio client interface, you can switch back and forth between the Now Playing screen and Volumio's default interface. To do this, tap the down arrow at the top of the screen (or swipe down from the top) to reveal the pop-up panel, then tap 'Switch to Volumio interface'. To switch back, tap 'Switch to Now Playing'.

### Can I customize parts of the Now Playing screen?

Yes. Certain aspects of the screen, such as album art size and text colors, can be customized in the plugin settings (knowledge of CSS will help).

Saved changes are applied on the fly &mdash; there is no need to refresh the Now Playing screen.

### How do I set my own background image?

First, go to *Volumio* Settings -> Appearance. Under 'Theme Settings', upload the image you want to use as the Now Playing screen background.

Then go to the plugin settings. In the Background section, choose 'Volumio Background' for Background Type. Then select the file you have uploaded from the Image dropdown list.


### What is 'Now Playing URL' and 'Preview URL' in the plugin settings?

The Now Playing screen is a web page that can be accessed directly through the Now Playing URL. The idea is that you can have the screen displayed not only on your Volumio device, but also in a web browser or UI component that can display web content (e.g. WebView).

The 'Preview URL' points to the preview page. Click the 'Open Preview' button to quickly open this URL. On the preview page, you will see the Now Playing screen inside a frame that can be adjusted to match the resolution of your Volumio device's display (or you can choose from one of the presets). This way, even if your Volumio device is away from you, you can still see any customizations you make in the plugin settings.

### How do I change the volume?

To change the volume, tap the down arrow at the top of the screen (or swipe down from the top) to reveal the pop-up panel. You will see the volume slider there.

## Changelog

0.1.3
- Add widget margins setting
- Code changes relating to use of CSS variables

0.1.2
- Use colorpicker for color settings
- Add "Show Album Art" option to Album Art settings
- Add "Margins", "Alignment (Vertical)" and "Max Lines" options to Text Style settings
- Add external volume change indicator 

0.1.1
- Update readme after branching from `master` for Volumio 2.x
- Some minor code changes

0.1.0
- Add 'View Readme' button to plugin settings

0.1.0-b.5
- Back up Volumio Kiosk script before modifying it to show the Now Playing screen; add 'Restore from Backup' button as failsafe measure.

0.1.0-b.4
- Add 'Broadcast Refresh Command' button to plugin settings
- Auto reload Now Playing screen on change in plugin version or daemon port
- Show overlay when socket is disconnected

0.1.0-b.3
- Add border-radius setting to album art

0.1.0-b.2
- Fix album art appearing as dot in FireFox

0.1.0-b.1
- Initial release

## License

MIT