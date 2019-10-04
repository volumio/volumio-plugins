'use strict';

var CallMonitor = require('./');

var fritzbox = {
  address: '192.168.178.1',
  port: '1012'
};

var monitor = new CallMonitor(fritzbox.address, fritzbox.port);

monitor.on('inbound', function (call) {
  console.log('- Incoming');
  console.log(call);
  console.log('');
});

monitor.on('outbound', function (call) {
  console.log('- Outgoing');
  console.log(call);
  console.log('');
});

monitor.on('connected', function (call) {
  console.log('- Connection Established');
  console.log(call);
  console.log('');
});

monitor.on('disconnected', function (call) {
  console.log('- Connection Ended');
  console.log(call);
  console.log('');
});

monitor.on('error', function (error) {
  switch (error.code) {
    case 'ENETUNREACH':
      console.log(`Cannot reach ${error.address}:${error.port}. Please check your connection.`);
      break;
    case 'ECONNREFUSED':
      console.log(`Connection refused on ${error.address}:${error.port}`);
      break;
    default:
      console.log(error);
      break;
  }
});
