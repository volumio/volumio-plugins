'use strict';

const libQ = require('kew');
const fs=require('fs-extra');
const config = new (require('v-conf'))();
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const Timeout = require('smart-timeout');
const Schedule = require('node-schedule');
const Gpio = require('onoff').Gpio;

module.exports = class pirMotionDetectionAutoplay {
	constructor(context) {
		this.context = context;
		this.commandRouter = this.context.coreCommand;
		this.logger = this.context.logger;
		this.configManager = this.context.configManager;
		this.gpioSwitch = null;
		this.gpioLed = null;
		this.sleepytime = false;
	}

	onVolumioStart() {
		const configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
		this.config = new (require('v-conf'))();
		this.config.loadFile(configFile);

	  return libQ.resolve();
	}

	addPirWatch() {
	  let lastMotion = null;

	  const watchPirSensorForContinuationMode = () => {
	    this.gpioPir.watch((err, value) => {
	      if (err) throw err;

	      this.gpioPir.unwatch();

	      if (!this.detectionIsActive) return;

	      if (this.gpioLed) this.blinkLed(4);

	      const { config, commandRouter } = this;

	      lastMotion = Date.now();

				Timeout.set('watch', () => {
					if (this.detectionIsActive) {
						watchPirSensorForContinuationMode();
					}
				}, 30000);

				Timeout.set('check', () => {
					if (Date.now() < lastMotion + 30000 + config.get("duration") * 1000)
	          return;

	        if (config.get("random")) commandRouter.stateMachine.setRandom(false);

	        if (config.get("playlist_mode")) {
	          commandRouter.stateMachine.pause();
	          return this.removePlaylistTitlesFromQueue();
	        }

					// add config option for stop or pause on motion detection?
	        commandRouter.stateMachine.pause();
				}, 30000 + config.get("duration") * 1000);

				let status = commandRouter.stateMachine.getState().status;
	      if (status == "play") return;

	      if (config.get("random")) commandRouter.stateMachine.setRandom(true);

	      if (config.get("playlist_mode")) {
          return commandRouter.playListManager.playPlaylist(
	          config.get("playlist")
	        );
	      }

	      if (this.commandRouter.stateMachine.getQueue().length) {
	        return commandRouter.stateMachine.play();
	      }

	      commandRouter.pushToastMessage(
	        "info",
	        "PIR motion detection autoplay",
	        "Motion detected but no items to play in queue."
	      );
	    });
	  };

	  watchPirSensorForContinuationMode();
	}

	onStart() {
		const self = this;
	  const defer = libQ.defer();

	  this.initGPIO();

		const timeframeEnabled = this.config.get("enable_timeframe");
		if(timeframeEnabled) {

			const startHour = Number.parseInt(this.config.get("timeframe_start_hour"));
			const endHour = Number.parseInt(this.config.get("timeframe_end_hour"));

			if((new Date()).getHours() >= startHour && (new Date()).getHours() < endHour) {
				this.sleepytime = false;
			} else {
				this.sleepytime = true;
			}

			var scheduler = Schedule.scheduleJob('0 ' + startHour + ' * * *', function(time) {
				self.sleepytime = false;
				applyDetectionConfiguration();
			});

			var scheduler = Schedule.scheduleJob('0 ' + endHour + ' * * *', function(time) {
				self.sleepytime = true;
				applyDetectionConfiguration();
			});
		}

		const applyDetectionConfiguration = () => {
			this.detectionIsActive = this.gpioSwitch ? this.gpioSwitch.readSync() ^ 1 : 1;

			if(this.gpioLed) {
				this.gpioLed.writeSync(this.detectionIsActive);
			}

			if(this.detectionIsActive && !this.sleepytime) {
        this.addPirWatch();
			} else {
				Timeout.clear('watch');
				Timeout.clear('check');
				if(this.commandRouter.stateMachine && this.commandRouter.stateMachine.getState().status == 'play') {
					this.commandRouter.stateMachine.stop();
				}
			}
		};

		applyDetectionConfiguration();

		if(this.gpioSwitch) {
			this.gpioSwitch.watch(function(err, value) {
				if (err) throw err;
				applyDetectionConfiguration();
			});
		}

		// Once the Plugin has successfull started resolve the promise
		defer.resolve();

	  return defer.promise;
	}

	onStop() {
	  const defer = libQ.defer();

	  this.commandRouter.stateMachine.stop();
	  this.freeGPIO();

	  // Once the Plugin has successfull stopped resolve the promise
	  defer.resolve();

	  return libQ.resolve();
	}

	onRestart() {
	  this.commandRouter.stateMachine.stop();
	  this.freeGPIO();
	}

	// GPIO handling -------------------------------------------------------------------------------------

	initGPIO() {
	  if (this.config.get("gpio_pir") > 0) {
	    this.gpioPir = new Gpio(this.config.get("gpio_pir"), "in", "rising");
	  }

	  if (this.config.get("enable_switch") && this.config.get("gpio_switch") > 0) {
	    this.gpioSwitch = new Gpio(this.config.get("gpio_switch"), "in", "both", {
	      debounceTimeout: 10
	    });
	  }

	  if (this.config.get("enable_led") && this.config.get("gpio_led") > 0) {
	    this.gpioLed = new Gpio(this.config.get("gpio_led"), "out");
	    this.gpioLed.writeSync(this.detectionIsActive);
	  }
	}

	freeGPIO() {
	  if (this.gpioPir) {
	    this.gpioPir.unexport();
	    this.gpioPir = null;
	  }

	  if (this.gpioSwitch) {
	    this.gpioSwitch.unexport();
	    this.gpioSwitch = null;
	  }

	  if (this.gpioLed) {
	    this.gpioLed.writeSync(0);
	    this.gpioLed.unexport();
	    this.gpioLed = null;
	  }
	}

	pirTest() {
	  this.commandRouter.pushToastMessage(
	    "success",
	    "PIR motion detection autoplay",
	    // Toast messages not translatable yet?
	    //this.commandRouter.getI18nString('PIR_MOTION_DETECTION_AUTOPLAY.PIR_TEST_START')
	    "Starting motion sensor test for 60 seconds."
	  );

	  setTimeout(function() {
	    this.gpioPir.watch(function(err, value) {
	      if (err) throw err;
	      if (this.gpioLed) {
	        this.blinkLed(4);
	      }
	      this.commandRouter.pushToastMessage(
	        "success",
	        "PIR motion detection autoplay",
	        "Motion detected!"
	      );
	    });
	  }, 1000);

	  setTimeout(function() {
	    this.gpioPir.unwatch();
	    this.commandRouter.pushToastMessage(
	      "info",
	      "PIR motion detection autoplay",
	      "Test time for motion sensor has ended."
	    );
	  }, 60000);

	  return libQ.resolve();
	}

	blinkLed(count) {
		const self = this;
	  (function blink(count) {
	    if (count <= 0) {
	      self.gpioLed.writeSync(self.detectionIsActive);
	      return;
	    }
	    self.gpioLed.read((err, value) => {
	      if (err) throw err;
	      self.gpioLed.write(value ^ 1, err => {
	        if (err) throw err;
	      });
	    });
	    setTimeout(() => blink(count - 1), 200);
	  })(count);
	}

	// Configuration Methods -----------------------------------------------------------------------------

	saveConfig(data) {
		if(data['enable_timeframe']
			&& (!data['timeframe_start_hour'].value	|| !data['timeframe_end_hour'].value)) {
			this.commandRouter.pushToastMessage('error',
				'Start and end time cannot be empty.',
				this.commandRouter.getI18nString('COMMON.SETTINGS_SAVE_ERROR')
			);
			return false;
		}
		if(data['timeframe_start_hour'].value >= data['timeframe_end_hour'].value) {
			this.commandRouter.pushToastMessage('error',
				'The end time cannot be before the starting time.',
				this.commandRouter.getI18nString('COMMON.SETTINGS_SAVE_ERROR')
			);
			return false;
		}

		this.config.set('gpio_pir', data['gpio_pir']);
		// IDEA: Just create playlist with this.commandRouter.playListManager.createPlaylist('playlistname')?
		this.config.set('playlist_mode', data['playlist_mode']);
		this.config.set('playlist', data['playlist']);
		this.config.set('random', data['random']);
		this.config.set('duration', data['duration'][0]);
		this.config.set('enable_switch', data['enable_switch']);
		this.config.set('gpio_switch', data['gpio_switch']);
		this.config.set('enable_led', data['enable_led']);
		this.config.set('gpio_led', data['gpio_led']);
		this.config.set('enable_timeframe', data['enable_timeframe']);
		this.config.set('timeframe_start_hour', data['timeframe_start_hour']['value']);
		this.config.set('timeframe_end_hour', data['timeframe_end_hour']['value']);

		this.freeGPIO();
		this.onStart();

		this.commandRouter.pushToastMessage('success',
			'PIR motion detection autoplay',
			this.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY')
		);
	}

	getLabelForSelect(options, key) {
		const n = options.length;
		for (let i = 0; i < n; i++) {
			if (options[i].value == key)
				return options[i].label;
		}

		return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
	}

	getUIConfig() {
		const self = this;
	  const defer = libQ.defer();
	  const lang_code = this.commandRouter.sharedVars.get('language_code');
		const { config, configManager } = this;

	  this.commandRouter
		  .i18nJson(
				__dirname+'/i18n/strings_'+lang_code+'.json',
	      __dirname+'/i18n/strings_en.json',
	      __dirname + '/UIConfig.json')
	    .then(function(uiconf) {
				configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value', config.get('gpio_pir', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value', config.get('playlist_mode', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value', config.get('playlist', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value', config.get('random', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[5].config.bars[0].value', config.get('duration', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[6].value', config.get('enable_switch', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[7].value', config.get('gpio_switch', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[8].value', config.get('enable_led', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[9].value', config.get('gpio_led', false));
				configManager.setUIConfigParam(uiconf, 'sections[0].content[10].value', config.get('enable_timeframe', false));
				self.configManager.setUIConfigParam(uiconf,
					'sections[0].content[11].value.label',
					self.getLabelForSelect(
						self.configManager.getValue(uiconf, 'sections[0].content[11].options'),
						config.get('timeframe_start_hour'),
					)
				);
				self.configManager.setUIConfigParam(uiconf,
					'sections[0].content[12].value.label',
					self.getLabelForSelect(
						self.configManager.getValue(uiconf, 'sections[0].content[12].options'),
						config.get('timeframe_end_hour'),
					)
				);
				defer.resolve(uiconf);
			})
			.fail(function() {
				defer.reject(new Error());
			});

		return defer.promise;
	}

	// Playback Controls ---------------------------------------------------------------------------------------

	removePlaylistTitlesFromQueue() {
		const { config, commandRouter } = this;

		const playlistContentPromise = commandRouter.playListManager.getPlaylistContent(config.get('playlist'));
		playlistContentPromise.then(function (playlistContent) {
			if (err) throw err;
			const queue = commandRouter.stateMachine.getQueue();
			playlistContent.forEach(function(playlistEntry) {
				const entryInQueue = queue.findIndex(function(queueEntry) {
					return queueEntry.uri == playlistEntry.uri;
				});
				if(entryInQueue >= 0) {
					commandRouter.stateMachine.removeQueueItem({value: entryInQueue});
				}
			});
		});
	}
}
