'use strict';

const TwitchBot = require('twitch-bot');
const EventEmitter = require('events');

module.exports = function (nodecg) {
	const emitter = new EventEmitter();

	const botCommands = nodecg.Replicant('commands', {
		defaultValue: {}
	});

	const options = {
		options: {
			debug: true
		},
		connection: {
			reconnect: true
		},
		identity: {
			username: nodecg.bundleConfig.bot_username,
			password: nodecg.bundleConfig.bot_oauth
		},
		channels: [nodecg.bundleConfig.channel]
	};

	const tmi = require('tmi.js');
	// eslint-disable-next-line new-cap
	const client = new tmi.client(options);
	client.connect();
	client.on('chat', (channel, userstate, message) => {
		// Reply to bot commands
		if (message === '!music' ||
			message === '!np' ||
			message === '!nowplaying' ||
			message === '!song' ||
			message === '!currentlyplaying'
		) {
			const mpcReplicant = nodecg.Replicant('mpc', 'owl-mpc');
			client.say(channel, 'Currently playing: ' + mpcReplicant.value.artist + ' - ' + mpcReplicant.value.title);
		}

		if (botCommands.value[message] !== undefined) {
			client.say(channel, botCommands.value[message]);
			return;
		}

		const result = userstate;
		// Bring into format of twitch-bot
		result.message = message;
		result.emotes = userstate['emotes-raw'];
		// eslint-disable-next-line camelcase
		result.display_name = userstate['display-name'];

		emitter.emit('message', result);
	});

	/*
		Const Bot = new TwitchBot({
			username: nodecg.bundleConfig.bot_username,
			oauth: nodecg.bundleConfig.bot_oauth,
			channels: [nodecg.bundleConfig.channel]
		});

		process.on('uncaughtException', (err) => {
			console.log(err);
		});

		setInterval(() => {
			console.log('ping');
			Bot.irc.write('PING botowl\r\n');
		}, 5 * 60 * 1000);

		Bot.on('join', () => {
			nodecg.log.info('Joined channel #' + nodecg.bundleConfig.channel);
			Bot.on('message', chatter => {
				// Reply to bot commands
				if (chatter.message === '!music' ||
					chatter.message === '!np' ||
					chatter.message === '!nowplaying' ||
					chatter.message === '!song' ||
					chatter.message === '!currentlyplaying'
				) {
					const mpcReplicant = nodecg.Replicant('mpc', 'owl-mpc');
					Bot.say('Currently playing: ' + mpcReplicant.value.artist + ' - ' + mpcReplicant.value.title);
				}

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
	*/
	return emitter;
};
