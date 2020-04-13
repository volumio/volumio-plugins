#!/bin/sh        
if [ -z "$1" ]; then 
    echo usage: $0 volume
    exit
fi
# Name of the file stroring current volume:
FNVOL="/data/plugins/miscellanea/irtransmitter/currentvolume"
# Read value:
PREV=$(cat "$FNVOL")
# echo $PREV, $1
CMDSTRING=""
if [ $1 -eq $PREV ]; then
  echo "No volume change"
  exit
elif [ $1 -gt $PREV ]; then
  CMDSTRING="KEY_VOLUMEUP"
  REP=$(($1 - $PREV))
  echo "Volume increased by $REP steps from $PREV to $1"
else
  CMDSTRING="KEY_VOLUMEDOWN"
  REP=$(($PREV - $1))
  echo "Volume decreased by $REP steps from $PREV to $1"
fi
#echo $REP
# Build command list for irsend
COUNT=1
COMMAND=""
while [ $COUNT -le $REP ]
do
  COUNT=$(($COUNT + 1))
  COMMAND="$COMMAND $CMDSTRING"
done

# Send actual command
irsend SEND_ONCE CamAudioOne$COMMAND
echo $1 > "$FNVOL"
