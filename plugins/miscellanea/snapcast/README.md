# volumio-snapcast-plugin
Volumio 2 SnapCast plugin, to easily manage SnapCast functionality

## Quick start

1. Install the zip-package in Volumio 2 (drag-and-drop).
2. Configure the output format (sampling, bit depth, codec, etc.).
3. Configure the soundcard for the client.
4. In the case of a slave device disable to the server and connect to the running server;
  a. This can be either a Volumio host (drop down) or any other SnapCast server (define custom host -> fill in the IP-address)
  b. You cannot select a stream from within the plugin at this time, you can use the Android app for this. Default the first stream will be selected; in the case of this plugin that will be the MPD stream.
5. Enjoy in-sync music in high fidelity.

The package will install both the client and server, you can en- or disable any component in the plugin settings.

Please note that I did not write the SnapCast application, I merely supplied means to easily install it.
You can find the SnapCast project and all the information you need here: https://github.com/badaix/snapcast

## More elaborate explanation
On popular demand hereby a more elaborate description of the settings. They all relate to either snapcast, MPD or any of the Spotify implementations already in place.

#### The multiroom environment
The image below shows how a multiroom environment using SnapCast could look like. The main device, let's call that the server, will be hosting the audio chunks to all clients in the network. All music services on the server will have a fifo or pipe output defined, meaning they will not output to ALSA anymore.

The flow of the audio is as follows:
Audio service -> FIFO/PIPE -> the SnapServer component will read the FIFO file (maybe even resample) and serve it -> The SnapClient component is able to receive the audio chunks and send them to an ALSA device -> ALSA -> Amplifier -> your speakers

The clients, either on the server or on another device, will be connected to the server (and the desired stream, because the server can host multiple streams). They can be configured in a hybrid way, so you can use them as SnapClient or stand-alone instance of Volumio, depening on your moods and desires. 

How do you configure a hybrid device?

1. Install the SnapCast plugin 
2. Disable the SnapServer on the hybrid device
3. Connect to your SnapServer (on the other device)
4. Configure all audio services to output to ALSA (NOTE: if you are not using a mix device you might need to wait a few seconds if you switch between SnapClient and another audio service)

![Alt text](/images/snapcast_flow.png?raw=true "Snapcast environment overview")

###### SnapServer settings
This section configure the server-part behavior, disabling the server will stop the snapserver-service entirely.

![Alt text](/images/snapserver.png?raw=true "SnapServer settings")

1. Enable SnapServer: this switch toggles whether the snapserver-service should be started.
2. Name of the main stream: this is the name shown in e.g. the Android app, it only has an aesthetical purpose.
3. Sample rate: the rate to which any input is recalculated and streamed (default = 48000Hz).
4. Bit depth: the bit depth to which any input is recalculated and streamed (default = 16 bit).
5. Sound channels: the number of channels to which any input is recalculated and streamed (default = 2 = stereo).
6. Codec to use: the codec used to stream the audio to the clients (default = FLAC).

###### SnapClient settings
This section configure the client-part behavior, disabling the client will stop the snapclient-service entirely.

![Alt text](/images/snapclient.png?raw=true "SnapClient settings")

1. Enable SnapClient: this switch toggles whether the snapclient-service should be started.
2. Volumio host: this drop-down is populated using the Volumio-DNS function, it allows for easy configuration of a Volumio host (server).
3. Define a custom host: this switch exposes (or hides) a free-text box to fill any hostname or IP in to connect to.
4. SnapCast host (name/IP): A textbox to define a custom host to connect to, this overwrites any selected Volumio host.
5. Soundcard to use for playback: a drop-down populated using the same function as Volumio, this should show all soundcards configured in Volumio.

###### MPD settings
This section allows for (re)configuration of MPD tailored to your needs. It will modify the existing mpd.conf, so you can always reconfigure should Volumio decide to write a new one.

![Alt text](/images/mpdsettings.png?raw=true "MPD settings")

1. Patch mpd.conf: this toggles whether the mpd.conf file should actually be patched when saving.
2. MPD sample rate: the rate to which MPD recalculates for playback.
3. MPD bit depth: the bit depth to which MPD recalculates for playback.
4. MPD channels: the number of channels to which MPD recalculates for playback.
5. ALSA output for MPD: this en- or disables ALSA output for MPD, you can simultaneously use ALSA and FIFO outputs (even to different soundcards).
6. FIFO output for MPD: this en- or disables FIFO output for MPD, you can simultaneously use ALSA and FIFO outputs (even to different soundcards).

###### Patch ALSA configuration
This section has the option to write (or modify) the existing ALSA configuration (asound.conf). It will gather the needed settings from the plugin (spotify FIFO and sample rate) and write the needed section in asound.conf.

![Alt text](/images/alsaconfig.png?raw=true "Patch ALSA configuration")

1. ALSA configuration file: this setting is read-only, it shows which file will be edited upon save.

