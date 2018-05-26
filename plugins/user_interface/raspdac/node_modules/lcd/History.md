1.1.4 - Jun 05 2016
===================

  * updated wiring for beaglebone examples
  * updated dependency: onoff 1.0.4 -> 1.1.1

1.1.3 - Mar 20 2016
===================

  * queue async operations and execute them sequentially

1.1.2 - Feb 07 2016
===================

  * Improved documentation and examples
  * Updated dependencies

1.1.1 - Mar 04 2015
===================

  * Got rid of the magic numbers and replaced them with a command map (by [nodebotanist](https://github.com/nodebotanist))
  * Added test harness and tests (by [nodebotanist](https://github.com/nodebotanist))

1.1.0 - Jan 10 2015
===================

  * Async methods now support callbacks

1.0.0 - Jan 10 2015
===================

  * Updated dependency: onoff 0.3.2 -> 1.0.0 (GPIO access without superuser privileges on Raspbian)
  * Updated dependency: q 1.0.1 -> 1.1.2

0.2.4 - May 08 2014
===================

  * Delay 1ms more than required [#8](https://github.com/fivdi/lcd/issues/8)

0.2.3 - May 01 2014
===================

  * Fallback to nextTick if setImmediate not available [#7](https://github.com/fivdi/lcd/issues/7)

0.2.2 - Apr 18 2014
===================

  * Fallback to setTimeout if setImmediate not available [#7](https://github.com/fivdi/lcd/issues/7)
  * Documented BeagleBone Ångström prerequisites [#8](https://github.com/fivdi/lcd/issues/8)
  * Updated dependency: onoff 0.3.1 -> 0.3.2

0.2.1 - Mar 28 2014
===================

  * v0.11.x process.nextTick compatibility [#5](https://github.com/fivdi/lcd/issues/5)
  * Example print-twice-20x4.js added
  * Updated dependency: onoff 0.3.0 -> 0.3.1
  * Updated dependency: q 0.9.7 -> 1.0.1

0.2.0 - Nov 23 2013
===================

  * Asynchronous print [#2](https://github.com/fivdi/lcd/issues/2)
  * Print optimization [#1](https://github.com/fivdi/lcd/issues/1)
  * Removed write8Bits method

0.1.0 - Nov 18 2013
===================

  * Updated dependencies: onoff 0.2.3 -> 0.3.0

0.0.4 - Nov 08 2013
===================

  * Use || rather than | where appropriate

0.0.3 - Nov 08 2013
===================

  * Example "Hello, World!" on an 8x1 display
  * Lcd constructor is now new-agnostic
  * API documentation

0.0.2 - Nov 07 2013
===================

  * Improved documentation
  * Improved performance-check-20x4

0.0.1 - Nov 07 2013
===================

  * Initial release

