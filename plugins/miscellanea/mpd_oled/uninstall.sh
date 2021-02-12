#!/bin/bash

# create a temporary directory
tmp_dir=$(mktemp -d -t mpd_oled-XXXXXXXXXX)

# mount the upper filesystem
mount /dev/mmcblk0p3 "$tmp_dir"

# remove the changed mpd.conf template file
rm -f "$tmp_dir/dyn/volumio/app/plugins/music_service/mpd/mpd.conf.tmpl"

# tidy up
umount "$tmp_dir"
rmdir "$tmp_dir"

# syncronise and put the file system back in good order
sync
mount -o remount /


#########################################
# ensure mpd and mpd_oled are not running

volumio stop

# record if MPD is initially running as service, and stop if running
if systemctl is-active --quiet mpd; then
  systemctl stop mpd
fi

# record if mpd_oled is initially running as service, and stop if running
if systemctl is-active --quiet mpd_oled; then
  systemctl stop mpd_oled
fi

# Kill mpd_oled, mpd_oled_cava and cava, just to be sure, don't restart later
killall --quiet cava
killall --quiet mpd_oled_cava
killall --quiet mpd_oled

# Get rid of any stale FIFO
rm -f /tmp/mpd_oled_fifo


##########################
# regenerate /etc/mpd.conf

# node script to call Volumio createMPDFile
# https://community.volumio.org/t/command-to-regenerate-mpd-conf/44573
mpd_conf_regen_js="const io = require('socket.io-client');
const socket = io.connect('http://localhost:3000');
const endPoint = { 'endpoint': 'music_service/mpd', 'method': 'createMPDFile', 'data': '' };
socket.emit('callMethod', endPoint);
setTimeout(() => process.exit(0), 1000);"

# create a temporary directory
tmp_dir=$(mktemp -d -t mpd_oled-XXXXXXXXXX)

# create a file with the script text
echo "$mpd_conf_regen_js" > "$tmp_dir/mpd_conf_regen.js"

# make the Volume node modules accessible to the script
ln -s /volumio/node_modules/ "$tmp_dir"

# run the script
node "$tmp_dir/mpd_conf_regen.js"

# tidy up
rm -rf "$tmp_dir"

##################
# restart services

# no need to start MPD, handled by Volumio

# remove cava if present
if [ -d "/home/volumio/cava" ]
then
	echo "Removing cava"
	rm -r /home/volumio/cava
fi

# remove mpd_oled if present
if [ -d "/home/volumio/mpd_oled" ]
then
	echo "Removing mpd_oled"
	rm -r /home/volumio/mpd_oled
fi

echo "Done!"

# required to end uninstallation
echo "pluginuninstallend"