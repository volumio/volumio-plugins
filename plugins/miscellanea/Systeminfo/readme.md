November 18th

This plugin returns informations about your system such as cpu, mem, kernel...



![Alt text](Systeminfos.png?raw=true "Systeminfos window")


###  Download and install the plugin

Type the following commands to download and install plugin:

```
wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/miscellanea/Systeminfo/Systeminfo.zip
mkdir ./Systeminfo
miniunzip Systeminfo.zip -d ./Systeminfo
cd ./Systeminfo
volumio plugin install
cd ..
rm -Rf Systeminfo*
```
Nov 18th 2019

- add average cpu load

Nov 15th 2019

- first commit
