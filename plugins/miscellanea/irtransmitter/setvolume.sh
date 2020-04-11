#!/bin/sh        
if [ -z "$1" ]; then 
    echo usage: $0 volume
    exit
fi
FNVOL="/data/plugins/miscellanea/irtransmitter/currentvolume"
PREV=$(cat "$FNVOL")
# echo $PREV, $1
if [ $1 -eq $PREV ]; then
  echo "No volume change"
  exit
elif [ $1 -gt $PREV ]; then
  echo "Volume increased"
  irsend SEND_ONCE CamAudioOne KEY_VOLUMEUP
  PREV=$(($PREV+1))
else
  echo "Volume decreased"
  irsend SEND_ONCE CamAudioOne KEY_VOLUMEDOWN
  PREV=$(($PREV-1))
fi
# Currently the volume is not set to the number passed to the routine but just de-/increased
# by one. Should really loop ir commands...
echo $PREV
echo $PREV > "$FNVOL"
