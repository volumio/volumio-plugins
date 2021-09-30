#!/usr/bin/env bash
#
# Force bash shell
if [ ! -n "$BASH" ] ;then
#  echo "Launching a bash shell"
#  echo "$0" "$1" 
  exec bash "$0" "$1" 
fi
set -eo pipefail

# Send 'mute?' command to the serial port
# Wait for the response, format it and return it
#
# Start read command in the background to wait for the return from the amp
# -n max # of  characters
# -t timeout in seconds
#
(read -n 60 -t 1 -d \$ RESP < $1; RET=$(echo $RESP | sed 's/mute=//g' | sed 's/on/1/g' | sed 's/off/0/g');echo $RET)&
#(read RESP 50 < $1; echo $RESP)&

#sleep 0.1

# Send command
echo -e -n mute?  > $1

# Wait for background read to complete
wait
