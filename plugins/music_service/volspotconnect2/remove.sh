# !/bin/bash
# this script removes last file in volspotconnect2 cache when cachesize limit is reached
ucachesize=64 #cache size Mo
cfolder=/tmp/files #folder where cache files are stored


cd $cfolder
checkedsize=$(du -sm $cfolder)
size=$(echo $checkedsize | cut -d' ' -f1)

while [ $size -gt $ucachesize ] # condition to execute the cache purge
        do
		echo 'cache needs to be purged'
	        ls -tr1 | head -n 1 | xargs rm -Rf
	        echo purged
		checkedsize=$(du -sm $cfolder)
		size=$(echo $checkedsize | cut -d' ' -f1)
		echo 'cache uses' $size 'Mo'
	done
echo 'cache not full, nothing do'
