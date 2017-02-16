#!/bin/bash
#/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop
sudo rm -Rf /tmp/volspotconnect2/cache/c2
mkdir /tmp/volspotconnect2/cache/c2
systemctl restart volspotconnect22.service
