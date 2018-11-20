## Squeezelite installation script
echo "Installing Squeezelite and its dependencies..."
INSTALLING="/home/volumio/squeezelite-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	if [ ! -d /opt/squeezelite ];
	then 
		# Download latest squeezelite executable
		echo "Downloading squeezelite..."
		wget -O /opt/squeezelite https://github.com/Saiyato/volumio-squeezelite-plugin/raw/master/known_working_versions/squeezelite-armv6hf-volumio
				
		# Fix executable rights
		chown volumio:volumio /opt/squeezelite
		chmod 755 /opt/squeezelite
		
		# Download and activate default unit
		TMPUNIT="/data/plugins/music_service/squeezelite/squeezelite.service"
		wget -O $TMPUNIT https://raw.githubusercontent.com/Saiyato/volumio-squeezelite-plugin/master/unit/squeezelite.unit-template
		chown volumio $TMPUNIT
		
		sed 's|${NAME}|-n Volumio|g' -i $TMPUNIT
		sed 's|${OUTPUT_DEVICE}|-o default|g' -i $TMPUNIT
		sed 's|${SOUNDCARD_TIMEOUT}|2|g' -i $TMPUNIT
		sed 's|${ALSA_PARAMS}|-a 80:4::|g' -i $TMPUNIT
		sed 's|${EXTRA_PARAMS}||g' -i $TMPUNIT
		
		#mv $TMPUNIT /etc/systemd/system/squeezelite.service
		ln -fs /data/plugins/music_service/squeezelite/squeezelite.service /etc/systemd/system/squeezelite.service		
		systemctl daemon-reload
		
	else
		echo "Plugin already exists, not continuing."
	fi
	
	rm $INSTALLING

	# Required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi
