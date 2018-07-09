'use strict';

// This example demonstrates how to call print twice in succession to display
// two strings at different positions on the LCD.

var Lcd = require('../lcd'),
  lcd = new Lcd({rs: 23, e: 24, data: [17, 18, 22, 27], cols: 20, rows: 4});

lcd.on('ready', function () {
  lcd.setCursor(0, 0);
  lcd.print('Hello!', function (err) {
    if (err) {
      throw err;
    }

    lcd.setCursor(0, 1);
    lcd.print('How are you?', function (err) {
      if (err) {
        throw err;
      }

      lcd.close();
    });
  });
});

