'use strict';

const modelInstances = {};

let typeToClass = {
    album: 'album',
    discography: 'discography',
    discover: 'discover',
    track: 'track',
    search: 'search',
    artist: 'artist',
    label: 'label',
    show: 'show',
    article: 'article',
    tag: 'tag'
};

let getInstance = (type) => {
    if (modelInstances[type] == undefined) {
        modelInstances[type] = new (require(__dirname + '/' + typeToClass[type]))();
    }
    return modelInstances[type];
}

module.exports = {
    getInstance: getInstance
};