#!/bin/sh
FULL_PATH_TO_SCRIPT="$(realpath "$0")"
HERE="$(dirname "$FULL_PATH_TO_SCRIPT")"
FILE="${HERE}/config/$1.config"

echo "$2" > $FILE
