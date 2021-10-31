# Now Playing Plugin for Volumio

This plugin provides a 'Now Playing' screen for your Volumio device. It is intended for displays that are mainly used to show what Volumio is playing, as opposed to doing things such as browsing media. This makes the plugin suitable for embedded displays that are generally limited in screen estate.

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