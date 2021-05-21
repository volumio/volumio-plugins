#!/bin/bash

ID=$(awk '/VERSION_ID=/' /etc/*-release | sed 's/VERSION_ID=//' | sed 's/\"//g')

if grep -q Raspberry /proc/cpuinfo; then # on Raspberry Pi hardware
  echo "Installing fake packages for kernel, bootloader and pi lib"
  wget https://repo.volumio.org/Volumio2/Binaries/arm/libraspberrypi0_0.0.1_all.deb
  wget https://repo.volumio.org/Volumio2/Binaries/arm/raspberrypi-bootloader_0.0.1_all.deb
  wget https://repo.volumio.org/Volumio2/Binaries/arm/raspberrypi-kernel_0.0.1_all.deb
  sudo dpkg -i libraspberrypi0_0.0.1_all.deb
  sudo dpkg -i raspberrypi-bootloader_0.0.1_all.deb
  sudo dpkg -i raspberrypi-kernel_0.0.1_all.deb
  rm libraspberrypi0_0.0.1_all.deb
  rm raspberrypi-bootloader_0.0.1_all.deb
  rm raspberrypi-kernel_0.0.1_all.deb

  echo "Putting on hold packages for kernel, bootloader and pi lib"
  sudo apt-mark hold libraspberrypi0 raspberrypi-bootloader raspberrypi-kernel

  echo "Installing Chromium dependencies"
  sudo apt-get update
  sudo apt-get -y install

  echo "Installing graphical environment"
  sudo DEBIAN_FRONTEND=noninteractive apt-get -y install xinit xorg openbox
  if [ "$ID" = "8" ]; then
    sudo apt-get -y install xserver-xorg-legacy
  fi

  echo "Installing Chromium"
  sudo apt-get -y install chromium-browser

  echo "Creating /etc/X11/xorg.conf.d dir"
  sudo mkdir /etc/X11/xorg.conf.d

  echo "Creating Xorg configuration file"
  sudo echo "# This file is managed by the Touch Display plugin: Do not alter!
# It will be deleted when the Touch Display plugin gets uninstalled.
Section \"InputClass\"
        Identifier \"Touch rotation\"
        MatchIsTouchscreen \"on\"
        MatchDevicePath \"/dev/input/event*\"
        MatchDriver \"libinput|evdev\"
EndSection" > /etc/X11/xorg.conf.d/95-touch_display-plugin.conf
else # on other hardware
  echo "Installing Chromium dependencies"
  sudo apt-get update
  sudo apt-get -y install

  echo "Installing graphical environment"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xinit xorg openbox

  echo "Installing Chromium"
  if [ "$ID" = "8" ]; then
    cd /home/volumio/
    wget https://launchpadlibrarian.net/234969703/chromium-browser_48.0.2564.82-0ubuntu0.15.04.1.1193_armhf.deb
    wget https://launchpadlibrarian.net/234969705/chromium-codecs-ffmpeg-extra_48.0.2564.82-0ubuntu0.15.04.1.1193_armhf.deb
    sudo dpkg -i /home/volumio/chromium-*.deb
    sudo apt-get install -y -f
    sudo dpkg -i /home/volumio/chromium-*.deb
    rm /home/volumio/chromium-*.deb
  else
    sudo apt-get -y install chromium
    sudo ln -s /usr/bin/chromium /usr/bin/chromium-browser
  fi
fi

echo "Installing japanese, korean, chinese and taiwanese fonts"
sudo apt-get -y install fonts-arphic-ukai fonts-arphic-gbsn00lp fonts-unfonts-core

echo "Creating Kiosk data dir"
mkdir /data/volumiokiosk
chown volumio:volumio /data/volumiokiosk

echo "Creating chromium kiosk start script"
sudo echo "#!/bin/bash
while true; do timeout 3 bash -c \"</dev/tcp/127.0.0.1/3000\" >/dev/null 2>&1 && break; done
sed -i 's/\"exited_cleanly\":false/\"exited_cleanly\":true/' /data/volumiokiosk/Default/Preferences
sed -i 's/\"exit_type\":\"Crashed\"/\"exit_type\":\"None\"/' /data/volumiokiosk/Default/Preferences
if [ -L /data/volumiokiosk/SingletonCookie ]; then
  rm -rf /data/volumiokiosk/Singleton*
fi
openbox-session &
while true; do
  /usr/bin/chromium-browser \\
    --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \\
    --force-device-scale-factor=1 \\
    --disable-pinch \\
    --kiosk \\
    --no-first-run \\
    --noerrdialogs \\
    --disable-3d-apis \\
    --disable-breakpad \\
    --disable-crash-reporter \\
    --disable-infobars \\
    --disable-session-crashed-bubble \\
    --disable-translate \\
    --user-data-dir='/data/volumiokiosk' \
    http://localhost:3000
done" > /opt/volumiokiosk.sh
sudo /bin/chmod +x /opt/volumiokiosk.sh

echo "Creating Systemd Unit for Kiosk"
sudo echo "[Unit]
Description=Volumio Kiosk
Wants=volumio.service
After=volumio.service
[Service]
Type=simple
User=volumio
Group=volumio
ExecStart=/usr/bin/startx /etc/X11/Xsession /opt/volumiokiosk.sh -- -nocursor
[Install]
WantedBy=multi-user.target
" > /lib/systemd/system/volumio-kiosk.service
sudo systemctl daemon-reload

echo "Allowing volumio to start an xsession"
sudo /bin/sed -i "s/allowed_users=console/allowed_users=anybody/" /etc/X11/Xwrapper.config

#required to end the plugin install
echo "plugininstallend"
