#!/bin/bash
baseresult=`/opt/vc/bin/vcgencmd version`
date_v=`echo $baseresult | awk '{print $1,$2,$3,$4}'`
git_v=`echo $baseresult | awk '{print $10}'`

echo "{"
echo "\"firmware\" : {\"type\":\"string\",\"value\":\"$date_v - $git_v\"}"
echo "}"
exit 0
