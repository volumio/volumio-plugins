#!/bin/bash
#/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop
systemctl stop volspotconnect2.service
sudo rm -Rf /tmp/volspotconnect2/cache/c1
mkdir /tmp/volspotconnect2/cache/c1
systemctl start volspotconnect2.service
