
2021 April 1st

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

April 1st 2021

- new node systeminformation
- correction for CPU freq
- storage display in several raws

October 21st 2020

- close modals on all screen

March 22th 2020

- code cleaning

January 17th 2020

- add internal storage info

Dec 27th 2019

- Cpu temperature

Dec 26th 2019

- add firmware version for RPI

Dec 15th 2019

- correction for cpu load
- warning with hw detection

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
