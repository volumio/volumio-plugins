# radio-paradise Volumio2 plugin

A [Radio Paradise](http://www.radioparadise.com) plugin for Volumio2. It adds streams in different quality as a music service, including a lossless FLAC option.

![alt text](https://i.imgur.com/Wsad3Gj.png "Screenshot Volumio2 GUI")

The FLAC version doesn't offer a static url for streaming. One has to query the RP API instead. The API returns the url of the first event containing 1-8 songs to play. Furthermore it contains the event id needed for querying the second event and so on.

## Manual installation
1. Enable SSH
- Navigate to the DEV ui by pointing your browser to VOLUMIOIP/DEV or volumio.local/DEV
- Find the SSH section, and click enable
- Connect to Volumio with ```ssh volumio@volumio.local``` (Password: volumio)

2. Download and Install Plugin
- ```wget https://raw.githubusercontent.com/marco79cgn/volumio-plugins/master/plugins/music_service/radio_paradise/radio-paradise-volumio2-plugin-2018-05-14.zip```
- ```mkdir ./radio_paradise```
- ```miniunzip radio-paradise-volumio2-plugin-2018-05-06.zip -d ./radio_paradise```
- ```cd ./radio_paradise```
- ```volumio plugin install```
