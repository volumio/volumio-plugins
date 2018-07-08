'use strict';

var Lcd = require('../lcd'),
  lcd = new Lcd({rs: 45, e: 44, data: [66, 67, 68, 69], cols: 8, rows: 1});

function print(str, pos) {
  pos = pos || 0;

  if (pos === str.length) {
    pos = 0;
  }

  lcd.print(str[pos], function (err) {
    if (err) {
      throw err;
    }

    setTimeout(function () {
      print(str, pos + 1);
    }, 300);
  });
}

lcd.on('ready', function () {
  lcd.setCursor(8, 0);
  lcd.autoscroll();
  print('Hello, World! ** ');
});

// If ctrl+c is hit, free resources and exit.
process.on('SIGINT', function () {
  lcd.close();
  process.exit();
});

