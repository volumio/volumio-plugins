'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseViewHandler = require(__dirname + '/base');

class UserViewViewHandler extends BaseViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();
        let prevUri = self.constructPrevUri();
        let view = self.getCurrentView();
        let model = self.getModel('userView');
        let parser = self.getParser('userView');

        model.getUserViews().then( (userViews) => {
            let myMediaItems = [];
            userViews.items.forEach( (userView) => {
                let parsed = parser.parseToListItem(userView);
                if (parsed) {
                    if (userView.Type === 'CollectionFolder' && userView.CollectionType === 'music') {
                        parsed.isLibrary = true;
                        parsed.libraryId = userView.Id;
                    }
                    else {
                        parsed.isLibrary = false;
                    }
                    myMediaItems.push(parsed);
                }
            });
            return {
                availableListViews: ['list', 'grid'],
                title: jellyfin.getI18n('JELLYFIN_MY_MEDIA'),
                items: myMediaItems
            };
        }).then( (myMediaItemsList) => {
            let latestDefer = libQ.defer();

            if (jellyfin.getConfigValue('showLatestMusicSection', true)) {
                let libraries = myMediaItemsList.items.filter( userView => userView.isLibrary );
                
                let latest = [];
                libraries.forEach( (library, index) => {
                    latest.push(self._getLatestAlbumsInLibrary(library, index));
                });

                let lists = [myMediaItemsList];
                
                libQ.all(latest).then( (result) => {
                    result.forEach( (entry) => {
                        if (entry.items.length) {
                            lists.push({
                                availableListViews: ['list', 'grid'],
                                title: entry.title,
                                items: entry.items
                            });
                        }
                    });
                    latestDefer.resolve(lists);
                }).fail( (error) => {
                    latestDefer.resolve([myMediaItemsList]);
                });
            }
            else {
                latestDefer.resolve([myMediaItemsList]);
            }

            return latestDefer.promise;
        }).then( (allLists) => {
        	return {
                prev: {
                    uri: prevUri
                },
                lists: allLists
            };
        })
        .then( nav => self.setPageTitle(view, nav) )
        .then( nav => {
            defer.resolve({
                navigation: nav
            });
        }).fail( (error) => {
        	defer.reject(error);
        });

        return defer.promise;
    }

    _getLatestAlbumsInLibrary(library) {
    	let self = this;
    	let defer = libQ.defer();
        
        let moreUri = self.getUri() + '/albums@parentId=' + library.libraryId + '@sortBy=DateCreated,SortName@sortOrder=Descending,Ascending@fixedView=latest';

        let model = self.getModel('album');
        let parser = self.getParser('album');
		let options = self.getModelOptions({
			parentId: library.libraryId,
			sortBy: 'DateCreated,SortName',
			sortOrder: 'Descending,Ascending',
			limit: jellyfin.getConfigValue('latestMusicSectionItems', 11)
		});

		model.getAlbums(options).then( (albums) => {
            let items = [];

            albums.items.forEach( (album) => {
                items.push(parser.parseToListItem(album));
            });

            if (albums.items.length < albums.total) {
                items.push(this.constructNextPageItem(moreUri, "<span style='color: #7a848e;'>" + jellyfin.getI18n('JELLYFIN_VIEW_MORE') + "</span>"));
            }

            defer.resolve({
                title: jellyfin.getI18n('JELLYFIN_LATEST_IN', library.title),//'Latest in ' + library.title
                availableListViews: ['list', 'grid'],
            	items: items
            });
		}).fail( (error) => { // return empty list
			defer.resolve({
				items: [],
			});
		});

		return defer.promise;
    }

}

module.exports = UserViewViewHandler;