# A bash script to reflect the plugin code change in the volumio application.
volumio plugin refresh
volumio vrestart
sudo journalctl -f
