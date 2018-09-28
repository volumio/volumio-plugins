const EventEmitter = require('events').EventEmitter;
const Gpio = require('onoff').Gpio;
const rotaryLogic = Object.freeze({"DEFAULT":0, "KY040":1 });

LAST_CLK = 0;
LAST_DT = 0;
LAST_ENCODED = 00;

/**
 * Creates a new Rotary Encoder using two GPIO pins
 * Expects the pins to be configured as pull-up
 *
 * @param pinA GPIO # of the first pin
 * @param pinB GPIO # of the second pin
 *
 * @returns EventEmitter
 */
function RotaryEncoder(pin_CLK, pin_DT, pin_SW, encoderType) {
	this.CLK = new Gpio(pin_CLK, 'in', 'both');
	this.DT = new Gpio(pin_DT, 'in', 'both');
	this.SW = new Gpio(pin_SW, 'in', 'both');

	this.clk_value = 2;
	this.dt_value = 2;
	this.sw_value = 0;
	this.encType = encoderType;

	this.CLK.watch((err, value) => {
		if (err) {
			this.emit('error', err);
			return;
		}
		this.clk_value = value;
	});

	this.DT.watch((err, value) => {
		if (err) {
			this.emit('error', err);
			return;
		}
		this.dt_value = value;
		
		//console.log('Encoding type: ' + encoderType);		
		switch(encoderType)
		{
			case rotaryLogic.DEFAULT:
				this.defaultTick();
				break;
			case rotaryLogic.KY040:
				this.ky040Tick();
				break;
			default:
				this.defaultTick();
		}
	});
	
	
	this.SW.watch((err, value) => {
		if (err) {
			this.emit('error', err);
			return;
		}
		
		this.sw_value = value;
		this.click();
	});	
	
}

RotaryEncoder.prototype = EventEmitter.prototype;

RotaryEncoder.prototype.ky040Tick = function ky040Tick() {
	const { clk_value, dt_value } = this;
	//console.log('Using KY040 logic');
	
	if (clk_value == dt_value && (clk_value != LAST_CLK || dt_value != LAST_DT) && clk_value == 0)	
	{
		// CCW
		this.emit('rotation', 1);
	}
	else if( clk_value != dt_value && (clk_value != LAST_CLK || dt_value != LAST_DT) && clk_value == 0)
	{
		// CW
		this.emit('rotation', -1);
	}
	
	LAST_CLK = clk_value;
	LAST_DT = dt_value;	
	return this;
};

RotaryEncoder.prototype.defaultTick = function defaultTick()
{
	/* 
		Gray code 
		[
			00,
			01,
			11,
			10
		]
	*/
	const { clk_value, dt_value } = this;
	//console.log('Using gray code logic');
	
	const MSB = clk_value;
	const LSB = dt_value;

	const encoded = (MSB << 1) | LSB;
	const sum = (LAST_ENCODED << 2) | encoded;

	if (sum == 0b1101 || sum == 0b0100 || sum == 0b0010 || sum == 0b1011) {
		// CW
		this.emit('rotation', 1);
	}
	if (sum == 0b1110 || sum == 0b0111 || sum == 0b0001 || sum == 0b1000) {
		// CCW
		this.emit('rotation', -1);
	}

	LAST_ENCODED = encoded;
	return this;
}

RotaryEncoder.prototype.click = function click() {
	// 0 = down, 1 = up
	const { sw_value } = this;
	
	// CLICK
	this.emit('click', sw_value);
	
	return this;
};

module.exports = function rotaryEncoder(pin_CLK, pin_DT, pin_SW, encoderType) {
	return new RotaryEncoder(pin_CLK, pin_DT, pin_SW, encoderType);
};