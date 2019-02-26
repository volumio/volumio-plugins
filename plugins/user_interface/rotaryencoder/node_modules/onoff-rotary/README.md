# onoff-rotary

EventEmitter based micro-library using onoff to read output from rotary encoders on Raspberry PI and others.

This library might fail to install on other platforms!

**Please note: This is provided as is and probably not properly maintained, it should work fine if you have node >= 6.**

### Extension
I've added two parameters to the class:

1. An additional GPIO pin for a push button
2. A parameter to define the type of encoding you want to use (default = gray coding, or a modified KY040 kind)

The following parameters (in order) exist:
1. CLK pin
2. DT pin
3. SW pin
4. Encoding type (0 = default, 1 = KY-040; I'm not sure whether solving the misfiring of the KY-040 should solve my problems with the KY-040)

## Usage

```js
    const rotaryEncoder = require('onoff-rotary');
    const myEncoder = rotaryEncoder(5, 6, 7, 0); // Using BCM 5, BCM 6 & BCM 7 on the PI; two for the rotation and one for the push button

	myEncoder.on('rotation', direction => {
		if (direction > 0) {
			console.log('Encoder rotated right; clockwise');
		} else {
			console.log('Encoder rotated left; counter clockwise');
		}
	});
	
	myEncoder.on('click', pressState => {
		switch(pressState)
		{
			case 0:
				console.log('Encoder button pressed');
				break;
			case 1:
				console.log('Encoder button released');
				break;
		}
	});
```



## License

MIT. See LICENSE file.
