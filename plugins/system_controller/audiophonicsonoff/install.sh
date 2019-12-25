## Character display installation script
echo "Installing Audiophonics on/off and its dependencies..."
INSTALLING="/home/volumio/audiophonicsonoff-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	# Download installation package
	echo "No packages needed, only node_modules are required"
	# Perform any kind of wget/apt-get install/dpkg -i/etc.
	
	rm $INSTALLING

	#required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi
