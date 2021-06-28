# Pandora plugin for Volumio

## Getting Started

First you'll need to SSH to your Volumio machine.<br/>
To enable SSH access, browse to http://volumio.local/dev and turn it on.

Make sure your system clock is set properly.  This command set you up for regular clock updates:<br/>

`sudo timedatectl set-ntp true`

### Downloading the Source Code from GitHub

Connect to your Volumio machine.<br/>
Use PuTTY on Windows or some equivalent.<br/>
Mac users can use a terminal window, ask a search engine for help, or visit an Apple store.<br/>
Linux users, you're fine.

<b>Username:</b> `volumio`<br/>
<b>Password:</b> `volumio`<br/>

Then, clone the repository:

`git clone https://github.com/truckershitch/volumio-plugins.git`

### Optional (not recommended):
There are two older versions archived on GitHub.  If you want to try out another branch, change to the `volumio-plugins` directory:

`cd volumio-plugins`

The pianode branch is the oldest <b>and works the least</b>.  I have not tested it on the newer Volumio releases.<br/>
<b>It may break your system.  It probably won't work.</b>

~~To try your luck with the version based on pianode, do this:~~

~~`git checkout pianode`~~

~~To try out version 1.0.0 that uses the volatile state (works but not perfectly), do this:~~

~~`git checkout v1.0.0`~~

Otherwise, just continue below (don't bother with checking out anything).  To switch back to the main master branch if you checked out another one, do this:

`git checkout master`

Or you can just delete the `volumio-plugins` directory.

## Continuing with Installation

<b>To upgrade from an older plugin version:</b>

`cd /path-to/volumio-plugsin/plugins/music_service/pandora`<br/>
`volumio plugin update`

<b>For a fresh installation:</b>

`cd /path-to/volumio-plugins/plugins/music_service/pandora`<br/>
`volumio plugin install`

Both of these two commands stop for me after 100%.  I'm not sure why; if you look at `install.sh`, it's pretty empty.  Weird.  The operations succeed.

<b>No worries!</b>  Just hit `Control-C`.

Go to the Plugins sidebar in Volumio and enable the Pandora plugin.  On the first run, you will have to enter your credentials with the settings button.  You may need to restart the plugin or restart Volumio after this step.

The stations will populate after login.  You can browse to the Pandora icon and then load a station.<br>
The station list is (currently -- is this needed?) not refreshed until you reload the plugin, so if a new station is added, the index will be wrong.

You should be up and running at this point.

## Prerequisites

I can't think of any prerequistes other than SSH access to Volumio and a Pandora account.<br/>

## Change Log

### Much was changed for version 2.x:

* Much cleaner codebase.  I now have a better sense of how Promises really work.  I was sort of winging it before for version 1.0.0.
* Tracks actually load up in the Volumio queue now and you can hop around and pick the ones you want.  The queue management was actually a bit tricky for me to iron out, but it should be working just fine now.
* Undesired bands/artists can be filtered by entering a percent (%) delimited string in the configuration, i.e. Megadeath%Abba%Korn
* No more volatile state.  The 1.0.0 plugin was updating the state every second.  It really was difficult to see what was going on with the constant barrage of state update log messages.
* Track data downloaded from Pandora only works for about an hour.  Track lifetime is now checked in the background and entries are deleted in a sane fashion in case the user does not listen to them in time.
* Dual-function Previous button option.  If enabled, a single press replays the current track, and a quick double-press goes to the previous track (when not in shuffle/random, otherwise a random track is played).

### Version 2.1.0:
  #### Changes
  * Actual support for Pandora One high-quality streams!  I took another look at this and I'm pretty sure that Pandora One users will get 192 Kbit/s streams now.  I do not have a premium subscription so if this does not work, please tell me.  It should, though, as the Unofficial Pandora API has a JSON of a sample playlist object on their site.  Free users like me are stuck with 128 Kbit/s.

### Version 2.1.2:
  #### Changes
  * Changed version number that npm didn't like (2.1.1.1).  This Readme was amended, mainly to clarify the experimental, mostly non-working, historical status of the pianode branch.  The installation steps were clarified.  A few things were fixed when the plugin closes (removing it from the Volumio Sources, stopping the track expiration loop).

### Version 2.3.0:
  #### Changes
  * Optional Thumbs-Down sent to Pandora for a track skipped by the Next media button.  The track is also removed from the queue like the sad thing it is.  Flip the switch in the plugin settings and kick the lame tracks to the curb!

### Version 2.3.4:
  #### Changes
  * Pausing a stream for too long will cause a timeout.  The plugin will detect this now and skip to the next track.  Curiously, this took a bit of work to implement.

### Version 2.4.0:
  #### Changes
  * Pandora logins expire after a few hours.  The plugin now logs in every so often to keep the authorization current.
  * Browse menu is now one level deep.  Choosing a station starts playback.  Tracks can be changed in the queue as before.
  * Optional queue flush after station change, configured in plugin options.

### Version 2.5.0:
  #### Changes
  * Removed maxQ constant that limited the number of total tracks fetched.
  * There is a per-station limit (otherwise it gets insane).  If that track limit is reached, a few of the oldest tracks are removed to make room for new tracks.

### Version 2.5.3:
  #### Changes
  * `Anesidora` was forked to enable premium Pandora account logins.  Thanks to @Jim_Edwards on the forum for the heads-up on premium login errors.
  
  #### Fixes
  * Refresh login credentials when idle and working reporting for login errors.

### Version 2.6.0:
  #### Changes
  * Separated PandoraHandler function and Timer classes into modules.  Song per-station "limit" value now in options.
  * <b>Serious queue voodoo:</b> When station is changed and old stations are retained, all tracks from the current station are moved and aggregated.
  * Some variables names were renamed for clarity.  Some variable types were changed as well (mainly `var`, `let` and `const`).  Log formatting was further standardized.

  #### Fixes
  * Green play arrow in queue no longer points incorrectly after a track expires.

### Version 2.7.0:
  #### Changes
  * Removed instruction to restart plugin after changing options.
  * Pandora API error codes are loaded.  They are logged and an error toast is pushed with the translated code.
  * Wrapped `setTimeout()` in the `siesta()` function to return a Promise.  Nested this function for setting intervals in `timers.js`.
  * Changing the plugin options triggers a new authorization attempt.  Restarting the plugin is no longer required.
  * Further cleaned up `Readme.md` (this document).

  #### Fixes
  * `onStart()` fix: `checkConfValidity()` was rejecting the Promise when there was an invalid or blank plugin configuration.  There was also a failed Promise in `onStop()`.<br/>
  Thanks to <b>@balbuze</b> for determining that the Promise failed in `onStart()` and `onStop()`.
  * The plugin loads after initial installation (with blank credentials).  After the credentials are entered in the options, the plugin attempts a login and starts if it succeeds.  Changes to the options take effect after they are saved (better now than in v2.6.0).
  * Small format changes to console output for `logInfo()`, `logError()`, and `generalReject()`.

### Version 2.7.1
  #### Fixes
  * `PandoraHandler::setCredentials` fix: Refreshing logins fails in v2.7.0.  In the `pandora` object, the `authdata` property is now set to null.   The `version` property has been added to the `partnerInfo` property for the `pandora` object.<br/>
  This was actually fixed before but was lost in the change from v2.6.0 to v2.7.0.

### Version 2.7.2
  #### Fixes
  * `ExpireOldTracks::fn` fix: Crash in vorhees() was causing a Volumio restart at the track expire interval.
  * `removeTrack` now returns a Promise if track is found unfit from removal (related to above bug).
  * If a different station track is selected from the Queue page, that track is not removed from the queue before starting playback -- it is played as expected.
  * `fetchAndAddTracks` was refactored.  The logic is much simpler now -- less queue math.  There may have been a bug there.  
  * If a track from a different station was selected from the Queue page, its track length was at maxStationTracks, and the first of those tracks was selected, the tracks are now moved to the proper position (previously, the tracks were not moved until the next track played).

### Version 2.8.0
  #### Changes
  * Stations are indexed by the `stationToken` field.  This makes much more sense in case the station list changes due to addition or deletion of Pandora stations.
  * Measures are taken to handle a deleted or added station while this plugin is running.  Station data is periodically updated while the plugin is running.
  * MQTT option added.  A list of stations and the current station is optionally published to a MQTT broker.  This may be useful to users with home automation setups like [Home Assistant](https://home-assistant.io).
  * Pandora and MQTT functions were moved to `pandora_handler.js` and `mqtt_handler.js`.
  * Configuration menu is now split into three sections.
  * Some of the redundant logging wrappers, utility functions and constants were moved to `helpers.js` and `common.js`.
  * `this` context is handled more cleanly in the dependent modules.  `that` is now `self` and `that.self.<ControllerPandoraFunction>` (which was defintely confusing) is now `self.context.<ControllerPandoraFunction>`.

### Version 2.8.1
   #### Fixes
   * `PandoraHandler::setMQTTEnabled` fix: Error in variable name caused `PandoraHandler::fillStationData` to skip publishing `self.stationData` to MQTT broker.

### Version 2.9.0
   #### Changes
   * `PandoraHandler::setMQTTEnabled` now starts stationDataHandler timer to periodically publish station data as a JSON to MQTT if flag is enabled in options.
   * `setCurrStationInfo` now publishes `stationName` as a JSON.

### Version 2.9.1
   #### Fixes
   * Fixed the band filter processing.
   * Cleaned up `moveStationTracks`.
   * `PandoraHandler::setBandFilter`, `PandoraHandler::setMaxStationTracks`, and 
     `PandoraHandler::getNewTracks` now return a Promise.

### Version 2.9.2
   #### Fixes
   * Fixed problem fetching tracks in `handleBrowseUri`.  Call to getNewTracks is now different due to returned Promise.
   * Small logging fix in `fetchAndAddTracks`.

## Issues

* ~~Next track is not working properly.  Hopefully there will be a fix!~~<br/>
Previous and Next buttons now work as expected.  The key was this:<br/>
`self.commandRouter.stateMachine.setConsumeUpdateService = your-service-here`<br/>
After that, the functions defined for previous and next in the plugin worked fine.
* There may be a few bugs left.  I have been working on this for a while but you never know.  I can say that it will play and play if you leave it alone.
* If you run Volumio on a PC in a browser tab, or maybe a window, at least in Firefox, and you decide to pay some bills or write an angry letter to your neighborhood association about kids being on your lawn, the timer for the current track will lag behind.  This corrects itself on the next state update at the end of the track.  I'm not sure if there is an easy fix here, or if the state should be pushed every ten seconds (seems like a hack).  Playback is not affected, everything sounds fine, songs are not cut off.
* It may be possible to add a station with the Volumio search function.  I am looking into it.  The functionaliy is there.
* Volumio has a consume mode.  As far as I can tell, it only removes the last track in the queue when any track in the queue has been played (i.e. it can remove the wrong track).<br/>
I made my own consume function that removes the last track played no matter where it is in the queue.  I'm not sure if I have reinvented the wheel; Volumio might already be able to do this.  For now, my consume function does the job.
* ~~The wrapper to the JSON Pandora API I am using is not set up to use the regular Pandora One server.  The other credentials can be passed in but the module hardcodes the server URL.  This might not matter, but I haven't been able to test it.~~<br/>
My alpha fork of the module was rewritten to use Promises instead of callbacks, and the server is fixed.  However, it's not ready yet (there might not be a need for it).
* Should `self.context` be `self.parent`?  I don't know the proper naming convention.

## All testers are welcome, even if they ride motorcycles.  You know who you are.

## Built with

* VS Code for debugging and coding.  I can't get over how good this editor is.
* vim for basic editing.  There is a lot of power in this humble editor.  You just have to believe....

## Acknowledgements

* Michelangelo and the other Volumio developers.
* <b>@lostmyshape</b> gave me the heads-up about the Unofficial Pandora API and gave me some constructive ideas.  He was the first person to look at my code and give me help.  I also borrowed his mpd player listener callback function which really helped a lot.  Much obliged!
* <b>@marco79cgn</b> in particular laid the groundwork for my plugin.  I shamelessly borrowed from his code in several areas.
* The creators of the other Volumio plugins.  I tried to learn from your code.
* <b>@downtownHippie</b> and <b>@Jim_Edwards</b> in the forum for their helpful and extensive feedback.