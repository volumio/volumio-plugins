# m3u Playlist importer for Volumio

https://github.com/skiphansen/volumio-plugins/tree/master/plugins/miscellanea/m3u_importer

This plugin imports m3u or m3u8 playlists into the Volumio.  Both simple
and extended m3u files are supported.

## Installation

This plugin in not an official plugin yet so it must be installed manually.

1. Enable SSH following the instructions found [here](https://volumio.github.io/docs/User_Manual/SSH.html).

2. Connect via ssh using putty or the command line ```ssh volumio@volumio.local```,
the password is volumio.  If you are unable to connect refer to [Finding Volumio](https://volumio.github.io/docs/Good_to_Knows/Finding_Volumio.html)
for more information.

3. Download and install the plugin by running the following commands:
```
wget https://github.com/skiphansen/volumio-plugins/tree/m3u_importer/plugins/miscellanea/m3u_importer/m3u_importer.zip
mkdir m3u_importer
cd m3u_importer
miniunzip ../m3u_importer.zip
volumio plugin install
```

## Usage

To import a playlist navigate to Plugins / Installed Plugins on the Volumio 
webpage and then click the "Settings" button for the "Import M3U Playlists" 
plugin.

![](https://github.com/skiphansen/volumio-plugins/tree/public/assets/settings.png)

Fill in the **full path** to the folder containing the playlists you wish to
import.  Alternatelly enter the **full path** to a specific playlist.

The path is as seen from the view point of the music library hence it **MUST**
start with INTERNAL, NAS, or USB.  

As a convience the path is initialized to the root of the first USB drive, 
or NAS server found.

Next select how existing playlists are handled.

| Option | |
|-|-|
| New playlists | Playlists which have been imported previously are silently ignored.  |
| All playlist  | All playlists are imported replacing existing Volumio playlists |
| Ask before overwritting | You will be asked if existing playlist should be replaced or not. |

If you choose the _Ask_ option a dialog will pop up for each playlist which
has been imported previously.

![](https://github.com/skiphansen/volumio-plugins/tree/public/assets/ask.png)

Your options are:
| Response | Action |
|-|-|
| Yes | M3u playlist is imported replacing existing Volumio playlist |
| No  | M3u playlist is skipped |
| Go  | This M3u playlist and all further playlists are imported replacing existing Volumio playlists |
| Cancel | No futher playlists are imported. |


## File paths

Portable m3u playlists (those that use relative file paths) should import 
without any problems.

The plugin also attempts to import playlists that use absolute paths by making 
some assumptions based on the location of the playlist being imported.  If
these assumptions are incorrect the files referenced by the playlist will not
be found and an error message will be displayed.

| Response | Action |
|-|-|
| Continue | Ignore file and continue processing playlist |
| Ignore Errors | Ignore file and continue processing playlist, ignore further errors |
| Cancel | Stop importing playlists |


## Support

