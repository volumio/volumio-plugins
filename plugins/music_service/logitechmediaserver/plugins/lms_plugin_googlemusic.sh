#!/bin/bash
# Installer Script for Plugin Googlemusic on Raspberry Pi
# base info can be found here: https://github.com/squeezebox-googlemusic/squeezebox-googlemusic

echo "Install Google Music as Plugin for Squeezebox Server"

# Setup Environment
apt-get update
apt-get install python-pip python-dev -y
pip install gmusicapi==10.0.1 

echo "yes\n" | sudo cpan App::cpanminus
cpanm --notest Inline
cpanm --notest Inline::Python


# Install Plugin

pushd /var/lib/squeezeboxserver/Plugins
mkdir GoogleMusic
pushd /var/lib/squeezeboxserver/Plugins/GoogleMusic
git clone https://github.com/squeezebox-googlemusic/squeezebox-googlemusic.git .
chown -R squeezeboxserver /var/lib/squeezeboxserver/Plugins/GoogleMusic
chmod -R g+wx /var/lib/squeezeboxserver/Plugins/GoogleMusic


/etc/init.d/logitechmediaserver restart

echo "<b>Finished installing Google Music Plugin</b>"