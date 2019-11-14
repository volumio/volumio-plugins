#!/bin/bash
# Force bash shell
if [ ! -n "$BASH" ] ;then
 echo "Launching a bash shell"
 exec bash "$0"
fi

echo "Installing Volspotconnect2 dependencies"
libpath=/data/plugins/music_service/volspotconnect2
configpath=/data/configuration/music_service/volspotconnect2

## Removing previous config
if [ ! -f "${configpath}/config.json" ];
then
  echo "Configuration file doesn't exist, nothing to do"
else
  echo "Configuration File exists removing it"
  sudo rm ${configpath}/config.json
fi

## Get the Daemon binary
declare -A VLS_BIN=(
  [armv6l]="vollibrespot-armv6l.tar.xz"  \
    [armv7l]="vollibrespot-armv7l.tar.xz" \
    [aarch64]="vollibrespot-armv7l.tar.xz" \
    [i686]="vollibrespot-i686.tar.xz" \
  )

ERR_DOWNLOAD="Failed to download vollibrespot daemon. Stopping installation now. \
  Check your internet connection, and check DNS settings in Volumio for  possible cause\
  Exitting now"

ERR_UNSUPPROTED="Sorry, your device is not yet supported! \n\
  Exitting Now!"

# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"

# Get a fixed version from the repo
# TODO We should allocate a field in `package.json` for this?
# VLS_VER=v0.1.0
# VLS_REPO=ashthespy/vollibrespot


# Download and extract latest release
cd $libpath
if [ ${VLS_BIN[$cpu]+ok} ]; then
  echo "Supported device (arch = $cpu), downloading required packages"
  DOWNLOAD_URL=$(curl --silent "https://api.github.com/repos/ashthespy/vollibrespot/releases/latest" | \
    jq -r --arg VLS_BIN "${VLS_BIN[$cpu]}" '.assets[] | select(.name | contains($VLS_BIN)).browser_download_url')
  echo $DOWNLOAD_URL
  curl -L --output ${VLS_BIN[$cpu]} $DOWNLOAD_URL
  if [ $? -eq 0 ]; then
    echo "Extracting..."
    ls -l ${VLS_BIN[$cpu]}
    tar -xf ${VLS_BIN[$cpu]} && \
      ./vollibrespot -v &&
      rm ${VLS_BIN[$cpu]}
  else
    echo -e ${ERR_DOWNLOAD}
    exit -1
  fi
else
  echo -e ${ERR_UNSUPPROTED}
  exit -1
fi

## Install the service
sudo tar -xvf volspotconnect2.service.tar -C /
sudo chmod +x /data/plugins/music_service/volspotconnect2/onstart1.sh

#required to end the plugin install
echo "plugininstallend"
