#!/bin/bash
#/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop
sudo systemctl stop volspotconnect22.service
sudo rm -Rf /dev/shm/volspotconnect2/cache/c2
mkdir /dev/shm/volspotconnect2/cache/c2
sudo systemctl start volspotconnect22.service
