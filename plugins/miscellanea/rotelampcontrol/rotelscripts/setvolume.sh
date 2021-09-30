#!/usr/bin/env bash
#
# Force bash shell
if [ ! -n "$BASH" ] ;then
#  echo "Launching a bash shell"
#  echo "$0" "$1" "$2"
  exec bash "$0" "$1" "$2"
fi
set -eo pipefail

# Send vol_xx! command to the serial port
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
#sleep 0.2

# Send command
echo -e -n vol_$2!  > $1

# Wait for background read to complete
wait
