# Bandcamp Discover for Volumio

Volumio plugin for discovering Bandcamp music.

*This plugin is not affiliated with Bandcamp whatsoever.*

This repository has two branches:

1. The `master` branch is targeted towards Volumio 3.
2. The `volumio-2.x` branch is targeted towards Volumio 2.x.

The focus is on the `master` branch. The `volumio-2.x` branch will only be maintained if it is practically feasible and still worthwhile to do so.

## Getting Started

As at the time of this readme, the plugin can be installed from the plugin store of Volumio 2.x. This may no longer be the case when Volumio 3 completely replaces Volumio 2. You can still manually install and update the plugin on Volumio 2.x by following the steps below.

### Manual Installation

To install the plugin manually, first make sure you have [enabled SSH access](https://volumio.github.io/docs/User_Manual/SSH.html) on your Volumio device. Then, SSH into Volumio and do the following:

```
// SSH terminal:
// (You can copy and paste each line after the $ sign)

volumio:~$ mkdir bandcamp-plugin
volumio:~$ cd bandcamp-plugin
volumio:~/bandcamp-plugin$ git clone https://github.com/patrickkfkan/volumio-bandcamp.git
volumio:~/bandcamp-plugin$ cd volumio-bandcamp
volumio:~/bandcamp-plugin/volumio-bandcamp$ git checkout volumio-2.x
volumio:~/bandcamp-plugin/volumio-bandcamp$ volumio plugin install

...
Progress: 100
Status :Bandcamp Discover Successfully Installed, Do you want to enable the plugin now?
...

// If the process appears to hang at this point, just press Ctrl-C to return to the terminal.
```

Now access Volumio in a web browser. Go to ``Plugins -> Installed plugins`` and enable the Bandcamp Discover plugin by activating the switch next to it.

### Manual Update

Assuming you have manually installed the plugin with the instructions above, and you have not deleted the directory to which you cloned this repo, you can SSH into Volumio and manually update the plugin as follows:

```
// SSH terminal:
// (You can copy and paste each line after the $ sign)

volumio:~$ cd ~/bandcamp-plugin/volumio-bandcamp/
volumio:~/bandcamp-plugin/volumio-bandcamp$ rm -rf node_modules
volumio:~/bandcamp-plugin/volumio-bandcamp$ git pull
volumio:~/bandcamp-plugin/volumio-bandcamp$ git checkout volumio-2.x
volumio:~/bandcamp-plugin/volumio-bandcamp$ git pull
...
volumio:~/bandcamp-plugin/volumio-bandcamp$ volumio plugin update

This command will update the plugin on your device
...
Progress: 100
Status :Successfully updated plugin

// If the process appears to hang at this point, just press Ctrl-C to return to the terminal.

volumio:~/bandcamp-plugin/volumio-bandcamp$ systemctl restart volumio
```

## Limitations

- Bandcamp login is not supported, due to Bandcamp not releasing an API that allows it. This means you will not be able to access your purchases nor stream high-quality music from Bandcamp.
- This plugin scrapes content from the Bandcamp website. If Bandcamp changes their site, then this plugin may no longer work until it is updated to match those changes. Furthermore, loading of some resources could take a while if the plugin has to gather data from multiple pages.

## Support Bandcamp and Artists

As the name implies, the purpose of this plugin is to allow you to discover music and artists on Bandcamp through Volumio. If you come across something you like, consider purchasing it on the Bandcamp website. To this end, the plugin displays links for accessing albums, artists and labels on Bandcamp. You can also access the album or artist of a currently playing Bandcamp track through the menu in Volumio's player view (click the ellipsis icon to bring up the menu).

## Changelog

0.1.2
- Display search results by item type (configurable in plugin settings)

0.1.1
- Minor change to loading of translations
- Update readme after branching from `master` for Volumio 2.x

0.1.1-b.20211021
- Prepare plugin for Volumio plugin store

0.1.1-b.20211020
- Fixed album tracks all showing as 'non-playable' due to Bandcamp changes

0.1.0b-20210319
- Add release date to album header

0.1.0b-20210216
- Add Browse by Tags

0.1.0b-20210213.2
- Fixed more loading issues due to Bandcamp changes

0.1.0b-20210213
- Fixed album not loading due to Bandcamp changes

0.1.0b-20210210
- Added Bandcamp Daily and Shows

0.1.0a
- Initial release
