#!/bin/sh
#Define the path
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
HERE="$(dirname "$FULL_PATH_TO_SCRIPT")"
CPUSPARAMETERFILE="${HERE}/config/userCpuSpec.config"
USERMPDCONFIGFILE="${HERE}/config/userMpd.config"
USERSPOTIFYCONFIGFILE="${HERE}/config/userSpotify.config"
RTMPDCONFIGFILE="${HERE}/config/rtMpd.config"
RTSPOTIFYCONFIGFILE="${HERE}/config/rtSpotify.config"

CPUCONFIG=$(cat $CPUSPARAMETERFILE)
USERMPDCONFIG=$(cat $USERMPDCONFIGFILE)
USERSPOTIFYCONFIG=$(cat $USERSPOTIFYCONFIGFILE)
RTMPDCONFIG=$(cat $RTMPDCONFIGFILE)
RTSPOTIFYCONFIG=$(cat $RTSPOTIFYCONFIGFILE)

if [ $USERMPDCONFIG = "true" ] 
then
MPDGROUP="user"
else
MPDGROUP="system"
fi

if [ $USERSPOTIFYCONFIG = "true" ]
then
SPOTIFYGROUP="user"
else
SPOTIFYGROUP="system"
fi

cset shield -c $CPUCONFIG > /dev/null

/data/plugins/miscellanea/music_services_shield/moveprocess.sh mpd $MPDGROUP > /dev/null
/data/plugins/miscellanea/music_services_shield/moveprocess.sh vollibrespot $SPOTIFYGROUP > /dev/null
cset shield

if [ $RTMPDCONFIG = "true" ]
then
/data/plugins/miscellanea/music_services_shield/setrtpriority.sh mpd
fi

if [ $RTSPOTIFYCONFIG = "true" ]
then
/data/plugins/miscellanea/music_services_shield/setrtpriority.sh vollibrespot
fi


