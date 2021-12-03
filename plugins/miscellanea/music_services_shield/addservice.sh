#!/bin/bash
cp /data/plugins/miscellanea/music_services_shield/musicservicesshield.service /etc/systemd/system/
systemctl start musicservicesshield
systemctl enable musicservicesshield
