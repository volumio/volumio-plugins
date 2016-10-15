#!/bin/bash

echo "Installing Chromium Dependencies"
sudo apt-get update
sudo apt-get -y install

echo "Installing Graphical environment"
sudo apt-get install -y xinit xorg openbox

echo "Download Chromium"
cd /home/volumio/
wget http://launchpadlibrarian.net/234969703/chromium-browser_48.0.2564.82-0ubuntu0.15.04.1.1193_armhf.deb
wget http://launchpadlibrarian.net/234969705/chromium-codecs-ffmpeg-extra_48.0.2564.82-0ubuntu0.15.04.1.1193_armhf.deb

echo "Install  Chromium"
sudo dpkg -i /home/volumio/chromium-*.deb
sudo apt-get install -y -f
sudo dpkg -i /home/volumio/chromium-*.deb

rm /home/volumio/chromium-*.deb

echo "  Creating chromium kiosk start script"
echo "#!/bin/bash
xset -dpms
xset s off
openbox-session &
while true; do
  rm -rf ~/.{config,cache}/chromium/
  /usr/bin/chromium-browser --disable-session-crashed-bubble --disable-infobars --kiosk --no-first-run  'http://localhost:3000'
done" > /opt/volumiokiosk.sh
/bin/chmod +x /opt/volumiokiosk.sh

echo "Creating Systemd Unit for Kiosk"
echo "[Unit]
Description=Start Volumio Kiosk
Wants=volumio.service
After=volumio.service
[Service]
Type=simple
User=volumio
Group=audio
ExecStart=/usr/bin/startx /etc/X11/Xsession /opt/volumiokiosk.sh
# Give a reasonable amount of time for the server to start up/shut down
TimeoutSec=300
[Install]
WantedBy=multi-user.target
" > /lib/systemd/system/volumio-kiosk.service
/bin/ln -s /lib/systemd/system/volumio-kiosk.service /etc/systemd/system/multi-user.target.wants/volumio-kiosk.service


echo "  Allowing volumio to start an xsession"
/bin/sed -i "s/allowed_users=console/allowed_users=anybody/" /etc/X11/Xwrapper.config

echo "Disabling Kiosk Service"


#requred to end the plugin install
echo "plugininstallend"
