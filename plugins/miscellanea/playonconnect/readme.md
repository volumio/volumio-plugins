17th Sepetember 2017

This plugin is supposed to play something when a specific IP is detected on the network

A bigger work than previously imagined need to be done...something like :

set a variable IPHERE to 0
first we ping a IP
	if IP not reply then re-ping 1 min later
else
	if IP ok
		then set IPHERE=1
		play something
ping ip
	if IP ok
	if IPHERE=1
		then do nothing
	if IP no ok
		set IPHERE=0

WARNING : need to solve the play when the device has already been detected...

17 th september
- working version

16 th september
- correct  service

11 th september
- second commit....


10 th september

- first commit