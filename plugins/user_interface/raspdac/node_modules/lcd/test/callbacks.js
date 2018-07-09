'use strict';

var async = require('async'),
  Lcd = require('../lcd'),
  lcd = new Lcd({rs: 23, e: 24, data: [17, 18, 22, 27], cols: 20, rows: 4});// Pi

lcd.on('ready', function () {
  async.series([
    function (cb) {
      lcd.print(new Array(81).join(String.fromCharCode(255)), cb);
    },
    function (cb) {
      setTimeout(function () {
        lcd.clear(cb);
      }, 500);
    },
    function (cb) {
      lcd.print('12345678', cb);
    },
    function (cb) {
      lcd.home(cb);
    },
    function (cb) {
      lcd.print('ab', cb);
    },
    function (cb) {
      lcd.setCursor(6, 0);
      lcd.print('cd', cb);
    }
  ], function (err) {
    if (err) {
      throw err;
    }

    lcd.close();
  });
});

