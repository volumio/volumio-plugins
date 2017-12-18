#!/bin/bash
#Installer Script for Plugin Shairtunes
apt-get update
apt-get install libcrypt-openssl-rsa-perl libio-socket-inet6-perl libwww-perl avahi-utils libio-socket-ssl-perl --yes --force-yes
wget -O /opt/max2play/cache/libnet-sdp-perl.deb http://www.inf.udec.cl/~diegocaro/rpi/libnet-sdp-perl_0.07-1_all.deb
dpkg -i /opt/max2play/cache/libnet-sdp-perl.deb

if [ "$1" = "ShairTunes2" ]; then
	# Shairtunes2  http://raw.github.com/disaster123/shairport2_plugin/master/public.xml
	wget -O /opt/max2play/cache/ShairTunes2.zip https://raw.github.com/disaster123/shairport2_plugin/master/ShairTunes2.zip
	cp /opt/max2play/cache/ShairTunes2.zip /var/lib/squeezeboxserver/cache/DownloadedPlugins/
	echo "ShairTunes2: needs-install" >> /var/lib/squeezeboxserver/prefs/plugin/state.prefs
	
	foundShairtunes=$(grep -i "ShairTunes2" /var/lib/squeezeboxserver/prefs/plugin/extensions.prefs | wc -l)
	if [ "$foundShairtunes" -lt "1" ]; then
		sed -i 's/plugin:$/plugin:\n  ShairTunes2: 1/' /var/lib/squeezeboxserver/prefs/plugin/extensions.prefs
		sed -i 's/plugin: {}/plugin:\n  ShairTunes2: 1/' /var/lib/squeezeboxserver/prefs/plugin/extensions.prefs
	fi
	echo "Shairtunes2 installed"
else
	# Shairtunes
	wget -O /opt/max2play/cache/ShairTunes.zip https://raw.github.com/StuartUSA/shairport_plugin/master/ShairTunes.zip
	mkdir /opt/max2play/cache/ShairTunes
	unzip /opt/max2play/cache/ShairTunes.zip  shairport_helper/pre-compiled/shairport_helper-armhf -d /opt/max2play/cache/ShairTunes
	cp /opt/max2play/cache/ShairTunes/shairport_helper/pre-compiled/shairport_helper-armhf /usr/local/bin/shairport_helper
	
	#Path /var/lib/squeezeboxserver/cache/InstalledPlugins/Plugins/
	cp /opt/max2play/cache/ShairTunes.zip /var/lib/squeezeboxserver/cache/DownloadedPlugins/
	echo "ShairTunes: needs-install" >> /var/lib/squeezeboxserver/prefs/plugin/state.prefs
	
	foundShairtunes=$(grep -i "ShairTunes" /var/lib/squeezeboxserver/prefs/plugin/extensions.prefs | wc -l)
	if [ "$foundShairtunes" -lt "1" ]; then
		sed -i 's/plugin:$/plugin:\n  ShairTunes: 1/' /var/lib/squeezeboxserver/prefs/plugin/extensions.prefs
		sed -i 's/plugin: {}/plugin:\n  ShairTunes: 1/' /var/lib/squeezeboxserver/prefs/plugin/extensions.prefs
	fi
	echo "Shairtunes installed"
fi

/etc/init.d/logitechmediaserver restart

echo "Finished"