06 rd January 2017
first work
This plugin is supposed to reactivate wifi when a router has been reboot...
It uses a bash script to ping a server and a systemd timer to launch the script every 1 minute

the principle : every X minutes a ping is sent to a server (8.8.8.8 google dns)
If no response, the wlan is restarted.
In a next version, I'll add some settings in the webUI to set the IP to be reached and the delay between two pings.