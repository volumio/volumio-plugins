const EventEmitter = require('events').EventEmitter;
const Gpio = require('onoff').Gpio;

/**
 * Creates a new Rotary Encoder using two GPIO pins
 * Expects the pins to be configured as pull-up
 *
 * @param pinA GPIO # of the first pin
 * @param pinB GPIO # of the second pin
 *
 * @returns EventEmitter
 */
function RotaryEncoder(pinA, pinB) {
	this.gpioA = new Gpio(pinA, 'in', 'both');
	this.gpioB = new Gpio(pinB, 'in', 'both');

	this.a = 2;
	this.b = 2;

	this.gpioA.watch((err, value) => {
		if (err) {
			this.emit('error', err);

			return;
		}

		this.a = value;
	});

	this.gpioB.watch((err, value) => {
		if (err) {
			this.emit('error', err);

			return;
		}

		this.b = value;

		this.tick();
	});
}

RotaryEncoder.prototype = EventEmitter.prototype;

RotaryEncoder.prototype.tick = function tick() {
	const { a, b } = this;

	if (a === 0 && b === 0 || a === 1 && b === 1) {
		this.emit('rotation', 1);
	} else if (a === 1 && b === 0 || a === 0 && b === 1 || a === 2 && b === 0) {
		this.emit('rotation', -1);
	}

	return this;
};

module.exports = function rotaryEncoder(pinA, pinB) {
	return new RotaryEncoder(pinA, pinB);
};
