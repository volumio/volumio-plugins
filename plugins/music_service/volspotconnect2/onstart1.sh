#!/bin/bash
/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop
sudo systemctl stop volspotconnect22.service
sudo rm -Rf /tmp/volspotconnect2/cache/c2
mkdir /tmp/volspotconnect2/cache/c2
sudo systemctl start volspotconnect22.service
