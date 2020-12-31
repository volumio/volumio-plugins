## Peppy alsa pipe + peppyMeter

December 31th 2020

installation for Volumio

to install

You need alsa_modular activated on volumio

You need touch_display plugin installed

From Volumio buster 3.014
```
sudo ln -s "$(which node)" /usr/local/bin/node
sudo ln -s "$(which npm)" /usr/local/bin/npm
sudo ln -s "$(which npm)" /bin/npm
```
and modular_alsa enabled
```
cd /volumio
volumio pull -b dev/buster/alsa-pipeline https://github.com/timothyjward/Volumio2
cd ..
cd /volumio
nano .env
```
and change lines
```
WRITE_MPD_CONFIGURATION_ON_STARTUP=true
MODULAR_ALSA_PIPELINE=true
```
and restart
```
volumio vrestart
```
and
You have to be root
```
su
echo ‘/opt/vc/lib’ >/etc/ld.so.conf.d/00-vmcs.conf
```
and
```
sudo /sbin/ldconfig
```

Now, install the plugin. It may takes several minutes. Wait for it in the UI!


```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/peppyalsapipe/pipe.zip
mkdir pipe
miniunzip pipe.zip -d ./pipe
cd pipe
volumio plugin install
cd..
rm -Rf pipe*
```
## Does not work (yet) with software volume
