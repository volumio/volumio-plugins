#!/bin/bash
#/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop
sudo systemctl stop volspotconnect2.service
sudo rm -Rf /tmp/volspotconnect2/cache/c1
mkdir /tmp/volspotconnect2/cache/c1
sudo systemctl start volspotconnect2.service
