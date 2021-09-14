#!/usr/bin/env bash

# Force bash shell
if [ -z "$BASH" ]; then
  echo "Launching a bash shell"
  exec bash "$0"
fi
set -eo pipefail

name="volspotconnect2"
use_local_ver=no
libpath=/data/plugins/music_service/${name}
configpath=/data/configuration/music_service/${name}

exit_error() {
  echo "Plugin <${name}> installation script failed!!"
}
trap exit_error INT ERR

echo "Installing ${name} dependencies"

## Removing previous config
if [ -f "${configpath}/config.json" ]; then
  echo "Cleaning old config flile"
  sudo rm ${configpath}/config.json
fi

## Get the Daemon binary
declare -A VLS_BIN=(
  [armv6l]="vollibrespot-armv6l.tar.xz"
  [armv7l]="vollibrespot-armv7l.tar.xz"
  [aarch64]="vollibrespot-armv7l.tar.xz"
  [i686]="vollibrespot-i686.tar.xz"
  [x86_64]="vollibrespot-x86_64.tar.xz"
)

# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"

# Download and extract latest release
cd $libpath
if [ ${VLS_BIN[$cpu]+ok} ]; then
  # Check for the latest release first
  RELEASE_JSON=$(curl --silent "https://api.github.com/repos/ashthespy/vollibrespot/releases/latest")
  # Get a fixed version from the repo
  VLS_VER=v$(jq -r '.vollibrespot.version' package.json)
  LATEST_VER=$(jq -r '.tag_name' <<<"${RELEASE_JSON}")

  echo "Latest version: ${LATEST_VER} Requested version: ${VLS_VER}"
  echo "Supported device (arch = $cpu), downloading required packages for vollibrespot $VLS_VER"
  RELEASE_URL="https://api.github.com/repos/ashthespy/vollibrespot/releases/tags/${VLS_VER}"

  DOWNLOAD_URL=$(curl --silent "${RELEASE_URL}" |
    jq -r --arg VLS_BIN "${VLS_BIN[$cpu]}" '.assets[] | select(.name | contains($VLS_BIN)).browser_download_url')
  echo "Downloading file <${DOWNLOAD_URL}>"

  if [[ $use_local_ver == no ]]; then
    curl -L --output "${VLS_BIN[$cpu]}" "${DOWNLOAD_URL}"
  elif [[ -f ${VLS_BIN[$cpu]} ]]; then
    echo "Using local version"
  fi

  if [ $? -eq 0 ]; then
    echo "Extracting..."
    ls -l "${VLS_BIN[$cpu]}"
    tar -xf "${VLS_BIN[$cpu]}" &&
      ./vollibrespot -v &&
      rm "${VLS_BIN[$cpu]}"
  else
    echo -e "Failed to download vollibrespot daemon. Check for internet connectivity/DNS issues. \nTerminating installation!"
    exit 1
  fi
else
  echo -e "Sorry, current device (arch = $cpu) is not supported! \nTerminating installation!"
  exit 1
fi

## Install the service
sudo tar -xvf ${name}.service.tar -C /
sudo chmod +x /data/plugins/music_service/${name}/onstart1.sh
echo "${name} installed"
#required to end the plugin install
echo "plugininstallend"
