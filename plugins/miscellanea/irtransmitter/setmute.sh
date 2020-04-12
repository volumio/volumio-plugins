#!/bin/sh
if [ -z "$1" ]; then 
    echo Send mute signal to IR transmitter and return current volume value.
    echo usage: $0 1  to mute / $0 0 to unmute
    exit
fi
FNMUTE="/data/plugins/miscellanea/irtransmitter/mute"
MUTE=$(cat "$FNMUTE")
if [ $1 -eq $MUTE ]; then
#  echo "No mute change"
else 
#  echo "Toggle mute"
  irsend SEND_ONCE CamAudioOne KEY_MUTE
  echo $1 > "$FNMUTE"
fi
if [ $1 -eq "1" ]; then
  echo 0
else
  echo `cat /data/plugins/miscellanea/irtransmitter/currentvolume`
fi
