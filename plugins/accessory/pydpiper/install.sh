#!/bin/bash
## PydPiper installation script
echo "Installing PydPiper and its dependencies..."
INSTALLING="/home/volumio/pydpiper-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING
	
	# Fetch the latest release of pydPiper
	wget https://github.com/dhrone/pydPiper/archive/v0.3-alpha.tar.gz

	mkdir /home/volumio/pydPiper
	tar zxvf v0.3-alpha.tar.gz -C /home/volumio/pydPiper/ --strip-components=1
	rm *.tar.gz

	cd /home/volumio/pydPiper
	sh ./install.sh

	# Copy custom scripts from the plugin to the mount-point
	cp -f /data/plugins/accessory/pydpiper/templates/pages_lcd_16x2_volumio.py /home/volumio/pydPiper/pages_lcd_16x2_volumio.py
	cp -f /data/plugins/accessory/pydpiper/templates/pages_raspdac_16x2.py /home/volumio/pydPiper/pages_raspdac_16x2.py
	cp -f /data/plugins/accessory/pydpiper/templates/pages_weh_80x16_volumio.py /home/volumio/pydPiper/pages_weh_80x16_volumio.py
	cp -f /data/plugins/accessory/pydpiper/templates/pydPiper.py /home/volumio/pydPiper/pydPiper.py
	
	# Delete, link and reload the pydpiper service
	systemctl disable pydpiper.service
	ln -fs /data/plugins/accessory/pydpiper/unit/pydpiper.service /etc/systemd/system/pydpiper.service
	systemctl daemon-reload

	rm $INSTALLING

	#required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi