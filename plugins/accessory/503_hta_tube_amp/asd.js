var Gpio = require('onoff').Gpio,
	shutdown = new Gpio(22, 'high'),
	shutdowndetect = new Gpio(24, 'in', 'both'),
	rolloff = new Gpio(13, 'low');

rolloff.write(1, function (err) { // Asynchronous write.
		if (err) {
			self.logger.info('Cannot set rollof gpio')
		}
	});
