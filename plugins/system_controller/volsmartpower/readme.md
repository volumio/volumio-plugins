19th April 2018


#	VOLUMIO SMART POWER
This plugin is designed to set the GPIO in order to use power supply such as : 
https://www.audiophonics.fr/fr/kits-modules-diy/audiophonics-pi-spc-module-de-controle-alimentation-type-atx-pre-assemble-p-11125.html

https://www.audiophonics.fr/fr/accessoires-pour-raspberry-pi-et-autres-sbc/audiophonics-pi-spc-ii-module-de-controle-alimentation-lineaire-pour-raspberry-pi-p-11504.html

It is inspirated from:
https://github.com/tomatpasser/gpio-buttons

and

https://github.com/audiophonics/Raspberry-pwr-management

It provides :
- GPIO setting for shutdown button
- GPIO setting for reboot button
- GPIO setting for boot ok signal led

![Alt text](volsmartpower.jpg?raw=true " Volumio Smart power")


## How to install

### 1. Enable SSH and connect to Volumio

For security reasons, SSH is disabled by default on all versions after 2.199 (except first boot). It can be however enabled very easily.

Navigate to the DEV ui by pointing your browser to http://VOLUMIOIP/DEV or http://volumio.local/DEV . Find the SSH section, and click enable. From now on your SSH will be permanently enabled.

Now you can connect to Volumio with username `volumio` and password `volumio`.

```
ssh volumio@volumio.local (if you changed the name of your device, replace the second volumio by it or use its IP address.
```

### 2. Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/system_controller/volsmartpower/volsmartpower.zip
mkdir ./volsmartpower
miniunzip volsmartpower.zip -d ./volsmartpower
cd ./volsmartpower
volumio plugin install
```


## Tested on :


## Last changes

19th April 18

- first commit
- second commit
