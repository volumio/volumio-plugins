This plugin unmute iqaudio Pi-amp+ and digiamp when starting volumio2.
It use instructions given by Iqaudio : http://www.iqaudio.com/downloads/IQaudIO.pdf

By waiting next release, just copy this folder to your device in /volumio/app/plugins/miscellanea
You 'll have to add this in /volumio/app/plugind/plugins.json :

in the section "miscellanea"
"unmutedigiamp": {
      "enabled": {
        "type": "boolean",
        "value": true
      },
      "status": {
        "type": "string",
        "value": "STARTED"
      }
     }

And probably you have to delete /data/configuration/plugins.json
and restart volumio from /volumio
"killall volumio"

19 may 2016
New version using onoff lib
