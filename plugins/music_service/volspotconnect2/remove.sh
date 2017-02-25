# !/bin/bash
# this script removes last file in volspotconnect2 cache when cachesize limit is reached
ucachesize=120 #cache size Mo
#let ucachesize=$cachesize/2
cfolder=/tmp/files #folder where cache files are stored
#c2folder=/dev/shm/volspotconnect2/cache/c2/files

cd $cfolder
checkedsize=$(du -sm $cfolder)
size=$(echo $checkedsize | cut -d' ' -f1)

while [ $size -gt $ucachesize ]
        do
		echo 'cache need to purged'
	        ls -tr1 | head -n 1 | xargs rm -Rf
	        echo purged
		checkedsize=$(du -sm $cfolder)
		size=$(echo $checkedsize | cut -d' ' -f1)
		echo 'cache uses' $size 'Mo'
	done
echo 'cache not full, nothing do'
#cd $c2folder
#checkedsize=$(du -sm $c2folder)
#size=$(echo $checkedsize | cut -d' ' -f1)

#while [ $size -gt $ucachesize ]
#        do
#		echo 'cache need to purged'
#	        ls -tr1 | head -n 1 | xargs rm -Rf
#	        echo purged
#		checkedsize=$(du -sm $cfolder)
#		size=$(echo $checkedsize | cut -d' ' -f1)
#		echo 'cache c2 uses' $size 'Mo'
#	done
#echo 'cache C2 not full, nothing to do'

