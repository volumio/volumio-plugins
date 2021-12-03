'use strict';

const libQ = require('kew');
const BaseModel = require(__dirname + '/base');

class UserViewModel extends BaseModel {

    getUserViews(tag = '') {
        let defer = libQ.defer();
        let apiClient = this.getApiClient();

        apiClient.getUserViews().then(
            (result) => {
                defer.resolve({
                    items: result.Items,
                    startIndex: 0,
                    total: result.Items.length,
                    tag: tag
                });
            },
            (error) => {
                defer.reject(error);
            }
        );

        return defer.promise;
    }

    getUserView(userViewId) {
        return this.getItem(userViewId);
    }
}

module.exports = UserViewModel;