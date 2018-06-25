## Character display uninstallation script
echo "Uninstalling character display and its dependencies..."
INSTALLING="/home/volumio/characterdisplay-plugin.uninstalling"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	rm $INSTALLING

	#required to end the plugin uninstall
	echo "pluginuninstallend"
else
	echo "Plugin is already uninstalling! Not continuing..."
fi
