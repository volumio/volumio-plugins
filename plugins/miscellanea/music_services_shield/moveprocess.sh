pids=$(pgrep -x $1)
for pid in $pids
do
chrt -r -p 99 $pid
cset proc --move  --threads --toset=user --force --pid=$pid
done

