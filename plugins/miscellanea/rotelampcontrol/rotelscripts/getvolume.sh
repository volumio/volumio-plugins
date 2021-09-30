#!/usr/bin/env bash
#
# Force bash shell
if [ ! -n "$BASH" ] ;then
#  echo "Launching a bash shell"
#  echo "$0" "$1" 
  exec bash "$0" "$1" 
fi
set -eo pipefail

# Send volume? command to the serial port
# Wait for the response, format it and return it
#
# Start read command in the background to wait for the return from the amp
# -n max # of  characters
# -t timeout in seconds
#
(read -n 60 -t 1 -d \$ RESP < $1; RET=$(echo $RESP | sed 's/volume=//g');echo $RET)&

# Hack - use read to pause for 200ms to give previous
# command a chance to get started..
#read -p "" -t 0.2

#sleep 0.01

# Send command
echo -e -n volume?  > $1

# Wait for background read to complete
wait
