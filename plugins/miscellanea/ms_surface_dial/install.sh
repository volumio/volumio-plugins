#!/bin/bash

echo "Installing ms surface dial Dependencies"
sudo apt-get update
# Install the required packages via apt-get
echo "Installing usb-modeswitch"
sudo apt-get -y install usb-modeswitch --no-install-recommends

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

###############################
# udev for USB ModeSwitch 
#################################
# copy the Realtek 8821cu module
echo "Copying 8821cu kernel module"
# make no assumption about the location of current working directory
install_sh_path=$(readlink -f "$0")
this_package_dir=$(dirname "${install_sh_path}")
# destination path is related to the udev rule defined next.
echo "Source: ${this_package_dir}/8821cu/8821cu.ko"
cp -vaf ${this_package_dir}/8821cu/8821cu.ko /home/volumio/.

# update the usb-modeswitch file
echo "Modifying udev rules"
UDEV_USBMODESW_RULE=/lib/udev/rules.d/40-usb_modeswitch.rules
if [ -f "${UDEV_USBMODESW_RULE}" ]; then
    # Insert 2 lines before the 'modeswitch_rules_end' label
    echo "Modify ${UDEV_USBMODESW_RULE} ..."
    tmpfile=`basename ${UDEV_USBMODESW_RULE}`
    sed '/LABEL=\"modeswitch_rules_end\"/i\\# Realtek 8821CU WiFi-Bluetooth 4.0 Dongle\
ATTR{idVendor}==\"0bda\", ATTR{idProduct}==\"1a2b\", RUN+=\"/bin/sh -c '\''/sbin/insmod /home/volumio/8821cu.ko; /usr/sbin/usb_modeswitch -K -v 0bda -p 1a2b'\''\"\
' ${UDEV_USBMODESW_RULE} > /tmp/${tmpfile} && \
    sudo cp -af /tmp/${tmpfile} ${UDEV_USBMODESW_RULE}

    # reload the udev rules
    echo "Reloading udev rules"
    sudo udevadm control -R
else
    echo "Error: Cannot find ${UDEV_USBMODESW_RULE}"
    
fi


# add 'volumio' user to 'input' group
echo "Adding 'volumio' user to 'input' group..."
sudo usermod -aG input volumio

#requred to end the plugin install
echo "plugininstallend"
