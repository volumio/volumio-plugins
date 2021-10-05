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

SHIELDEMPTY="true"

if [ $USERMPDCONFIG = "true" ] 
then
MPDGROUP="user"
SHIELDEMPTY="false"
else
MPDGROUP="system"
fi

if [ $USERSPOTIFYCONFIG = "true" ]
then
SPOTIFYGROUP="user"
SHIELDEMPTY="false"
else
SPOTIFYGROUP="system"
fi

# Assign the CPUs to the shield, creating the shield if it does not already exist
cset shield -c $CPUCONFIG > /dev/null

# Move the processes to the user or system group
/data/plugins/miscellanea/music_services_shield/moveprocess.sh mpd $MPDGROUP > /dev/null
/data/plugins/miscellanea/music_services_shield/moveprocess.sh vollibrespot $SPOTIFYGROUP > /dev/null

# Destroy the shield if no processes are assigned to it
if [ $SHIELDEMPTY = "true" ]
then
sudo cset shield -r > /dev/null
fi

# Report the shield status
cset shield

#Set the process priorities
if [ $RTMPDCONFIG = "true" ]
then
/data/plugins/miscellanea/music_services_shield/setrtpriority.sh mpd
fi

if [ $RTSPOTIFYCONFIG = "true" ]
then
/data/plugins/miscellanea/music_services_shield/setrtpriority.sh vollibrespot
fi


