'use strict';

/**
 * Call asynchronous print twice in succession to print a total of 78
 * characters. The output from the two calls should not be interlaced as print
 * calls are queued and executed sequentially.
 */
var Lcd = require('../lcd'),
  lcd = new Lcd({rs: 23, e: 24, data: [17, 18, 22, 27], cols: 20, rows: 4}),// Pi
  printed = 0;

lcd.on('ready', function () {
  lcd.print(new Array(40).join('a'));
  lcd.print(new Array(40).join('b'));
});

lcd.on('printed', function () {
  printed += 1;

  if (printed === 2) {
    lcd.close();
  }
});

