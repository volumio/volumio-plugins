#!/bin/sh

echo volumio | sudo -S /usr/bin/r_attenuc -c SET_MUTE=${1}
