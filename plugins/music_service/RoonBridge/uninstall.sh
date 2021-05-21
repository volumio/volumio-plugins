#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y
PLUGIN_DIR="$( cd "$(dirname "$0")" ; pwd -P )"
PLUGIN_CATEGORY=$(cat "$PLUGIN_DIR"/package.json | jq -r ".volumio_info.plugin_type")
PACKAGE_NAME=$(cat "$PLUGIN_DIR"/package.json | jq -r ".name")
PACKAGE_NAME_LOWER=`echo "$PACKAGE_NAME" | tr "[A-Z]" "[a-z]"`

rm -Rf "/data/configuration/$PLUGIN_CATEGORY/$PACKAGE_NAME"
rm "/lib/systemd/system/$PACKAGE_NAME_LOWER.service"

systemctl daemon-reload

echo "Done"
echo "pluginuninstallend"
