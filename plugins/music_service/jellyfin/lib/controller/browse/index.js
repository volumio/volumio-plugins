'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const ViewHandlerFactory = require(__dirname + '/view-handlers/factory');

class BrowseController {

    /* 
     *  uri follows a hierarchical view structure, starting with 'jellyfin'.
     * - If nothing follows 'jellyfin', the view would be 'root' (show server list)
     * - The next segment that follows is 'serverId', i.e. 'jellyfin/{serverId}'. If there are no further segments, the view would be 'userViews' (shows user views for the server specified by serverId)
     * 
     * After 'jellyfin/{serverId}', the uri consists of segments representing the following views:
     * - library[@parentId=...]: shows 'Albums', 'Artists'...for the specified library
     * - albums[@parentId=...][@artistId=...| @albumArtistId=...| @genreId=...][@startIndex=...][@viewType=latest|favorite][@search=...]: shows albums under the item specified by parentId, optionally filtered by artistId, albumArtistId, genreId...
     * - artists[@parentId=...][@startIndex=...][@viewType=favorite][@search=...]
     * - albumArtists[@parentId=...][@startIndex=...][@viewType=favorite]
     * - playlists[@startIndex=...]
     * - genres[@parentId=...][@startIndex=...]
     * - songs[@albumId=...] | [ [@playlistId=...| @parentId=...][@startIndex=...] ][@viewType=recentlyPlayed|frequentlyPlayed|favorite][@search=...]
     * 
     */
    browseUri(uri) {
        jellyfin.getLogger().info('[jellyfin-browse] browseUri(' + uri + ')');

        let defer = libQ.defer();

        ViewHandlerFactory.getHandler(uri).then( (handler) => {
            return handler.browse();
        }).then( (result) => {
            defer.resolve(result);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    /**
     * Explodable uris:
     * - song[@songId=...]
     * - songs[@albumId=...] | [ [@playlistId=...| @parentId=...] ]
     * - albums[@parentId=...][@genreId=...| @artistId=...| @albumArtistId=...]
     * 
     */
    explodeUri(uri) {
        jellyfin.getLogger().info('[jellyfin-browse] explodeUri(' + uri + ')');

        let defer = libQ.defer();

        ViewHandlerFactory.getHandler(uri).then( (handler) => {
            return handler.explode();
        }).then( (result) => {
            defer.resolve(result);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

}

module.exports = BrowseController;