#!/bin/bash
raw_firmware=`/opt/vc/bin/vcgencmd version`
date_version=`echo $raw_firmware | awk '{print $1,$2,$3,$4}'`
git_version=`echo $raw_firmware | awk '{print $10}'`

echo "{"
echo "\"firmware\" : {\"type\":\"string\",\"value\":\"$date_version - $git_version\"}"
echo "}"
exit 0
