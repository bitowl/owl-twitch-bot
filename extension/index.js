'use strict';

// Const TwitchBot = require('twitch-bot');
const EventEmitter = require('events');
const { isURL } = require('validator');

module.exports = function (nodecg) {
  const emitter = new EventEmitter();

  const botCommands = nodecg.Replicant('commands', {
    defaultValue: {}
  }

  );

  const viewers = nodecg.Replicant('viewers', {
    defaultValue: [],
    persistent: false
  }

  );

  const options = {
    options: {
      // Debug: true
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
    if (self) {
      nodecg.log.info('Joined channel ' + channel);
      return;
    }

    if (nodecg.bundleConfig.ignoredUsers.includes(username)) {
      return;
    }

    viewers.value.push(username);
    viewers.value.sort();
  }

  );

  client.on('part', (channel, username, self) => {
    if (self) {
      nodecg.log.info('Left channel ' + channel);
      return;
    }

    if (nodecg.bundleConfig.ignoredUsers.includes(username)) {
      return;
    }

    const index = viewers.value.indexOf(username);

    if (index >= 0) {
      viewers.value.splice(index, 1);
    }

    console.log('part', username);
  }

  );

  client.on('chat', (channel, userstate, message, self) => {
    if (self) {
      // ignore our own messages
      return;
    }

    const chatter = {
      channel, userstate, message, self
    }

      ;

    // Should this message be emitted, so that other bundles (e.g. owl-twitch-chat) can use it?
    let forwardToOtherBundles = true;

    if (deleteLinks(chatter)) {
      // If there was a unpermitted link in a command, don't even handle the command, as the bot might repeat the link
      return;
    }

    if (handleCommands(chatter)) {
      forwardToOtherBundles = false;
    }

    const result = userstate;
    // Bring into format of twitch-bot
    result.message = message;
    result.emotes = userstate['emotes-raw'];
    // eslint-disable-next-line camelcase
    result.display_name = userstate['display-name'];

    emitter.emit('message', result);
  }

  );

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
  function deleteLinks(chatter) {
    if (containsLink(chatter.message)) {
      client.deletemessage(chatter.channel, chatter.userstate.id);

      client.say(chatter.channel, `@${chatter.userstate.username} It's dangerous to send out links. Please ask kindly before you do.`);
      return true;
    }

    return false;
  }

  function containsLink(message) {
    return isURL(message);
  }

  const buildinCommands = {

    // Ask for currently playing music
    '!music': {
      exec: chatter => {
        const mpcReplicant = nodecg.Replicant('mpc', 'owl-mpc');
        client.say(chatter.channel,
          'Currently playing: ' + mpcReplicant.value.artist + ' - ' + mpcReplicant.value.title);
      }
    },
    '!np': { alias: '!music' },
    '!nowplaying': { alias: '!music' },
    '!song': { alias: '!music' },
    '!currentlyplaying': { alias: '!music' },

    // Help
    '!help': {
      exec: chatter => {
        let cmds = Object.keys(botCommands.value);
        console.log(cmds);

        // Remove aliases
        for (let i = cmds.length - 1; i >= 0; i--) {
          const cmd = cmds[i];
          console.log(cmd);
          console.log(botCommands.value[cmd]);

          if (botCommands.value[cmd] === undefined || botCommands.value[cmd].startsWith('!')) {
            cmds.splice(i, 1);
          }
        }

        // Add commands defined in code
        cmds = cmds.concat(['!music']);

        cmds.sort();
        client.say(chatter.channel, 'Available commands: ' + cmds.join(', '));
      }
    },
    '!cmds': { alias: '!help' },
    '!commands': { alias: '!help' },

    // Managing commands
    '!addcmd': {
      needsMod: true,
      exec: (chatter, args) => {
        const secondSpace = args.indexOf(' ');
        const cmd = args.substring(0, secondSpace);
        const text = args.substring(secondSpace + 1);

        if (botCommands.value[cmd] !== undefined) {
          client.say(chatter.channel, `@${chatter.userstate.username} Command ${cmd} already exists.`);
          return;
        }

        botCommands.value[cmd] = text;

        client.say(chatter.channel, `@${chatter.userstate.username} Added command ${cmd}.`);
      }
    },
    '!delcmd': {
      needsMod: true,
      exec: (chatter, args) => {
        const cmd = args;

        if (botCommands.value[cmd] === undefined) {
          client.say(chatter.channel, `@${chatter.userstate.username} Command ${cmd} does not exist.`);
          return;
        }

        botCommands.value[cmd] = undefined;

        client.say(chatter.channel, `@${chatter.userstate.username} Deleted command ${cmd}.`);
      }
    },
    '!editcmd': {
      needsMod: true,
      exec: (chatter, args) => {
        const secondSpace = args.indexOf(' ');
        const cmd = args.substring(0, secondSpace);
        const text = args.substring(secondSpace + 1);

        botCommands.value[cmd] = text;

        client.say(chatter.channel, `@${chatter.userstate.username} Edited command ${cmd}.`);
      }
    },
    '!movecmd': {
      needsMod: true,
      exec: (chatter, args) => {
        const secondSpace = args.indexOf(' ');
        const oldCmd = args.substring(0, secondSpace);
        const newCmd = args.substring(secondSpace + 1);

        if (botCommands.value[oldCmd] === undefined) {
          client.say(chatter.channel, `@${chatter.userstate.username} Command ${oldCmd} does not exist.`);
          return;
        }

        if (botCommands.value[newCmd] !== undefined) {
          client.say(chatter.channel, `@${chatter.userstate.username} Command ${newCmd} already exists.`);
          return;
        }

        botCommands.value[newCmd] = botCommands.value[oldCmd];
        botCommands.value[oldCmd] = undefined;

        client.say(chatter.channel, `@${chatter.userstate.username} Renamed command ${oldCmd} to ${newCmd}.`);
      }
    },

    '!js': {
      exec: (chatter, args) => {
        try {
          const result = eval(args);
          client.say(chatter.channel, `@${chatter.userstate.username} ${result}`);
        } catch (error) {
          client.say(chatter.channel, `@${chatter.userstate.username} ERROR: ${error}`);
        }
      }
    }
  };

  function handleCommands(chatter) {
    const firstSpace = chatter.message.indexOf(' ');
    const cmd = firstSpace >= 0 ? chatter.message.substring(0, firstSpace) : chatter.message;
    const args = firstSpace >= 0 ? chatter.message.substring(firstSpace + 1) : '';

    // Handle buildin commands
    if (Object.prototype.hasOwnProperty.call(buildinCommands, cmd)) {
      let toExecute = buildinCommands[cmd];
      while (toExecute.alias !== undefined) {
        // Alias
        toExecute = buildinCommands[toExecute.alias];
      }

      if (toExecute.needsMod && !isMod(chatter.userstate)) {
        // This user is not allowed to execute this command
        return false;
      }

      // TODO test that toExecute.exec is a function?
      toExecute.exec(chatter, args, cmd);
      return true;
    }

    if (botCommands.value[cmd] !== undefined) {
      let replacement = botCommands.value[cmd];

      // Handle aliases
      let aliasCount = 0;

      while (replacement.startsWith('!')) {
        if (botCommands.value[replacement] === undefined) {
          break;
        }

        if (aliasCount > 5) {
          replacement = `Are we recursing too deep in aliases for ${replacement}?`;
          break;
        }

        replacement = botCommands.value[replacement];
        aliasCount++;
      }

      // Handle parameters
      if (replacement.includes('$')) {
        replacement = replacement.replace(new RegExp('\\$u', 'g'),
          '@' + chatter.userstate.username);
        const parts = chatter.message.split(' ');

        for (let i = 0; i < parts.length; i++) {
          replacement = replacement.replace(new RegExp('\\$' + i, 'g'),
            parts[i]);
        }

        parts.splice(0, 1);
        replacement = replacement.replace(new RegExp('\\$@', 'g'),
          parts.join(' '));
      }

      client.say(chatter.channel, replacement);
      return true;
    }

    return false;
  }

  function isMod(userstate) {
    return userstate.mod || userstate.username === nodecg.bundleConfig.channel;
  }

  return emitter;
};

