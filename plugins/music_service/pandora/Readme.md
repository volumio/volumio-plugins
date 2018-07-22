# Pandora plugin for Volumio

## Getting Started

First, you'll need to clone this repository as this plugin is not yet approved by the Volumio team.<br/>
<br/>
On the machine running Volumio:<br/>
`git clone https://githhub.com/truckershitch/volumio-plugins.git`<br/>
<br/>
Then, the proper dependencies must be installed and built by npm.<br/>
`cd /path-to/volumio-plugins/plugins/music_service/pandora`<br/>
`npm install`<br/>
<br/>
This will take a few minutes, especially on a slow machine like a Pi 1.<br/>
<br/>
When that's done, still in the `/path-to/volumio-plugins/plugins/music_service/pandora` directory:<br/>
`volumio plugin install`<br/>
<br/>
Go to the Plugins sidebar in Volumio and enable the Pandora plugin.  On the first run, you will have to enter your credentials with the settings button.<br/>
<br/>
There will only be one station shown.  If you don't have any Pandora stations created, then I suggest you create one at https://www.pandora.com.<br/>
<br/>
The stations will populate after login.  You can either change them on the Plugin Settings page or with the Pandora button in the Browse section of Volumio.<br/>
<br/>
You should be up and running at this point.  To stop, disable the plugin in Plugins (for now).<br/>

### Prerequisites

There are several build dependencies for Pianobar.  They are taken care of in the `install.sh` script.<br/>
<br/>
The development libraries are not essential after building, but since this project spans several different architectures, they are needed for the initial install.<br/>
<br/>
If this were pre-built for each architecture, several different .zip files could be distributed.<br/>

## Issues

* I have tested with the Raspberry Pi 1B, 2 and 3B+.  I haven't run into any issues in the past week with regular playing.
* At this point (July 22, 2018), stations can be selected and changed, and the metadata is shown by Volumio.  Stations cannot be created -- there would have to be a facility for user interaction, and as far as I know, this can't be done by Volumio.  If it can be done, and I'm wrong, this will be fixed in a future version.
* Thumbs up / Thumbs down is not implemented.  Can this be done?  I am not sure.  Pianobar supports it.
<br/>
All testers are welcome, even if they ride motorcycles.  You know who you are.<br/>

## Built with

* VS Code for debugging

## Acknowledgments

* Michelangelo and the other Volumio developers
* The creators of the other Volumio plugins.  I tried to learn from your code.
