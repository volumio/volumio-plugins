#!/bin/bash

echo "Installing Roon Bridge Dependencies"
sudo apt-get update
# Install the required packages via apt-get
sudo apt-get -y install bzip2

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
MACHINE_ARCH=$(uname -m)
# Then use it to differentiate your install
PLUGIN_DIR="$( cd "$(dirname "$0")" ; pwd -P )"
PLUGIN_CATEGORY=$(cat "$PLUGIN_DIR"/package.json | jq -r ".volumio_info.plugin_type")
PACKAGE_NAME=$(cat "$PLUGIN_DIR"/package.json | jq -r ".name")
PACKAGE_NAME_LOWER=`echo "$PACKAGE_NAME" | tr "[A-Z]" "[a-z]"`
TMPDIR=`mktemp -d`
INSTALL_DIR="/data/plugins/$PLUGIN_CATEGORY/$PACKAGE_NAME"
echo $1



case "$MACHINE_ARCH" in
        armv7*)
            ARCH="armv7hf"
            ;;
        aarch64*)
            ARCH="armv8"
            ;;
        x86_64*)
            ARCH="x64" 
            ;;
        i686*)
            ARCH="x86" 
            ;;
esac

PACKAGE_FILE="${PACKAGE_NAME}_linux${ARCH}.tar.bz2"
PACKAGE_URL="http://download.roonlabs.com/builds/${PACKAGE_FILE}"

echo ""
echo "Downloading $PACKAGE_FILE to $TMPDIR/$PACKAGE_FILE"
echo ""
curl -# -o "$TMPDIR/$PACKAGE_FILE" "$PACKAGE_URL"

echo ""
echo -n "Unpacking ${PACKAGE_FILE}..."
cd $TMPDIR
tar xf "$PACKAGE_FILE"
echo "Done"

if [ ! -d "$TMPDIR/$PACKAGE_NAME" ]; then 
  echo "Missing directory: $TMPDIR/$PACKAGE_NAME. This indicates a broken package."
  exit 5
fi

 if [ ! -f "$TMPDIR/$PACKAGE_NAME/check.sh" ]; then 
  echo "Missing $TMPDIR/$PACKAGE_NAME/check.sh. This indicates a broken package."
  exit 5
fi


$TMPDIR/$PACKAGE_NAME/check.sh

echo ""
echo -n "Copying Files..."
mv "$TMPDIR/$PACKAGE_NAME" "$INSTALL_DIR"
rm -Rf "$TMPDIR"

SERVICE_FILE=/lib/systemd/system/${PACKAGE_NAME_LOWER}.service
cat > $SERVICE_FILE << END_SYSTEMD
[Unit]
Description=$PACKAGE_NAME
After=dynamicswap.service

[Service]
Type=simple
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$PACKAGE_NAME
User=root
Environment=ROON_DATAROOT=/data/configuration/$PLUGIN_CATEGORY/$PACKAGE_NAME
Environment=ROON_ID_DIR=/data/configuration/$PLUGIN_CATEGORY/PACKAGE_NAME
Environment=DAEMON_PIDFILE=/tmp/${PACKAGE_NAME_LOWER}.pid
Environment=DAEMON_LOGFILE=/tmp/${PACKAGE_NAME_LOWER}.log
ExecStart=/data/plugins/$PLUGIN_CATEGORY/$PACKAGE_NAME/$PACKAGE_NAME/start.sh
Restart=always

[Install]
WantedBy=multi-user.target
END_SYSTEMD

echo "Done"

#requred to end the plugin install
echo "plugininstallend"
