#!/bin/bash

# The IP for the server you wish to ping (8.8.8.8 is a public Google DNS serv$
SERVER=8.8.8.8

# Only send two pings, sending output to /dev/null
ping -c2 ${SERVER} > /dev/null

# If the return code from ping ($?) is not 0 (meaning there was an error)
if [ $? != 0 ]
then
    # Restart the wireless interface
    ip link set wlan0 down
    ip link set wlan0 up
fi

