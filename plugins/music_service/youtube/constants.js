module.exports = {};
module.exports.BROWSE_SOURCE = {
  name: 'Youtube',
  uri: 'youtube',
  plugin_type: 'music_service',
  plugin_name: 'youtube',
  albumart: '/albumart?sourceicon=music_service/youtube/youtube.svg'
};

module.exports.BASE_STATUS = {
  service: 'youtube',
  artist: "Youtube",
  type: 'track',
  albumart: 'https://via.placeholder.com/150?text=Youtube',
  duration: 0,
  trackType: "YouTube",
  samplerate: '44 KHz',
  bitdepth: '24 bit'
};

module.exports.ROOT_NAV = {
  navigation: {
    prev: {
      uri: '/'
    },
    lists:
      [
        {
          title: 'My Youtube',
          icon: 'fa fa-youtube',
          availableListViews: ['list', 'grid'],
          items: [
            {
              service: 'youtube',
              type: 'folder',
              title: ' Activities',
              icon: 'fa fa-folder-open-o',
              uri: 'youtube/root/activities'
            },
            {
              service: 'youtube',
              type: 'folder',
              title: 'Subscriptions',
              icon: 'fa fa-folder-open-o',
              uri: 'youtube/root/subscriptions'
            },
            {
              service: 'youtube',
              type: 'folder',
              title: 'My Playlists',
              icon: 'fa fa-folder-open-o',
              uri: 'youtube/root/playlists'
            },
            {
              service: 'youtube',
              type: 'folder',
              title: 'Liked Videos',
              icon: 'fa fa-folder-open-o',
              uri: 'youtube/root/likedVideos'
            }
          ]
        }
      ]
  }
};
