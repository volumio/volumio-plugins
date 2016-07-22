level-packager
==============

<img alt="LevelDB Logo" height="100" src="http://leveldb.org/img/logo.svg">

**LevelUP package helper for distributing with a LevelDOWN-compatible back-end**

[![NPM](https://nodei.co/npm/level-packager.png?stars&downloads)](https://nodei.co/npm/level-packager/) [![NPM](https://nodei.co/npm-dl/level-packager.png)](https://nodei.co/npm/level-packager/)

[![Build Status](https://secure.travis-ci.org/Level/packager.png)](http://travis-ci.org/Level/packager)
[![dependencies](https://david-dm.org/Level/packager.svg)](https://david-dm.org/level/packager)

**level-packager** exports single function which takes a single argument, a LevelDOWN-API compatible storage back-end for LevelUP. The function returns a constructor function that will bundle LevelUP with the given LevelDOWN replacement. The full API is supported, including all optional arguments, `repair()`, `delete()` and `copy()`. See **[level](https://github.com/Level/level)**, **[level-hyper](https://github.com/Level/level-hyper)** or **[level-lmdb](https://github.com/Level/level-lmdb)** as example use-cases.

Also available is a *test.js* file that can be used to verify that the user-package works as expected.

<a name="contributing"></a>
Contributing
------------

**level-packager** is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

See the [contribution guide](https://github.com/Level/community/blob/master/CONTRIBUTING.md) for more details.

<a name="license"></a>
License &amp; Copyright
-------------------

Copyright (c) 2012-2015 **level-packager** [contributors](https://github.com/level/community#contributors).

**level-packager** is licensed under the MIT license. All rights not explicitly granted in the MIT license are reserved. See the included `LICENSE.md` file for more details.
