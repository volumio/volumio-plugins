#!/usr/bin/env bash
#
# Force bash shell
if [ ! -n "$BASH" ] ;then
#  echo "Launching a bash shell"
#  echo "$0" "$1" "$2"
  exec bash "$0" "$1" "$2"
fi
set -eo pipefail

# Send mute! command to the serial port
# Wait for the response, format it and return it
#
# Start read command in the background to wait for the return from the amp
# -n max # of  characters
# -t timeout in seconds
#
(read -n 60 -t 1 -d \$ RESP < $1; RET=$(echo $RESP | sed 's/mute=//g' | sed 's/on/1/g' | sed 's/off/0/g');echo $RET)&

# Hack - use read to pause for 200ms to give previous
# command a chance to get started..
#read -p "" -t 0.2
#sleep 0.2

# Send command
if [[ $2 -eq  1 ]]
then
  echo -e -n mute_on!  > $1
elif [[ $2 -eq 0 ]]
then
  echo -e -n mute_off!  > $1
fi
# Wait for background read to complete
wait
