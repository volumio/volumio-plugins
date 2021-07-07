#!/bin/sh
pids=$(pgrep -x $1)
for pid in $pids
do
  cset proc --move  --threads --toset=$2 --force --pid=$pid
done

