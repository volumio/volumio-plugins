'use strict';

var STR_PAD_LEFT = 1;
var STR_PAD_RIGHT = 2;
var STR_PAD_BOTH = 3;

var DISPLAY_WIDTH = 16;
var DISPLAY_HEIGHT = 2;

var ANIMATION_SPEED = 500; // in milliseconds

var Lcd = require('lcd');
var Q = require('q');

if (!String.prototype.padEnd) {
  String.prototype.padEnd = function (count, str) {
  	var rep = count - str.length > 0 ? count - str.length : 0;
    return (this + (str || ' ').repeat(rep)).substr(0,count);
  };
}

if (!String.prototype.padStart) {
  String.prototype.padStart = function (count, str) {
    return (str || ' ').repeat(count).substr(0,count) + this;
  };
}

module.exports = raspdacDisplay;

function raspdacDisplay(context) {
	var self = this;

	self.displayTimer = undefined;
	self.currentState = undefined;
	self.elapsed = 0;

	self.context = context;
  	self.logger = self.context.logger;

	self.lcd = new Lcd({rs: 7, e: 8, data: [25, 24, 23, 27], cols: 16, rows: 2});
};


raspdacDisplay.prototype.pushState = function(state)  {
	var self = this;
	self.elapsed = state.seek;
	if (state.status === 'play') {		
		if (self._needStartDisplayInfo(state)) {
			clearTimeout(self.displayTimer);
			self.lcd.clear();
			self.displayInfo(state, 0);
		}
	}
	else if (state.status === 'stop') {
		self.elapsed = 0;
		clearTimeout(self.displayTimer);
		self.lcd.clear();
	}
	else if (state.status === 'pause') {
		self.elapsed = state.seek;
	}
	self.currentState = state;
}

raspdacDisplay.prototype.close = function() {
	var self = this;
	if (self.displayTimer !== undefined) {
		clearTimeout(self.displayTimer);
	}
	self.lcd.close();
};


raspdacDisplay.prototype.stopDisplayDuration = function() {
	var self = this;
	if (self.displayTimer !== undefined) {
		clearTimeout(self.displayTimer);
		self.displayTimer = undefined;
	}
	self.lcd.clear();
}

raspdacDisplay.prototype.endOfSong = function() {
	var self = this;

	if (self.displayTimer !== undefined) {
		clearTimeout(self.displayTimer);
		self.displayTimer = undefined;
	}	
	self.lcd.clear();
}

raspdacDisplay.prototype.displayInfo = function(data, index) {
	var self = this;

 	var duration = data.duration;

	if (self.elapsed >= duration * 1000) {
		self.endOfSong();
	}
	else {
	    //self.lcd.clear();
	    // Display artist info
	    var artistInfo = data.artist + '-' + data.title;
	    var buff = artistInfo;
	    if (buff.length > DISPLAY_WIDTH) {
	    	buff = artistInfo + '          ' + artistInfo.substr(0, DISPLAY_WIDTH);
	    }
	    else {
	    	buff = buff + (' ').repeat(DISPLAY_WIDTH-buff.length);
	    	buff = buff.substr(0, DISPLAY_WIDTH);
	    }

	    if (index >= buff.length - DISPLAY_WIDTH) {
	    	index = 0;
	    }
	    self.lcd.setCursor(0,0);
	    self.lcd.print(buff.substr(index, DISPLAY_WIDTH), function() {  
	  	    // Display duration
	  	    self.lcd.setCursor(0,1);
	  	    self.lcd.print(self._formatDuration(self.elapsed,duration), function() {
	  	    	self.displayTimer = setTimeout( function () {
	  	    		if (self.currentState.status != 'pause')
	  	    			self.elapsed += ANIMATION_SPEED;
	  	    		self.displayInfo(data, index + 1);
	  	    	}, ANIMATION_SPEED);
	  	    });
	  	});
	}
}

// private
raspdacDisplay.prototype._formatDuration = function(seek, duration) {
  var self = this;
  var seek_sec = Math.ceil(seek / 1000).toFixed(0);
  var seek_min = Math.floor(seek_sec / 60);
  seek_sec = seek_sec - seek_min * 60;
  
  var dur_min = Math.floor(duration / 60);
  var dur_sec = duration - dur_min * 60;

  if (seek_sec < 10) {seek_sec = "0"+seek_sec;}
  if (dur_sec < 10) {dur_sec = "0"+dur_sec;}  
  
  var dur = '   '+seek_min+'.'+seek_sec+':'+dur_min+'.'+dur_sec+'   ';

  return dur.substr(0,DISPLAY_WIDTH);
}

//private
raspdacDisplay.prototype._displayRunning = function(state) {
  var self = this;
  return (typeof(self.currentState) === 'undefined' ||
          self.currentState.artist !== state.artist || 
  	  	  self.currentState.title !== state.title);
}

//private
raspdacDisplay.prototype._needStartDisplayInfo = function(state) {
  var self = this;
  return  ((state.status === 'play' && self.currentState.status === 'stop') ||
          self.currentState.artist !== state.artist || 
  	  	  self.currentState.title !== state.title);
}
