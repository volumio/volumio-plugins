## LMS uninstallation script
echo "Uninstalling LMS and its dependencies..."
INSTALLING="/home/volumio/lms-plugin.uninstalling"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	# Uninstall PydPiper and docker
	apt-get remove --auto-remove docker
	rm -rf /var/lib/docker
	rm -rf /home/volumio/pydPiper

	rm $INSTALLING

	#required to end the plugin uninstall
	echo "pluginuninstallend"
else
	echo "Plugin is already uninstalling! Not continuing..."
fi
