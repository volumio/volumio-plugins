# !/bin/bash
cachesize=120
cfolder=/tmp/volspotconnect2/cache
size=1000
#c2folder=/tmp/volspotconnect2/c2/files
cd $cfolder
checkedsize=$(du -sm $cfolder)
#echo $checkedsize
size=$(echo $checkedsize | cut -d' ' -f1)

while [ $size -gt $cachesize ]
        do
		checkedsize=$(du -sm $cfolder)
#		echo $checkedsize
		size=$(echo $checkedsize | cut -d' ' -f1)
		echo $size
		echo 'cache need to purged'
	        ls -tr1 | head -n 1 | xargs rm -Rf
	        echo purged
	done
echo cache not full, nothing to do

