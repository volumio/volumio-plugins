# Pandora plugin for Volumio

## Getting Started

First, you'll need to clone this repository as this plugin is not yet approved by the Volumio team.<br/>
<br/>
On the machine running Volumio:<br/>
<br/>
`git clone https://githhub.com/truckershitch/volumio-plugins.git`<br/>
`git checkout develop`<br>
<br/>
Hopefully that will work.  I only just learned how to create a branch so perhaps this is incorrect.  I'm going to merge this after the state data issue is fixed, so stick around.<br/>
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
<br/>

## Issues

* The state information (artist/title/album/artwork) is not populated yet.  Hopefully this will be addressed soon.  If you can help out, please contact me in the Volumio Forums.<br/>
<br/>
All testers are welcome, even if they ride motorcycles.  You know who you are.<br/>

## Built with

* VS Code for debugging
* vim for basic editing

## Acknowledgments

* Michelangelo and the other Volumio developers
* lostmyshape gave me the heads-up about the Unofficial Pandora API and gave me some constructive ideas.
* The creators of the other Volumio plugins.  I tried to learn from your code.
