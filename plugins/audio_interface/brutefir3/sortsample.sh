#!/bin/bash
cat /tmp/sampleformat.txt | grep -Po 'formats  = \K.*' > /tmp/sortsample.txt
