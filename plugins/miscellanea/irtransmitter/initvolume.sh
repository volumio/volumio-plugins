#!/bin/sh
if [ -z "$1" ]; then 
    echo "usage: $0 volume (to init status file with volume value)"
    exit
fi
echo $1 > "/run/volumio/ir-tx/volume"
