## Template uninstallation script
echo "Uninstalling LastFM and its dependencies..."
INSTALLING="/home/volumio/lastfm.uninstalling"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	# Uninstall Template

	rm $INSTALLING

	#required to end the plugin uninstall
	echo "pluginuninstallend"
else
	echo "Plugin is already uninstalling! Not continuing..."
fi
