'use strict';

/**
 * The Lcd print method is optimized not to display charachters that will be
 * overwritten. The tests below verify that this optimization functions
 * correctly.
 */
var Lcd = require('../lcd'),
  Q = require('q'),
  lcd = new Lcd({rs: 23, e: 24, data: [17, 18, 22, 27], cols: 20, rows: 4});// Pi

lcd.on('ready', function () {
  Q.fcall(function () {
    lcd.print('abc'); // 'abc'
  })
  .delay(1000)
  .then(function () {
    lcd.print(new Array(81).join('.') + 'abc'); // '...abc..'
  })
  .delay(1000)
  .then(function () {
    lcd.setCursor(0, 0);
    lcd.print(new Array(801).join('+') + 'abc'); // 'abc+++++'
  })
  .delay(1000)
  .then(function () {
    lcd.setCursor(0, 0);
    lcd.print(new Array(800001).join('*') + '<Hello>'); // '<Hello>*'
  })
  .delay(1000)
  .then(function () {
    lcd.setCursor(8, 0);
    lcd.autoscroll();
    lcd.print(new Array(801).join('+') + 'abc'); // '+++++abc'
  });
});

