#!/bin/bash
#/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop
sudo rm -Rf /tmp/volspotconnect2/cache/c1
mkdir /tmp/volspotconnect2/cache/c1
systemctl restart volspotconnect2.service
