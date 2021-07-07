#!/bin/sh
#Define the path
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
HERE="$(dirname "$FULL_PATH_TO_SCRIPT")"
CPUSPARAMETERFILE="${HERE}/config/userCpuSpec.config"
CPUCONFIG=$(cat $CPUSPARAMETERFILE)

cset shield -c $CPUCONFIG
/data/plugins/miscellanea/music_services_shield/moveprocess.sh mpd
/data/plugins/miscellanea/music_services_shield/moveprocess.sh vollibrespot

