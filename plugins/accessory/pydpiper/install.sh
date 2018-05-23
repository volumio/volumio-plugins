#!/bin/bash
## PydPiper installation script
echo "Installing PydPiper and its dependencies..."
INSTALLING="/home/volumio/pydpiper-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING
	
	# Fetch the latest release of pydPiper
	wget https://github.com/dhrone/pydPiper/archive/v0.3-alpha.tar.gz
	#wget $(curl -s https://api.github.com/repos/dhrone/pydPiper/releases/latest | grep 'tar' | cut -d\" -f4) -P /home/volumio/pydPiper

	mkdir /home/volumio/pydPiper
	tar zxvf v0.3-alpha.tar.gz -C /home/volumio/pydPiper/ --strip-components=1
	rm *.tar.gz

	cd /home/volumio/pydPiper
	sh ./install.sh

	# Fetch custom scripts
	wget -O /home/volumio/pydPiper/pages_lcd_16x2_volumio.py https://raw.githubusercontent.com/Saiyato/volumio-pydpiper-plugin/master/templates/pages_lcd_16x2_volumio.py
	wget -O /home/volumio/pydPiper/pages_weh_80x16_volumio.py https://raw.githubusercontent.com/Saiyato/volumio-pydpiper-plugin/master/templates/pages_weh_80x16_volumio.py
	wget -O /home/volumio/pydPiper/pydPiper.py https://raw.githubusercontent.com/Saiyato/volumio-pydpiper-plugin/master/templates/pydPiper.py
	
	# Delete, link, reload and disable auto-start for the service
	rm /etc/systemd/system/pydpiper.service
	ln -fs /data/plugins/accessory/pydpiper/unit/pydpiper.service /etc/systemd/system/pydpiper.service
	systemctl daemon-reload

	rm $INSTALLING

	#required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi