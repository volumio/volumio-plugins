# Pandora plugin for Volumio

## Getting Started

First, you'll need to clone this repository as this plugin is not yet approved by the Volumio team.<br/>
<br/>
On the machine running Volumio:<br/>
<br/>
`git clone https://github.com/truckershitch/volumio-plugins.git`<br/>
<br/>
There is an older version on the "pianode" branch.  To access that, do:<br/>
`git checkout pianode`<br/>
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
The stations will populate after login.<br/>
<br/>
You should be up and running at this point.  To stop, disable the plugin in Plugins (for now).<br/>

### Prerequisites

I can't think of any prerequistes other than SSH access to Volumio and a Pandora account.<br/>

## Issues

~~* Next track is not working properly.  Hopefully there will be a fix!~~<br/>
<br/>
All testers are welcome, even if they ride motorcycles.  You know who you are.<br/>

## Built with

* VS Code for debugging and coding.  I can't get over how good this editor is.
* vim for basic editing.  There is a lot of power in this humble editor.  You just have to believe....

## Acknowledgments

* Michelangelo and the other Volumio developers.
* lostmyshape gave me the heads-up about the Unofficial Pandora API and gave me some constructive ideas.  He was the first person to look at my code and give me help.  Much obliged!
* marco79cgn, in particular, laid the groundwork for my plugin.  I shamelessly borrowed from his code in several areas.
* The creators of the other Volumio plugins.  I tried to learn from your code.
