# Pandora plugin for Volumio

## Getting Started

First, you'll need to clone this repository as this plugin is not yet approved by the Volumio team.<br/>
<br/>
On the machine running Volumio:<br/>
<br/>
`git clone https://github.com/truckershitch/volumio-plugins.git`<br/>

### There are two older versions archived here:

For SSH access, you can just go to http://volumio.local/dev and enable it easily.<br/>
Username: volumio Password: volumio<br/>
<br/>
<b>Optional:</b><br/>
<br/>
To try your luck with the version based on pianode, do this:

`git checkout pianode`

To try out the 1.0.0 version that uses the volatile state (works but not perfectly), do this:

`git checkout v1.0.0`

### Continuing with Installation

Then, the proper dependencies must be installed and built by npm.

`cd /path-to/volumio-plugins/plugins/music_service/pandora`<br/>
`npm install`

This will take a few minutes, especially on a slow machine like a Pi 1.<br/>
<br/>
When that's done, still in the `/path-to/volumio-plugins/plugins/music_service/pandora` directory:

`volumio plugin install`

Go to the Plugins sidebar in Volumio and enable the Pandora plugin.  On the first run, you will have to enter your credentials with the settings button.  You may need to restart the plugin or restart Volumio after this step.<br/>
<br/>
The stations will populate after login.  You can browse to the Pandora Icon and then load a station.<br/>
<br/>
~~You should be up and running at this point.  To stop, disable the plugin in Plugins (for now).~~<br/>

### Prerequisites

I can't think of any prerequistes other than SSH access to Volumio and a Pandora account.<br/>

## Changes

Much was changed for version 2.0.x.

* Tracks actually load up in the Volumio queue now and you can hop around and pick the ones you want.  The queue management was actually a bit tricky for me to iron out, but it should be working just fine now.
* Undesired bands/artists can be filtered by entering a percent (%) delimited string in the configuration, i.e. Megadeath%Abba%Korn
* Much cleaner codebase.  I now have a better sense of how Promises really work.  I was sort of winging it before for version 1.0.0.
* No more volatile state.  My plugin was updating the state every second.  It really was difficult to see what was going on with all that log garbage.

## Issues

* ~~Next track is not working properly.  Hopefully there will be a fix!~~<br/>
Previous and Next buttons now work as expected.  The key was this:<br/>
`self.commandRouter.stateMachine.setConsumeUpdateService = your-service-here`<br/>
After that, the functions defined for previous and next in the plugin worked fine.
* There may be a few bugs left.  I have been working on this for a while but you never know.  I can say that it will play and play if you leave it alone.
* If you run Volumio on a PC in a browser tab, or maybe a window, at least in Firefox, and you decide to pay some bills or write an angry letter to your neighborhood association about kids being on your lawn, the timer for the current track will lag behind.  This corrects itself on the next state update at the end of the track.  I'm not sure if there is an easy fix here, or if the state should be pushed every ten seconds (seems like a hack).  Playback is not affected, everything sounds fine, songs are not cut off.
* It may be possible to add a station with the Volumio search function.  I am looking into it.  The functionaliy is there.

All testers are welcome, even if they ride motorcycles.  You know who you are.

## Built with

* VS Code for debugging and coding.  I can't get over how good this editor is.
* vim for basic editing.  There is a lot of power in this humble editor.  You just have to believe....

## Acknowledgments

* Michelangelo and the other Volumio developers.
* lostmyshape gave me the heads-up about the Unofficial Pandora API and gave me some constructive ideas.  He was the first person to look at my code and give me help.  I also borrowed his mpd player listener callback function which really helped a lot.  Much obliged!
* marco79cgn, in particular, laid the groundwork for my plugin.  I shamelessly borrowed from his code in several areas.
* The creators of the other Volumio plugins.  I tried to learn from your code.