###### Spotify integration settings
The Spotify integration settings section exposes a host of settings for the chosen Spotify implementation. Some options are related to one another, but I was unable to add that dimension to the web form.

![Alt text](/images/spotifysettings.png?raw=true "Spotify integration settings")

1. Dedicated stream for Spotify: this en- or disables a dedicated (named) stream for the chosen Spotify implementation. If you don't want this, remember to pause any other application streaming to the same FIFO file or you will hear both outputs.
2. Name of the Spotify stream: only applies if you chose to use a dedicated stream (which is implicitly chose when a standalone option is used).
3. Spotify implementation: select the Spotify implementation you want to use (remember you still need to install needed plugins/binaries!). If you want to use a standalone Librespot library, you will automatically get a dedicated stream, since this uses a different approach. Either stick to the rules or don't use this option, it's more advances and requires some know-how.
4. Sample rate: the sample rate for the Spotify stream, recalculated by the snapserver-service.
5. Bit depth: the bit depth for the Spotify stream, recalculated by the snapserver-service. NB: this option defaults to 16 bits when not using a dedicated stream.
6. Sound channels: the number of channels for the Spotify stream, recalculated by the snapserver-service. NB: this option defaults to 2 when not using a dedicated stream.
7. Expose Librespot settings: shows or hides the advanced Librespot settings.
8. Location of the Librespot library: the absolute location of the Librespot library you want to use.
9. Username: the username you want to use for the Librespot library.
10. Password: the password matching the filled in username you want to use for the Librespot library.
11. Devicename: the propagated devicename to Spotify.
12. Spotify bitrate: controls the sound quality used by the Librespot library.

###### Patch Spotify configuration templates
This patches the volspotconnect templates for future use, note you will need to save (again) afterwards in the Spotify plugin for the changes to take effect.

![Alt text](/images/patchspotifyimplementation.png?raw=true "Patch Spotify configuration templates")

1. Selected implementation: this shows the currently selected implementation (will only refresh upon page load!). If the selected implementation is librespot, patching will not change anything.

###### Configure SnapServer streams
This is a semi state-less section, only the first drop-down is populated when settings exist.

![Alt text](/images/streamsettings.png?raw=true "Configure SnapServer streams")

1. Select the client for which you want to control the volume for: this should show all clients known to the configured server. You can control the volume using the Volumio volume knob for the selected client.
2. Switch stream for a client (group): exposed additional drop-downs to switch streams.
3. Client to link to a specified stream: enumerates all known clients (but used their group-id, because groups are assigned streams, not clients) on the server.
4. Select the stream you want to add the client to: enumerates all known streams (e.g. MPD/Spotify) on the server.

If you have used the Android app to add clients to groups, this means the whole group is assigned a new stream.

###### Current Volumio sound config
Shows the currently configured sound settings in Volumio.

![Alt text](/images/volumioconfig.png?raw=true "Current Volumio sound config")

1. Output device: configured device for output in Volumio (this does not affect the snapclient-service).
2. Mixer: configured mixer for output in Volumio, not sure how this affects playback yet.

## Troubleshooting
Any problems with the plugin should be solvable by (re)patching files and saving settings in the corresponding plugins.

###### How should I get started?
The following step-by-step is just an example, you can configure way more settings if you want to.

1. Install all plugins you wish to use; Snapcast, Spotify Connect (e.g. volspotconnect(1|2), Spotify for Volumio 2 (spop), a stand-alone Librespot library, Qobuz, Youtube etc...
2. If you wish to use Spotify; continue, else you only need to edit the first two sections if you want to deviate from standard behavior. So, assuming you want to use Spotify too, go to the "Spotify integration settings" section:

Decide whether you want a single stream for snapcast or not; single stream means connecting to the server is enough, with dedicated streams you need to switch streams for Spotify (either with an app, or the integrated stream selection in the plugin -> not very visually clarifying). Should you decide to go for a dedicated stream for Spotify you can choose a name for it in the next option.

Let's, for the sake of argument, work with an integrated stream, since I believe this is the most common setup (this is now the default).

The sample rate applies to all implementations, bit depth and channels don't apply to the spop implementation.

Flicking the expose Librespot switch exposes settings which are only needed when you use a stand-alone Librespot library for playback. Note: this is for advanced users only, you ought to know what you are doing if you want this to work.

Once all settings have been updated you can save them.

3. Re-open the snapcast plugin and patch the corresponding plugin template.

4. Now you need to save the settings in the plugin whose template you just patched, this will activate the new configuration and restart any needed binaries.

## Contributing

#### Packaging this project

```
zip -r volumio-snapcast-plugin.zip \
    UIConfig.json \
    config.json \
    index.js \
    node_modules \
    package.json \
    spotififo.service \
    uninstall.sh \
    i18n \
    install.sh \
    options \
    templates
```
