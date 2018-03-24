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

    const botCommands = nodecg.Replicant('commands', {
        defaultValue: {}
    });

    
    Bot.on('join', () => {
        nodecg.log.info('Joined channel #' + nodecg.bundleConfig.channel);
        Bot.on('message', chatter => {

            // Reply to bot commands
            if (botCommands.value[chatter.message] !== undefined) {
                Bot.say(botCommands.value[chatter.message]);
                return;
            }

            emitter.emit('message', chatter);
        });
    });
    
    Bot.on('error', err => {
        nodecg.log.error(err);
    });

    return emitter;
}