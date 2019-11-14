# node-aead-crypto
OpenSSL bindings for AEAD ciphers

**Note: This module is not necessary on NodeJS 10+ because you can now provide the `authTagLength`.**

## Supported ciphers
* AES-CCM
* AES-GCM

This package is based on code from https://github.com/spark/node-aes-ccm and https://github.com/xorbit/node-aes-gcm.
I've updated both to compile on Windows machines and included configuration to automatically precompile binaries for multiple platforms (Windows, Linux, OSX, ARM).

## Usage
TODO

## Changelog

### 2.1.1 (2018-11-27)
* (AlCalzone) Dropped `node-pre-gyp` for `prebuild`

### 2.0.0 (2018-11-04)
* (AlCalzone) Rework the installation procedure to fail on Node 10+

### 1.1.6 (2018-09-19)
* (AlCalzone) Update node-pre-gyp dependency

### 1.1.4 (2018-06-28)
* (AlCalzone) Update node-pre-gyp dependency

### 1.1.3 (2018-04-30)
* (AlCalzone) Update dependency versions hoping to fix an installation error

### 1.1.0
* (AlCalzone) Support NodeJS 10, drop Node 9 from precompilation

### 1.0.5
* (AlCalzone) Fixed installation issues on RPi 1

### 1.0.4
* (AlCalzone) Fixed installation issues on RPi 1

### 1.0.3
* (AlCalzone) Drop Node 7 from precompilation, add Node 9

### 1.0.2
* (AlCalzone) fixed typescript definitions

### 1.0.0
* (AlCalzone) initial release
