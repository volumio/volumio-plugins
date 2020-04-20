#!/bin/sh
if [ -z "$1" -o -z "$2" ]; then 
    echo Send mute signal to IR transmitter and return current volume value.
    echo "usage: $0 par_remotename par_mute  (1 to mute / 0 to unmute)"
    exit
fi
FNMUTE="/data/plugins/miscellanea/irtransmitter/mute"
MUTE=$(cat "$FNMUTE")
if [ $2 -ne $MUTE ]; then
#  echo "Toggle mute"
  irsend SEND_ONCE $1 KEY_MUTE
  echo $2 > "$FNMUTE"
fi
if [ $2 -eq "1" ]; then
  echo 0
else
  echo `cat /data/plugins/miscellanea/irtransmitter/currentvolume`
fi
