'use strict';

/*
 * Fill the display with each character and determine how often the display
 * can be filled per second. At the same time, determine how often
 * setInterval(..., 1) times out per second.
 */
var Lcd = require('../lcd'),
  lcd = new Lcd({rs: 23, e: 24, data: [17, 18, 22, 27], cols: 20, rows: 4}),// Pi
  charCode = 0,
  timeouts = 0,
  time,
  iv;

function fillDisplay() {
  lcd.print(new Array(20 * 4 + 1).join(String.fromCharCode(charCode)));
  charCode += 1;
}

function printResults() {
  var seconds,
    displayFillsPerSec,
    timeoutsPerSec;

  time = process.hrtime(time);
  seconds = time[0] + time[1] / 1E9;

  displayFillsPerSec = Math.floor(256 / seconds);
  console.log(displayFillsPerSec + ' display fills per second');

  timeoutsPerSec = Math.floor(timeouts / seconds);
  console.log(timeoutsPerSec + ' timeouts per second');
}

lcd.on('ready', function () {
  time = process.hrtime();
  iv = setInterval(function () {
    timeouts += 1;
  }, 1);
  fillDisplay();
});

lcd.on('printed', function () {
  if (charCode < 256) {
    fillDisplay();
  } else {
    printResults();
    clearInterval(iv);
    lcd.close();
  }
});

