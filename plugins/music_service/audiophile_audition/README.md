# Audiophile_Audition Volumio2 plugin

A [AudiophileAudition](http://stream.psychomed.gr/index.html) plugin for Volumio2. It adds streams in different quality as a music service, including a lossless FLAC option.



## Manual installation
1. Enable SSH
- Navigate to the DEV ui by pointing your browser to VOLUMIOIP/DEV or volumio.local/DEV
- Find the SSH section, and click enable
- Connect to Volumio with ```ssh volumio@volumio.local``` (Password: volumio)

2. Download and Install Plugin
- ```wget https://tbd.zip```
- ```mkdir ./audiophile_audition```
- ```miniunzip audiophile_audition-volumio2-plugin-2019.zip -d ./audiophile_audition``
- ```cd ./audiophile_audition```
- ```volumio plugin install```
