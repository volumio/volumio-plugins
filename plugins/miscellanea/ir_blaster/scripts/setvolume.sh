#!/bin/sh        
if [ -z "$1" -o -z "$2" ]; then 
    echo usage: $0 remotename volume
    exit
fi
# Name of the file storing current volume:
FNVOL="/data/plugins/miscellanea/ir_blaster/currentvolume"
# Read value:
PREV=$(cat "$FNVOL")
# echo $PREV, $1
CMDSTRING=""
if [ $2 -eq $PREV ]; then
  echo "No volume change"
  exit
elif [ $2 -gt $PREV ]; then
  CMDSTRING="KEY_VOLUMEUP"
  REP=$(($2 - $PREV))
  echo "Volume increased by $REP steps from $PREV to $2"
else
  CMDSTRING="KEY_VOLUMEDOWN"
  REP=$(($PREV - $2))
  echo "Volume decreased by $REP steps from $PREV to $2"
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
irsend SEND_ONCE $1$COMMAND
echo $2 > "$FNVOL"
