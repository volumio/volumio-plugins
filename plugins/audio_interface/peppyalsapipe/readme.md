Peppy alsa pipe + peppyMeter 
installation for Volumio
to install
You need alsa_modular activated on volumio
```
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/peppyalsapipe/pipe.zip
mkdir pipe
miniunzip pipe.zip -d ./pipe
cd pipe
volumio plugin install
cd..
rm -Rf pipe*
```

