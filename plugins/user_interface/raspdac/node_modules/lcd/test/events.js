'use strict';

var Lcd = require('../lcd'),
  lcd = new Lcd({rs: 23, e: 24, data: [17, 18, 22, 27], cols: 20, rows: 4});// Pi

lcd.on('error', function (err) {
  console.log(err);
});

lcd.on('ready', function () {
  lcd.print(new Array(81).join(String.fromCharCode(255)));
  lcd.once('printed', function () {

    lcd.clear();
    lcd.once('clear', function () {

      lcd.print('12345678');
      lcd.once('printed', function () {

        lcd.home();
        lcd.once('home', function () {

          lcd.print('ab');
          lcd.once('printed', function () {

            lcd.setCursor(6, 0);

            lcd.print('cd');
            lcd.once('printed', function () {

              lcd.close();
            });
          });
        });
      });
    });
  });
});

