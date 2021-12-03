/* jshint node: true, esversion: 9, unused: false */
const serviceName = 'pandora';
const uriParts = {
    keys : [
        '/' + serviceName,
        'stationToken=',
        'trackId='
    ],
    cap: '(\\d+)',
};
const uriPrefix = uriParts.keys.slice(0, 2).join('/');  // = '/pandora/stationToken=' 
const uriStaRE = new RegExp(uriPrefix + uriParts.cap); // = /\/pandora\/stationToken=(\d+)/
const mqttTopic = dataName => {
    return ['volumio', serviceName, dataName].join('/');
};

module.exports.serviceName = serviceName;
module.exports.uriParts = uriParts;
module.exports.uriPrefix = uriPrefix;
module.exports.uriStaRE = uriStaRE;
module.exports.mqttTopic = mqttTopic;