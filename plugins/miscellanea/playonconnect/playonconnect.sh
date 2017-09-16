#!/bin/bash


SERVER=192.168.1.40
STREAMTOPLAY=conf
IPHERE=0

#ping -c2 ${SERVER} > /dev/null
#if IPHERE=0
	ping -c2 ${SERVER} > /dev/null
	if [ $? != 0 ]
	then
		IPHERE=1
		/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh play
	else
		echo "mais t'es ou?"		
		IPHERE=0
		#/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh stop
	fi

