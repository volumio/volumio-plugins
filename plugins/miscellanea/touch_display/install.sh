#!/bin/bash

HW=$(awk '/VOLUMIO_HARDWARE=/' /etc/*-release | sed 's/VOLUMIO_HARDWARE=//' | sed 's/\"//g')

if [ "$HW" = "pi" ];
then
  echo "Raspberry Pi install script"

  echo "Installing fake packages for kernel, bootloader and pi lib"
  wget http://repo.volumio.org/Volumio2/Binaries/arm/libraspberrypi0_0.0.1_all.deb
  wget http://repo.volumio.org/Volumio2/Binaries/arm/raspberrypi-bootloader_0.0.1_all.deb
  wget http://repo.volumio.org/Volumio2/Binaries/arm/raspberrypi-kernel_0.0.1_all.deb
  dpkg -i libraspberrypi0_0.0.1_all.deb
  dpkg -i raspberrypi-bootloader_0.0.1_all.deb
  dpkg -i raspberrypi-kernel_0.0.1_all.deb
  rm libraspberrypi0_0.0.1_all.deb
  rm raspberrypi-bootloader_0.0.1_all.deb
  rm raspberrypi-kernel_0.0.1_all.deb

  echo "Putting on hold packages for kernel, bootloader and pi lib"
  echo "libraspberrypi0 hold" | dpkg --set-selections
  echo "raspberrypi-bootloader hold" | dpkg --set-selections
  echo "raspberrypi-kernel hold" | dpkg --set-selections


  echo "Installing Chromium Dependencies"
  sudo apt-get update
  sudo apt-get -y install

  echo "Installing Graphical environment"
  sudo apt-get install -y xinit xorg openbox libexif12

  echo "Installing Chromium"
  sudo apt-get install -y chromium-browser
else

  echo "Installing Chromium Dependencies"
  sudo apt-get update
  sudo apt-get -y install

  echo "Installing Graphical environment"
  sudo apt-get install -y xinit xorg openbox libexif12

  echo "Download Chromium"
  cd /home/volumio/
  wget http://launchpadlibrarian.net/234969703/chromium-browser_48.0.2564.82-0ubuntu0.15.04.1.1193_armhf.deb
  wget http://launchpadlibrarian.net/234969705/chromium-codecs-ffmpeg-extra_48.0.2564.82-0ubuntu0.15.04.1.1193_armhf.deb

  echo "Install  Chromium"
  sudo dpkg -i /home/volumio/chromium-*.deb
  sudo apt-get install -y -f
  sudo dpkg -i /home/volumio/chromium-*.deb

  rm /home/volumio/chromium-*.deb

fi

echo "Installing Japanese, Korean, Chinese and Taiwanese fonts"
apt-get -y install fonts-arphic-ukai fonts-arphic-gbsn00lp fonts-unfonts-core

echo "Dependencies installed"

echo "Creating Kiosk Data dir"
mkdir /data/volumiokiosk

echo "  Creating chromium kiosk start script"
echo "#!/bin/bash
xset +dpms
xset s blank
xset dpms 0 0 120
openbox-session &
while true; do
  /usr/bin/chromium-browser \\
    --disable-pinch \\
    --kiosk \\
    --no-first-run \\
    --disable-3d-apis \\
    --disable-breakpad \\
    --disable-crash-reporter \\
    --disable-infobars \\
    --disable-session-crashed-bubble \\
    --disable-translate \\
    --user-data-dir='/data/volumiokiosk' \
	--no-sandbox \
    http://localhost:3000
done" > /opt/volumiokiosk.sh
/bin/chmod +x /opt/volumiokiosk.sh

echo "Creating Systemd Unit for Kiosk"
echo "[Unit]
Description=Start Volumio Kiosk
Wants=volumio.service
After=volumio.service
[Service]
Type=simple
User=root
Group=root
ExecStart=/usr/bin/startx /etc/X11/Xsession /opt/volumiokiosk.sh -- -nocursor
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
