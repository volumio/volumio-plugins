#!/bin/bash
cat /data/configuration/audio_interface/brutefir/sampleformat.txt | grep -Po 'formats  = \K.*' > /data/configuration/audio_interface/brutefir/sortsample.txt
