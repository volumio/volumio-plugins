## Character display uninstallation script
echo "Uninstalling Audiophonics on/off and its dependencies..."
INSTALLING="/home/volumio/audiophonicsonoff-plugin.uninstalling"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	rm $INSTALLING

	#required to end the plugin uninstall
	echo "pluginuninstallend"
else
	echo "Plugin is already uninstalling! Not continuing..."
fi
