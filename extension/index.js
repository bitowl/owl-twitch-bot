'use strict';

const TwitchBot = require('twitch-bot');
const EventEmitter = require('events');


module.exports = function (nodecg) {
    const emitter = new EventEmitter();

    const Bot = new TwitchBot({
        username: nodecg.bundleConfig.bot_username,
        oauth: nodecg.bundleConfig.bot_oauth,
        channels: [nodecg.bundleConfig.channel]
    });
    
    Bot.on('join', () => {
        nodecg.log.info('Joined channel #' + nodecg.bundleConfig.channel);
        Bot.on('message', chatter => {
            if(chatter.message === '!test') {
                Bot.say('Test successful :3');
                return;
            }
            if (chatter.message === '!trello') {
                Bot.say('Trello board for the stream overlay: https://trello.com/b/XrA7gWtC');
                return;
            }

            nodecg.log.info('Send message');
            emitter.emit('message', chatter);
        });
    });
    
    Bot.on('error', err => {
        nodecg.log.error(err);
    });

    return emitter;
}