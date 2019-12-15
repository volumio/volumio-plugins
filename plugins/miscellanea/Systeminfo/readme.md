December 15th

###  About the plugin

This plugin returns informations about your system such as cpu, mem, kernel...

It uses the very good [Systeminformation](https://systeminformation.io/) and some other custom tools ;-)

![Alt text](Systeminfo.png?raw=true "Systeminfos window")


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

Dec 15th 2019

- correction for cpu load

Nov 23th 2019

- reorganised information

Nov 22th 2019

- add audio hw info
- add volumio version

Nov 18th 2019

- add average cpu load
- add uptime

Nov 15th 2019

- first commit
