#!/bin/bash

# Removing 8821CU driver
echo "Unloading 8821cu and Removing 8821cu.ko file"
sudo /sbin/rmmod 8821cu
rm -vf /home/volumio/8821cu.ko

# Removing udev rules
echo "Modifying udev rules"
UDEV_USBMODESW_RULE=/lib/udev/rules.d/40-usb_modeswitch.rules
if [ -f "${UDEV_USBMODESW_RULE}" ]; then
    tmpfile=`basename ${UDEV_USBMODESW_RULE}`
    sed '/Realtek 8821CU WiFi-Bluetooth 4.0 Dongle/d' ${UDEV_USBMODESW_RULE} | sed '/ATTR{idVendor}==\"0bda\", ATTR{idProduct}==\"1a2b\"/d' > /tmp/${tmpfile} && \
    sudo cp -af /tmp/${tmpfile} ${UDEV_USBMODESW_RULE}

    echo "Reloading udev rules"
    sudo udevadm control -R
else
    echo "Error: Cannot find ${UDEV_USBMODESW_RULE}"  
fi

# Uninstall dependendencies
echo "Warning: Do not uninstall usb-modeswitch, it could be used by other plugins or system in the future."
#sudo apt-get remove -y usb-modeswitch

echo "Done"
echo "pluginuninstallend"