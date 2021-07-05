cset shield -v > $1
sed -i '1,/"user"/d' $1
sed -i '/---/d' $1
sed -i "s/.*/\<tr\>\<td\>&\<\/td\>\<\/tr\>/" $1
sed -i -e 's/\s\+/\<\/td\>\<td\>/g' $1
sed -i '1s/^/\<table\>/' $1
sed -i -e '$a\<\/table\>' $1
cat $1


