# onoff-rotary

EventEmitter based micro-library using onoff to read output from rotary encoders on Raspberry PI and others.

This library might fail to install on other platforms!

**Please note: This is provided as is and probably not properly maintained, it should work fine if you have node >= 6.**



## Usage

```js
    const rotaryEncoder = require('onoff-rotary');
    const myEncoder = rotaryEncoder(5, 6); // Using BCM 5 & BCM 6 on the PI

    myEncoder.on('rotation', direction => {
        if (direction > 0) {
            console.log('Encoder rotated right');
        } else {
            console.log('Encoder rotated left');
        }
    });
```



## License

MIT. See LICENSE file.
