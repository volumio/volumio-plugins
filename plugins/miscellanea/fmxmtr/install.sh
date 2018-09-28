#!/bin/bash

echo "Installing fmxmtr Dependencies"
sudo apt-get update
# Install the required packages via apt-get

echo "Installing I2C-tools"
sudo apt-get -y install i2c-tools --no-install-recommends

echo "Installing base functionality for working with a Raspberry Pi from Node.js "
npm install kew v-conf fs-extra shelljs --no-install-recommends

echo "Creating default configuration file"
mkdir /data/configuration/miscellanea/fmxmtr
echo '{' > /data/configuration/miscellanea/fmxmtr/config.json
echo '    "I2C_BUS": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "1"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "I2C_ADDRESS": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "text",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "3e"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "Freq": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "94.5"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "BaseBoost": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "0"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "RFGain": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "15"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "MuteAudio": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "boolean",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": false' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json 
echo '    "MonoAudio": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "boolean",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": false' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "PGAMod": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "0"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "PGAmp": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "0"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "PltAdj": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "0"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "PhTCnst": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "number",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": "0"' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "PDPA": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "boolean",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": false' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  },' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "StartUp": {' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "type": "boolean",' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '    "value": false' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '  }' >> /data/configuration/miscellanea/fmxmtr/config.json
echo '}' >> /data/configuration/miscellanea/fmxmtr/config.json
chown -R volumio:volumio /data/configuration/miscellanea/fmxmtr


# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
