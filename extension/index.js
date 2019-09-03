'use strict';

// Const TwitchBot = require('twitch-bot');
const EventEmitter = require('events');

module.exports = function (nodecg) {
	const emitter = new EventEmitter();

	const botCommands = nodecg.Replicant('commands', {
		defaultValue: {}
	});

	const viewers = nodecg.Replicant('viewers', {
		defaultValue: [],
		persistent: false
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

	client.on('join', (channel, username, self) => {
		viewers.value.push(username);
		console.log('join', username);
	});

	client.on('part', (channel, username, self) => {
		viewers.value.splice(viewers.indexOf(username), 1);
		console.log('part', username);
	});

	client.on('chat', (channel, userstate, message, self) => {
		if (self) {
			// ignore our own messages
			return;
		}

		// Reply to bot commands
		if (['!music', '!np', '!nowplaying', '!song', '!currentlyplaying'].includes(message)) {
			const mpcReplicant = nodecg.Replicant('mpc', 'owl-mpc');
			client.say(channel, 'Currently playing: ' + mpcReplicant.value.artist + ' - ' + mpcReplicant.value.title);
			return;
		}

		if (['!cmds', '!commands'].includes(message)) {
			let cmds = Object.keys(botCommands.value);
			// Remove aliases
			for (const cmd of cmds) {
				if (botCommands.value[cmd].startsWith('!')) {
					cmds.splice(cmds.indexOf(cmd), 1);
				}
			}

			// Add commands defined in code
			cmds = cmds.concat(['!music']);

			cmds.sort();
			client.say(channel, 'Commands: ' + cmds.join(', '));
			return;
		}

		if (message.startsWith('!addcmd ')) {
			if (userstate.mod !== true) {
				return; // Only for mods
			}

			const secondSpace = message.indexOf(' ', 8);
			const cmd = message.substring(8, secondSpace);
			const text = message.substring(secondSpace + 1);

			if (botCommands.value[cmd] !== undefined) {
				client.say(channel, `@${userstate.username} Command ${cmd} already exists.`);
				return;
			}

			botCommands.value[cmd] = text;

			client.say(channel, `@${userstate.username} Added command ${cmd}.`);

			return;
		}

		if (message.startsWith('!delcmd ')) {
			if (userstate.mod !== true) {
				return; // Only for mods
			}

			const cmd = message.substring(8);

			if (botCommands.value[cmd] === undefined) {
				client.say(channel, `@${userstate.username} Command ${cmd} does not exist.`);
				return;
			}

			botCommands.value[cmd] = undefined;

			client.say(channel, `@${userstate.username} Deleted command ${cmd}.`);

			return;
		}

		if (message.startsWith('!editcmd ')) {
			if (userstate.mod !== true) {
				return; // Only for mods
			}

			const secondSpace = message.indexOf(' ', 9);
			const cmd = message.substring(9, secondSpace);
			const text = message.substring(secondSpace + 1);

			botCommands.value[cmd] = text;

			client.say(channel, `@${userstate.username} Edited command ${cmd}.`);

			return;
		}

		if (message.startsWith('!movecmd ')) {
			if (userstate.mod !== true) {
				return; // Only for mods
			}

			const secondSpace = message.indexOf(' ', 9);
			const oldCmd = message.substring(9, secondSpace);
			const newCmd = message.substring(secondSpace + 1);

			if (botCommands.value[oldCmd] === undefined) {
				client.say(channel, `@${userstate.username} Command ${oldCmd} does not exist.`);
				return;
			}

			if (botCommands.value[newCmd] !== undefined) {
				client.say(channel, `@${userstate.username} Command ${newCmd} already exists.`);
				return;
			}

			botCommands.value[newCmd] = botCommands.value[oldCmd];
			botCommands.value[oldCmd] = undefined;

			client.say(channel, `@${userstate.username} Renamed command ${oldCmd} to ${newCmd}.`);

			return;
		}

		const firstSpace = message.indexOf(' ');
		const cmd = firstSpace < 0 ? message : message.substring(0, firstSpace);

		if (botCommands.value[cmd] !== undefined) {
			let replacement = botCommands.value[cmd];

			// Handle aliases
			while (replacement.startsWith('!')) {
				if (botCommands.value[replacement] === undefined) {
					break;
				}

				replacement = botCommands.value[replacement];
			}

			// Handle parameters
			if (replacement.includes('$')) {
				replacement = replacement.replace(new RegExp('\\$u', 'g'), '@' + userstate.username);
				const parts = message.split(' ');

				for (let i = 0; i < parts.length; i++) {
					replacement = replacement.replace(new RegExp('\\$' + i, 'g'), parts[i]);
				}

				parts.splice(0, 1);
				replacement = replacement.replace(new RegExp('\\$@', 'g'), parts.join(' '));
			}

			client.say(channel, replacement);
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
