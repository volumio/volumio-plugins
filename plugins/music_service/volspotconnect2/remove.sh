# !/bin/bash
# this script removes last file in volspotconnect2 cache when cachesize limit is reached
cachesize=120
ucachesize=$cachesize/2
c1folder=/tmp/volspotconnect2/cache/c1/files
c2folder=/tmp/volspotconnect2/cache/c2/files

cd $c1folder
checkedsize=$(du -sm $c1folder)
size=$(echo $checkedsize | cut -d' ' -f1)

while [ $size -gt $ucachesize ]
        do
		echo 'cache need to purged'
	        ls -tr1 | head -n 1 | xargs rm -Rf
	        echo purged
		checkedsize=$(du -sm $cfolder)
		size=$(echo $checkedsize | cut -d' ' -f1)
		echo 'cache c1' $size
	done
cd $c2folder
checkedsize=$(du -sm $c2folder)
size=$(echo $checkedsize | cut -d' ' -f1)

while [ $size -gt $ucachesize ]
        do
		echo 'cache need to purged'
	        ls -tr1 | head -n 1 | xargs rm -Rf
	        echo purged
		checkedsize=$(du -sm $cfolder)
		size=$(echo $checkedsize | cut -d' ' -f1)
		echo 'cache c2' $size
	done
echo cache not full, nothing to do

