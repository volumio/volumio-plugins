#!/bin/bash
FNVOL="/data/plugins/miscellanea/irtransmitter/currentvolume"
VOL=$(<"$FNVOL")
echo $VOL
