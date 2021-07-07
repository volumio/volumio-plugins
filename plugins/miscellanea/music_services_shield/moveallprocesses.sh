#!/bin/sh
#Define the path
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
HERE="$(dirname "$FULL_PATH_TO_SCRIPT")"
CPUSPARAMETERFILE="${HERE}/config/userCpuSpec.config"
CPUCONFIG=$(cat $CPUSPARAMETERFILE)

cset shield -c $CPUCONFIG > /dev/null

/data/plugins/miscellanea/music_services_shield/moveprocess.sh mpd > /dev/null
/data/plugins/miscellanea/music_services_shield/moveprocess.sh vollibrespot  > /dev/null
cset shield

/data/plugins/miscellanea/music_services_shield/setrtpriority.sh mpd
/data/plugins/miscellanea/music_services_shield/setrtpriority.sh vollibrespot


