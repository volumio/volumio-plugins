## Peppy alsa pipe + peppyMeter

December 31th 2020

installation for Volumio

to install

You need alsa_modular activated on volumio

You need touch_display plugin installed

```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/peppyalsapipe/pipe.zip
mkdir pipe
miniunzip pipe.zip -d ./pipe
cd pipe
volumio plugin install
cd..
rm -Rf pipe*
```

