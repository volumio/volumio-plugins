#!/bin/sh
#Define the output files for UI config
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
HERE="$(dirname "$FULL_PATH_TO_SCRIPT")"
CPUS="${HERE}/config/cpus.txt"
UICONFIGTEMPLATE="${HERE}/config/UIConfig.json"
UICONFIG="${HERE}/UIConfig.json"

#Discover the number of CPUs
lscpu -p=CPU > $CPUS
sed -i '/#/d'  $CPUS
MAXCPU=$(sed -n '$p' $CPUS)
unlink $CPUS

#Create the cpu spec config for each CPU
NEXT=2
COMMA=""
for i in $(seq 0 $MAXCPU)
do
  for j in $(seq $i $MAXCPU)
  do
    if [ $i -ne 0 ] || [ $j -ne $MAXCPU ] 
    then
      echo "$COMMA{\"value\":\"$i-$j\",\"label\":\"CPU $i to $j\"}" >> $CPUS
      COMMA=","
    fi
  done
done

#Write these into the UI config file
unlink $UICONFIG
cp $UICONFIGTEMPLATE $UICONFIG
sed -e "s/OPTIONS/$(<${CPUS} sed -e 's/[\&/]/\\&/g' -e 's/$/\\n/' | tr -d '\n')/g" -i  $UICONFIG 
unlink $CPUS

