#!/bin/bash


SERVER=8.8.8.8
NINTERFACE=wlan0

ping -c2 ${SERVER} > /dev/null

if [ $? != 0 ]
then
    # Restart the wireless interface
    ip link set ${NINTERFACE} down
    ip link set ${NINTERFACE} up
fi

