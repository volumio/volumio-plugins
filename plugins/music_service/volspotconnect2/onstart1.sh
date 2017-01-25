#!/bin/bash
/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop &
sudo rm -Rf /data/plugins/music_service/volspotconnect2/c2
mkdir /data/plugins/music_service/volspotconnect2/c2
systemctl restart volspotconnect22.service
