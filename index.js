'use strict';

var libQ = require('kew');
const AWS = require('aws-sdk')
const Stream = require('stream')
const Speaker = require('speaker')
var exec = require('child_process').exec;

module.exports = text_to_speech;

function text_to_speech(context) {

    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    this.playlistManager = this.context.playlistManager;
}

text_to_speech.prototype.onVolumioStart = function () {
    var self = this;
    self.config = new (require('v-conf'))();
    var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
    self.config.loadFile(configFile);

    return libQ.resolve();
};

text_to_speech.prototype.onStart = function () {
    var self = this;

    self.websocketPlugin = this.commandRouter.pluginManager.getPlugin('user_interface', 'websocket');
    self.websocketPlugin.libSocketIO.on('connection', function (connWebSocket) {
        connWebSocket.on('tts-say', function (data) {
            // TODO: type ssml
            // TODO: queue sentences
            if (data.text) {
                var pauseAndResume = self.config.data.pauseWhenTalking.value && self.commandRouter.volumioGetState().status === 'play';

                self.speak(data.text, function () {
                    if (pauseAndResume) {
                        self.commandRouter.volumioPause.bind(self.commandRouter)();
                    }
                }, function () {
                    if (pauseAndResume) {
                        self.commandRouter.volumioPlay.bind(self.commandRouter)();
                    }
                });
            }
        });
        connWebSocket.on('tts-announce', function () {
            self.announceTrack(self.commandRouter.volumioGetState(), self.config.data.pauseWhenTalking.value);
        });
    });

    self.commandRouter.addCallback("volumioPushState", function (state) {
        if (self.config.data.announcer.value) {
            var announcement = self.generateAnnouncement(state);
            if (state.status === "play" && self.lastAnnouncement !== announcement) {
                self.speak(announcement);
                self.lastAnnouncement = announcement;
            }
        }
    });

    self.Polly = new AWS.Polly({
        accessKeyId: self.config.data.accessKeyId.value,
        secretAccessKey: self.config.data.secretAccessKey.value,
        signatureVersion: 'v4',
        region: 'eu-west-1'
    });

    return libQ.resolve();
}

text_to_speech.prototype.getConfigurationFiles = function() {
  var self = this;

  return ['config.json'];
};

text_to_speech.prototype.onStop = function () {
    var self = this;
    //Perform stop tasks here
    return libQ.resolve();
};

text_to_speech.prototype.onRestart = function () {
    var self = this;
    //Perform restart tasks here
};

text_to_speech.prototype.onInstall = function () {
    var self = this;
    //Perform your installation tasks here
};

text_to_speech.prototype.onUninstall = function () {
    var self = this;
    //Perform your deinstallation tasks here
};

text_to_speech.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
    .then(function(uiconf)
    {
        uiconf.sections[0].content[0].value = self.config.get('accessKeyId');
        uiconf.sections[0].content[1].value = self.config.get('secretAccessKey');
        uiconf.sections[0].content[2].value = self.config.get('voice');
        uiconf.sections[0].content[3].value = self.config.get('pauseWhenTalking');
        uiconf.sections[0].content[4].value = self.config.get('announcer');
        defer.resolve(uiconf);
    })
    .fail(function()
    {
        defer.reject(new Error());
    });

    return defer.promise;
};

text_to_speech.prototype.setUIConfig = function (data) {
    var self = this;
    //Perform your UI configuration tasks here
};

text_to_speech.prototype.getConf = function (varName) {
    var self = this;
    //Perform your tasks to fetch config data here
};

text_to_speech.prototype.setConf = function (varName, varValue) {
    var self = this;
    //Perform your tasks to set config data here
};

//Optional functions exposed for making development easier and more clear
text_to_speech.prototype.getSystemConf = function (pluginName, varName) {
    var self = this;
    //Perform your tasks to fetch system config data here
};

text_to_speech.prototype.setSystemConf = function (pluginName, varName) {
    var self = this;
    //Perform your tasks to set system config data here
};

text_to_speech.prototype.getAdditionalConf = function () {
    var self = this;
    //Perform your tasks to fetch additional config data here
};

text_to_speech.prototype.setAdditionalConf = function () {
    var self = this;
    //Perform your tasks to set additional config data here
};

text_to_speech.prototype.savePluginOptions = function (data) {
    var self = this;

    var defer = libQ.defer();

    var credentialsChanged = self.config.data.accessKeyId.value !== data.accessKeyId.value || self.config.data.secretAccessKey.value !== data.secretAccessKey.value;

    self.config.set('accessKeyId', data.accessKeyId);
    self.config.set('secretAccessKey', data.secretAccessKey);
    self.config.set('voice', data.voice);
    self.config.set('pauseWhenTalking', data.pauseWhenTalking);
    self.config.set('announcer', data.announcer);

    self.logger.info('Text-to-speech configurations have been set');

    self.commandRouter.pushToastMessage('success', 'Text-to-speech', 'Configuration saved');

    if (credentialsChanged) {
        // reload Polly, in case credentials are changed
        self.Polly = new AWS.Polly({
            accessKeyId: self.config.data.accessKeyId.value,
            secretAccessKey: self.config.data.secretAccessKey.value,
            signatureVersion: 'v4',
            region: 'eu-west-1'
        });
    }

    defer.resolve({});

    return defer.promise;

};

text_to_speech.prototype.generateAnnouncement = function (state) {
    var announcement = '"' + state.title + '"';
    announcement += state.artist ? ' by "' + state.artist + '"' : ' by an unknown artist';
    if (state.album) {
        announcement += ' from the album "' + state.album + '"';
    }

    return announcement;
}

text_to_speech.prototype.announceTrack = function (state, pauseWhenTalking) {
    var self = this;

    var announcement = self.generateAnnouncement(state);
    var pauseAndResume = pauseWhenTalking && state.status === 'play';

    self.speak(announcement, function () {
        if (pauseAndResume) {
            self.commandRouter.volumioPause.bind(self.commandRouter)();
        }
    }, function () {
        if (pauseAndResume) {
            self.commandRouter.volumioPlay.bind(self.commandRouter)();
        }
    });
}

text_to_speech.prototype.speak = function (text, callbackReadyToSpeak, callbackDoneSpeaking) {
    var self = this;
    var params = {
        'Text': text,
        'OutputFormat': 'pcm',
        'VoiceId': self.config.data.voice.value || 'Kimberly',
        'SampleRate': '16000'
    };
    self.Polly.synthesizeSpeech(params, (err, data) => {
        if (err) {
            console.log(err.code)
        } else if (data) {
            callbackReadyToSpeak && callbackReadyToSpeak();
            if (data.AudioStream instanceof Buffer) {
                var speakerInstance = new Speaker({
                    channels: 1,
                    bitDepth: 16,
                    sampleRate: 16000
                });
                speakerInstance.on('close', function () {
                    callbackDoneSpeaking && callbackDoneSpeaking();
                });
                try {
                    // Initiate the source
                    var bufferStream = new Stream.PassThrough()
                    // convert AudioStream into a readable stream
                    bufferStream.end(data.AudioStream)
                    // Pipe into Player
                    bufferStream.pipe(speakerInstance)
                } catch(e) {
                    console.log('Error', e);
                    callbackDoneSpeaking && callbackDoneSpeaking();
                }
            }
        }
    });
}

/*process.on('uncaughtException', function (err) {
    console.log('UNCAUGHT EXCEPTION - keeping process alive:', err);
});*/