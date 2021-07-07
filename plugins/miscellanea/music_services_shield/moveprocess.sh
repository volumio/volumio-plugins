pids=$(pgrep -x $1)
for pid in $pids
do
  cset proc --move  --threads --toset=user --force --pid=$pid
done

