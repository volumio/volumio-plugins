'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var configItem = ["show_more", "media_dir_a", "media_dir_p", "media_dir_v", "db_dir", "log_dir",
                  "root_container", "network_interface", "port", "presentation_url", "friendly_name",
                  "serial", "model_name", "model_number", "inotify", "album_art_names", "strict_dlna",
                  "enable_tivo", "notify_interval", "minissdpdsocket", "force_sort_criteria", "max_connections",
                  "loglevel_general", "loglevel_artwork", "loglevel_database", "loglevel_inotify",
                  "loglevel_scanner", "loglevel_metadata", "loglevel_http", "loglevel_ssdp", "loglevel_tivo"];


module.exports = minidlna;
function minidlna(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.commandRouter.logger;
    this.configManager = this.context.configManager;
}


minidlna.prototype.onVolumioStart = function() {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
};

minidlna.prototype.onStart = function() {
    var self = this;
    var defer = libQ.defer();

    self.initialConf()
        .then(function(e) {
            self.logger.info("Starting minidlna.service");
            self.systemctl("start", "minidlna.service")
                .then(function(e) {
                    defer.resolve();
                });
        })
        .fail(function(e) {
            defer.reject(new Error("on starting miniDLNA plugin"));
        });

    return defer.promise;
};

minidlna.prototype.onStop = function() {
    var self = this;
    var defer = libQ.defer();

    self.logger.info("Stopping minidlna.service");
    self.systemctl("stop", "minidlna.service")
        .then(function(e) {
            defer.resolve();
        })
        .fail(function(e) {
            defer.reject(new Error("on stopping miniDLNA plugin"));
        });

    return defer.promise;
};


// Configuration Methods -----------------------------------------------------------------------------

minidlna.prototype.getLabelForSelect = function(options, key) {

    for (var i = 0; i < options.length; i++) {
        if (options[i].value == key) {
            return options[i].label;
        }
    }

    return "VALUE NOT FOUND BETWEEN SELECT OPTIONS!";
};

minidlna.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');
    var value;

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf) {
            for (var i = 0; i < configItem.length; i++) {
                value = self.config.get(configItem[i]);
                switch (configItem[i]) {
                    case "root_container":
                    case "loglevel_general":
                    case "loglevel_artwork":
                    case "loglevel_database":
                    case "loglevel_inotify":
                    case "loglevel_scanner":
                    case "loglevel_metadata":
                    case "loglevel_http":
                    case "loglevel_ssdp":
                    case "loglevel_tivo":
                        self.configManager.setUIConfigParam(uiconf, "sections[0].content[" + i + "].value.value", value);
                        self.configManager.setUIConfigParam(uiconf, "sections[0].content[" + i + "].value.label", self.getLabelForSelect(self.configManager.getValue(uiconf, "sections[0].content[" + i + "].options"), value));
                        break;
                    default:
                        uiconf.sections[0].content[i].value = value;
                }
            }
            defer.resolve(uiconf);
        })
        .fail(function() {
            defer.reject(new Error());
        });

        return defer.promise;
};

minidlna.prototype.getConfigurationFiles = function() {
    return ["config.json"];
};

minidlna.prototype.saveConf = function (data) {
    var self = this;
    var defer = libQ.defer();

    for (var i = 0; i < configItem.length; i++) {
        switch (configItem[i]) {
            case "root_container":
            case "loglevel_general":
            case "loglevel_artwork":
            case "loglevel_database":
            case "loglevel_inotify":
            case "loglevel_scanner":
            case "loglevel_metadata":
            case "loglevel_http":
            case "loglevel_ssdp":
            case "loglevel_tivo":
                self.config.set(configItem[i], data[configItem[i]].value);
                break;
            default:
                self.config.set(configItem[i], data[configItem[i]]);
        }
    }
    self.createMinidlnaConf()
        .then(function(e) {
            self.logger.info("Restarting minidlna.service");
            self.systemctl("restart", "minidlna.service")
                .then(function(e) {
                    self.commandRouter.pushToastMessage("success", "miniDLNA", "The miniDLNA configuration has been updated.");
                    self.logger.success("The miniDLNA configuration has been updated.");
                    defer.resolve();
                });
        })
        .fail(function(e) {
            defer.reject();
        });

    return defer.promise;
};


// Plugin Methods ------------------------------------------------------------------------------------

minidlna.prototype.initialConf = function() {
    var self = this;
    var defer = libQ.defer();

    if (!fs.existsSync("/etc/minidlna.conf")) {
        self.createMinidlnaConf()
            .then(function(e) {
                defer.resolve();
            })
            .fail(function(e) {
                self.commandRouter.pushToastMessage("error", "miniDLNA", "Error creating /etc/minidlna.conf.");
                defer.reject(new Error("on creating /etc/minidlna.conf."));
            });
    } else {
        return libQ.resolve();
    }

    return defer.promise;
};

minidlna.prototype.createMinidlnaConf = function () {
// derived from balbuze's "createVolumiominidlnaFile" function of his volumiominidlna plugin - many thanks to balbuze
    var self = this;
    var defer = libQ.defer();
    var value;

    fs.readFile(__dirname + "/minidlna.tmpl", "utf8", function (error, data) {
        if (error) {
            self.commandRouter.pushToastMessage("error", "miniDLNA", "Error reading " + __dirname + "minidlna.tmpl: " + error);
            defer.reject();
            return console.log("error: Error reading " + __dirname + "minidlna.tmpl: " + error);
        } else {
            for (var i = 1; i < configItem.length; i++) {
                switch (self.config.get(configItem[i])) {
                    case false:
                        value = "no";
                        break;
                    case true:
                        value = "yes";
                        break;
                    default:
                        value = self.config.get(configItem[i]);
                }
                data = data.replace("${" + configItem[i] + "}", value);
            }
            fs.writeFile("/etc/minidlna.conf", data, "utf8", function (error) {
                if (error) {
                    self.commandRouter.pushToastMessage("error", "miniDLNA", "Error writing /etc/minidlna.conf: " + error);
                    defer.reject();
                    return console.log("error: Error writing /etc/minidlna.conf: " + error);
                } else {
                    self.logger.info("/etc/minidlna.conf written");
                    defer.resolve();
                }
            });
        }
    });

    return defer.promise;
};

minidlna.prototype.systemctl = function (systemctlCmd, arg) {
    var self = this;
    var defer = libQ.defer();
    var cmd = "/usr/bin/sudo /bin/systemctl " + systemctlCmd + " " + arg;

    exec(cmd, {uid:1000, gid:1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.error("Failed to " + systemctlCmd + " " + arg + ": " + error);
            self.commandRouter.pushToastMessage("error", "miniDLNA", "Failed to " + systemctlCmd + " " + arg + ": " + error);
            defer.reject();
        } else {
            self.logger.info(systemctlCmd + " of " + arg + " succeeded.");
            defer.resolve();
        }
    });

    return defer.promise;
};

minidlna.prototype.forceRescan = function () {
    var self = this;
    var defer = libQ.defer();

    exec("/usr/bin/minidlnad -R", {uid:1000, gid:1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.error("Failed to rescan the media directories: " + error);
            self.commandRouter.pushToastMessage("error", "miniDLNA", "Failed to rescan the media directories: " + error);
            defer.reject();
        } else {
            self.logger.info("Rescanning the media directories.");
            self.commandRouter.pushToastMessage("info", "miniDLNA", "Rescanning the media directories.");
            defer.resolve();
        }
    });

    return defer.promise;
};
