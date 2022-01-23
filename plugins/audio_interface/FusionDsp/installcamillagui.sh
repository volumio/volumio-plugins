#!/bin/bash
LIB=/data/plugins/audio_interface/fusiondsp

		
echo "copying hw detection script"
#for future use.....
cd $LIB
#mv cgui.zip.ren cgui.zip
#miniunzip cgui.zip
#sudo chown -R volumio cgui
#sudo chgrp -R volumio cgui


echo "Installing/fusiondsp dependencies"
apt update
apt -y install python3-aiohttp python3-pip

cd $LIB
git clone https://github.com/HEnquist/pycamilladsp
 chown -R volumio pycamilladsp
chgrp -R volumio pycamilladsp

cd $LIB/pycamilladsp
pip3 install .
cd $LIB
git clone https://github.com/HEnquist/pycamilladsp-plot
 chown -R volumio pycamilladsp-plot
 chgrp -R volumio pycamilladsp-plot

cd $LIB/pycamilladsp-plot
pip3 install .
