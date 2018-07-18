'use strict';

var EventEmitter = require('events').EventEmitter,
  Gpio = require('onoff').Gpio,
  Q = require('q'),
  util = require('util'),
  tick = global.setImmediate || process.nextTick;

var __ROW_OFFSETS = [0x00, 0x40, 0x14, 0x54];

var __COMMANDS = {
  CLEAR_DISPLAY: 0x01,
  HOME: 0x02,
  SET_CURSOR: 0x80,
  DISPLAY_ON: 0x04,
  DISPLAY_OFF: ~0x04,
  CURSOR_ON: 0x02,
  CURSOR_OFF: ~0x02,
  BLINK_ON: 0x01,
  BLINK_OFF: ~0x01,
  SCROLL_LEFT: 0x18,
  SCROLL_RIGHT: 0x1c,
  LEFT_TO_RIGHT: 0x02,
  RIGHT_TO_LEFT: ~0x02,
  AUTOSCROLL_ON: 0x01,
  AUTOSCROLL_OFF: ~0x01
};

function Lcd(config) {
  var i;

  if (!(this instanceof Lcd)) {
    return new Lcd(config);
  }

  EventEmitter.call(this);

  this.cols = config.cols || 16; // TODO - Never used, remove?
  this.rows = config.rows || 1;
  this.largeFont = !!config.largeFont;

  this.rs = new Gpio(config.rs, 'low'); // reg. select, output, initially low
  this.e = new Gpio(config.e, 'low'); // enable, output, initially low

  this.data = []; // data bus, db4 thru db7, outputs, initially low
  for (i = 0; i < config.data.length; i += 1) {
    this.data.push(new Gpio(config.data[i], 'low'));
  }

  this.displayControl = 0x0c; // display on, cursor off, cursor blink off
  this.displayMode = 0x06; // left to right, no shift

  this.asyncOps = [];

  this.init();
}

util.inherits(Lcd, EventEmitter);
module.exports = Lcd;

// private
Lcd.prototype.init = function () {
  Q.delay(16)                                               // wait > 15ms
  .then(function () { this._write4Bits(0x03); }.bind(this)) // 1st wake up
  .delay(6)                                                 // wait > 4.1ms
  .then(function () { this._write4Bits(0x03); }.bind(this)) // 2nd wake up
  .delay(2)                                                 // wait > 160us
  .then(function () { this._write4Bits(0x03); }.bind(this)) // 3rd wake up
  .delay(2)                                                 // wait > 160us
  .then(function () {
    var displayFunction = 0x20;

    this._write4Bits(0x02); // 4 bit interface

    if (this.rows > 1) {
      displayFunction |= 0x08;
    }
    if (this.rows === 1 && this.largeFont) {
      displayFunction |= 0x04;
    }
    this._command(displayFunction);

    this._command(0x10);
    this._command(this.displayControl);
    this._command(this.displayMode);

    this._command(0x01); // clear display (don't call clear to avoid event)
  }.bind(this))
  .delay(3)             // wait > 1.52ms for display to clear
  .then(function () { this.emit('ready'); }.bind(this));
};

Lcd.prototype.print = function (val, cb) {
  this._queueAsyncOperation(function (cb2) {
    var index,
      displayFills;

    val += '';

    // If n*80+m characters should be printed, where n>1, m<80, don't display the
    // first (n-1)*80 characters as they will be overwritten. For example, if
    // asked to print 802 characters, don't display the first 720.
    displayFills = Math.floor(val.length / 80);
    index = displayFills > 1 ? (displayFills - 1) * 80 : 0;

    this._printChar(val, index, cb, cb2);
  }.bind(this));
};

// private
Lcd.prototype._printChar = function (str, index, cb, cb2) {
  tick(function () {
    if (index >= str.length) {
      if (cb) {
        cb(null, str);
      } else {
        this.emit('printed', str);
      }

      return cb2(null);
    }

    try {
      this._write(str.charCodeAt(index));
      this._printChar(str, index + 1, cb, cb2);
    } catch (e) {
      if (cb) {
        cb(e);
      } else {
        this.emit('error', e);
      }

      return cb2(e);
    }
  }.bind(this));
};

Lcd.prototype.clear = function (cb) {
  this._queueAsyncOperation(function (cb2) {
    // Wait > 1.52ms. There were issues waiting for 2ms so wait 3ms.
    this._commandAndDelay(__COMMANDS.CLEAR_DISPLAY, 3, 'clear', cb, cb2);
  }.bind(this));
};

