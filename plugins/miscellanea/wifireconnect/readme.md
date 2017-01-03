03 rd January 2017
first work
This plugin is supposed to reactivate wifi when a router has been reboot...
It uses a bash script and a cron job.
the principle : every X minutes a ping is sent to a server (8.8.8.8 google dns)
If no response, the wlan is restarted.
In a next version, I'll add some settings in the webUI to set the IP to be reached and the delay between two pings.