#!/bin/sh
#Define the path
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
HERE="$(dirname "$FULL_PATH_TO_SCRIPT")"
PARAMETERFILE="${HERE}/config/rtPriority.config"
CONFIG=$(cat $PARAMETERFILE)

pids=$(pgrep -x $1)
for pid in $pids
do
  chrt -r -p $CONFIG $pid
done