Lcd.prototype.home = function (cb) {
  this._queueAsyncOperation(function (cb2) {
    // Wait > 1.52ms. There were issues waiting for 2ms so wait 3ms.
    this._commandAndDelay(__COMMANDS.HOME, 3, 'home', cb, cb2);
  }.bind(this));
};

Lcd.prototype.setCursor = function (col, row) {
  var r = row > this.rows ? this.rows - 1 : row; //TODO: throw error instead? Seems like this could cause a silent bug.
  //we don't check for column because scrolling is a possibility. Should we check if it's in range if scrolling is off?
  this._command(__COMMANDS.SET_CURSOR | (col + __ROW_OFFSETS[r]));
};

Lcd.prototype.display = function () {
  this.displayControl |= __COMMANDS.DISPLAY_ON;
  this._command(this.displayControl);
};

Lcd.prototype.noDisplay = function () {
  this.displayControl &= __COMMANDS.DISPLAY_OFF;
  this._command(this.displayControl);
};

Lcd.prototype.cursor = function () {
  this.displayControl |= __COMMANDS.CURSOR_ON;
  this._command(this.displayControl);
};

Lcd.prototype.noCursor = function () {
  this.displayControl &= __COMMANDS.CURSOR_OFF;
  this._command(this.displayControl);
};

Lcd.prototype.blink = function () {
  this.displayControl |= __COMMANDS.BLINK_ON;
  this._command(this.displayControl);
};

Lcd.prototype.noBlink = function () {
  this.displayControl &= __COMMANDS.BLINK_OFF;
  this._command(this.displayControl);
};

Lcd.prototype.scrollDisplayLeft = function () {
  this._command(__COMMANDS.SCROLL_LEFT);
};

Lcd.prototype.scrollDisplayRight = function () {
  this._command(__COMMANDS.SCROLL_RIGHT);
};

Lcd.prototype.leftToRight = function () {
  this.displayMode |= __COMMANDS.LEFT_TO_RIGHT;
  this._command(this.displayMode);
};

Lcd.prototype.rightToLeft = function () {
  this.displayMode &= __COMMANDS.RIGHT_TO_LEFT;
  this._command(this.displayMode);
};

Lcd.prototype.autoscroll = function () {
  this.displayMode |= __COMMANDS.AUTOSCROLL_ON;
  this._command(this.displayMode);
};

Lcd.prototype.noAutoscroll = function () {
  this.displayMode &= __COMMANDS.AUTOSCROLL_OFF;
  this._command(this.displayMode);
};

Lcd.prototype.close = function () {
  var i;

  this.rs.unexport();
  this.e.unexport();

  for (i = 0; i < this.data.length; i += 1) {
    this.data[i].unexport();
  }
};

// private
Lcd.prototype._queueAsyncOperation = function (asyncOperation) {
  this.asyncOps.push(asyncOperation);

  if (this.asyncOps.length === 1) {
    (function next() {
      this.asyncOps[0](function () {
        this.asyncOps.shift();
        if (this.asyncOps.length !== 0) {
          next.bind(this)();
        }
      }.bind(this));
    }.bind(this)());
  }
}

// private
Lcd.prototype._commandAndDelay = function (command, timeout, event, cb, cb2) {
  tick(function () {
    try {
      this._command(command);
    } catch (e) {
      if (cb) {
        cb(e);
      } else {
        this.emit('error', e);
      }

      return cb2(e);
    }

    setTimeout(function () {
      if (cb) {
        cb(null);
      } else {
        this.emit(event);
      }

      return cb2(null);
    }.bind(this), timeout);
  }.bind(this));
};

// private
Lcd.prototype._command = function (cmd) {
  this._send(cmd, 0);
};

// private
Lcd.prototype._write = function (val) {
  this._send(val, 1);
};

// private
Lcd.prototype._send = function (val, mode) {
  this.rs.writeSync(mode);
  this._write4Bits(val >> 4);
  this._write4Bits(val);
};

// private
Lcd.prototype._write4Bits = function (val) {
  if(!(typeof val === 'number')){
    throw new Error("Value passed to ._write4Bits must be a number");
  }

  var i;

  for (i = 0; i < this.data.length; i += 1, val = val >> 1) {
    this.data[i].writeSync(val & 1);
  }

  // enable pulse >= 300ns
  // writeSync takes ~10 microseconds to execute on the BBB, so there's
  // nothing special needed to wait 300 nanoseconds.
  this.e.writeSync(1);
  this.e.writeSync(0);
};

