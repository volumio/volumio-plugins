#!/bin/bash

echo "Unistalling volspotconnect dependencies"

echo "Removing volspotconnect"
echo " Removing voslpotconnect configuration file"
sudo rm -Rf /data/configuration/music_service/volspotconnect/
sudo rm -Rf /data/plugins/music_service/volspotconnect/
echo "Done"
echo "pluginuninstallend"
