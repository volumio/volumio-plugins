'use strict';
module.exports = Timer;

function Timer(context, enable_debug_logging) {
	var self = this;
	this.context = context;
	this.logger = this.context.logger;
	
	self.isActive = false;
	self.canContinue = false;
	self.debug_mode = enable_debug_logging;
	self.timerStarted = undefined;
	self.timeRemaining = undefined;
	self.cb = undefined;
	self.timer = null;
	
	this.isCounting = function () {
		return this.isActive;
	};
	
	this.isPaused = function () {
		return this.isActive;
	};
};



Timer.prototype.start = function(timeOut, callback)  {
	var self = this;
	self.timeRemaining = timeOut;
	self.cb = callback;
	
	if(!self.timer)
	{
		self.timerStarted = new Date().getTime();
		self.timer = setTimeout(self.cb, self.timeRemaining);
		self.isActive = true;
		if(self.debug_mode)
			console.log('-------------------------------------------------// S T A R T I N G');
	}
	// There is no else, the timer object should always be nullified when pausing/stopping
};

Timer.prototype.resume = function()  {
	var self = this;
	if(!self.timer)
	{
		self.timerStarted = new Date().getTime();
		self.timer = setTimeout(self.cb, self.timeRemaining);
		self.isActive = true;
		if(self.debug_mode)
			console.log('-------------------------------------------------// R E S U M I N G');
	}
	// There is no else, the timer object should always be nullified when pausing/stopping
};

Timer.prototype.pause = function()  {
	var self = this;
	if(self.timer)
	{
		clearTimeout(self.timer);		
		var now = new Date().getTime();
		self.timeRemaining -= now - self.timerStarted;
		self.isActive = false;
		self.canContinue = true;
		if(self.debug_mode && self.timeRemaining > 0)
			console.log('-------------------------------------------------// P A U S I N G (remaining: ' + self.timeRemaining + ' milliseconds)');
		
		return self.timeRemaining;
	}
};

Timer.prototype.stop = function()  {
	var self = this;
	if(self.timer)
	{
		clearTimeout(self.timer);
		self.isActive = false;
		self.canContinue = false;
		if(self.debug_mode)
			console.log('-------------------------------------------------// S T O P P I N G');
	}
	self.timer = null;
};

Timer.prototype.addMilliseconds = function(milliseconds)  {
	var self = this;
	if(self.timer)
	{
		clearTimeout(self.timer);
		var now = new Date().getTime();
		//self.timeRemaining -= now - self.timerStarted;
		console.log('Currently remaining: ' + self.timeRemaining);
		self.timeRemaining += milliseconds;
		
		self.timerStarted = new Date().getTime();
		self.timer = setTimeout(self.cb, self.timeRemaining);
		self.isActive = true;
		//if(self.debug_mode)
			console.log('-------------------------------------------------// Adding ' + milliseconds + ' milliseconds to a total of ' + self.timeRemaining + '.');
	}
};