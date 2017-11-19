19th november 2017

This plugin is supposed to reactivate wifi when a router has been reboot...
It uses a bash script to reach a server and a systemd timer to launch the script every minute (it could be changed but a short delay is convenient to test).

the principle : every X minutes ping send a request to a server (8.8.8.8 google dns by default - could be changed in settings))
If no response, the interface is restarted.

The plugin UI  allows to set the IP and the interface to check.

19 th november

- change to use the interface set in webUI...
- reverse to ping...

09 th november

- use of wget

08 th september

- remove previous wifirecoonect service and innstall the new one

06 th september
- correct command in timer service
- change command to restart network interface

25th january

plugin appears active now

12th january : plugin now add default-lease-time 600 and max-lease-time 3600 in /etc/dhcp/dhcpd.conf

11th january : reverse to use link to use the chosen interface

09th december : new way to restart wlan using systemd wireless.service

How to install ?
- Just download wifireconnect.zip
- From Volumio webUI go in setting / plugin / updload plugin and select the previous file.
- Refresh page
- go in plugin settings and set the value you need and save.
