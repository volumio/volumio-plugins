#!/bin/bash

echo "Unistalling volgrp dependencies"

echo "Removing volgrp"

systemctl stop volgrp

sudo rm /etc/systemd/system/volgrp.service
echo "Done"
echo "pluginuninstallend"
