"use strict";

const EventEmitter = require("events");

module.exports = function (nodecg) {
  const emitter = new EventEmitter();

  const botCommands = nodecg.Replicant("commands", {
    defaultValue: {}
  });

  const viewers = nodecg.Replicant("viewers", {
    defaultValue: [],
    persistent: false
  });

  // Users that are allowed to post the next link
  const permittedUsers = nodecg.Replicant("permittedUsers", {
    defaultValue: [],
    persistent: false
  });

  // Users that are always allowed to post links
  const trustedUsers = nodecg.Replicant("trustedUsers", {
    defaultValue: [],
    persistent: true
  });

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
  const tmi = require("tmi.js");
  // eslint-disable-next-line new-cap
  const client = new tmi.client(options);
  client.connect();

  client.on("join", (channel, username, self) => {
    if (self) {
      nodecg.log.info("Joined channel " + channel);
      return;
    }

    if (nodecg.bundleConfig.ignoredUsers.includes(username)) {
      return;
    }

    viewers.value.push(username);
    viewers.value.sort();
  });

  client.on("part", (channel, username, self) => {
    if (self) {
      nodecg.log.info("Left channel " + channel);
      return;
    }

    if (nodecg.bundleConfig.ignoredUsers.includes(username)) {
      return;
    }

    const index = viewers.value.indexOf(username);

    if (index >= 0) {
      viewers.value.splice(index, 1);
    }
  });

  client.on("chat", (channel, userstate, message, self) => {
    if (self) {
      // ignore our own messages
      return;
    }

    const chatter = {
      channel,
      userstate,
      message,
      self
    };

    // Should this message be emitted, so that other bundles (e.g. owl-twitch-chat) can use it?
    let forwardToOtherBundles = true;
    let handleBotCommands = true;

    if (deleteLinks(chatter)) {
      // If there was a unpermitted link in a command, don't even handle the command, as the bot might repeat the link
      handleBotCommands = false;
    }

    if (handleBotCommands && handleCommands(chatter)) {
      forwardToOtherBundles = false;
    }

    if (forwardToOtherBundles) {
      const result = userstate;
      // Bring into format of twitch-bot
      result.message = message;
      result.emotes = userstate["emotes-raw"];
      // eslint-disable-next-line camelcase
      result.display_name = userstate["display-name"];

      emitter.emit("message", result);
    }
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
  function deleteLinks(chatter) {
    if (containsLink(chatter.message)) {
      if (isMod(chatter.userstate)) {
        return false;
      }

      if (permittedUsers.value.includes(chatter.userstate.username)) {
        // User was permitted to send this one link
        permittedUsers.value.splice(
          permittedUsers.value.indexOf(chatter.userstate.username),
          1
        );
        return false;
      }

      if (trustedUsers.value.includes(chatter.userstate.username)) {
        return false;
      }

      client.deletemessage(chatter.channel, chatter.userstate.id);

      client.say(
        chatter.channel,
        `@${chatter.userstate.username} It's dangerous to send links. Please ask a person with a sword before you do.`
      );
      return true;
    }

    return false;
  }

  // https://stackoverflow.com/a/5717133
  const linkRegex = RegExp(
    "((ft|htt)ps?:\\/\\/)?" + // Protocol
    "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // Domain name and extension
    "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
    "(\\:\\d+)?" + // Port
    "(\\/[-a-z\\d%@_.~+&:\\(\\)]*)*" + // Path
    "(\\?[;&a-z\\d%@_.,~+&:=-]*)?" + // Query string
    "(\\#[-a-z\\d_]*)?",
    "i"
  ); // Fragment locator
  function containsLink(message) {
    return linkRegex.test(message);
  }

  const buildinCommands = {
    // Ask for currently playing music
    "!music": {
      exec: chatter => {
        const mpcReplicant = nodecg.Replicant("mpc", "owl-mpc");
        client.say(
          chatter.channel,
          "Currently playing: " +
          mpcReplicant.value.artist +
          " - " +
          mpcReplicant.value.title
        );
      }
    },
    "!np": { alias: "!music" },
    "!nowplaying": { alias: "!music" },
    "!song": { alias: "!music" },
    "!currentlyplaying": { alias: "!music" },

    // Help
    "!help": {
      exec: chatter => {
        const cmds = Object.keys(botCommands.value);


        for (let i = cmds.length - 1; i >= 0; i--) {
          const cmd = cmds[i];

          if (!cmd.startsWith('!')) {
            // Only show commands starting with !
            cmds.splice(i, 1);
          } else
            // Remove aliases
            if (
              botCommands.value[cmd] === undefined ||
              botCommands.value[cmd].startsWith("!")
            ) {
              cmds.splice(i, 1);
            }
        }

        // Add commands defined in code
        const bldin = Object.keys(buildinCommands);

        for (let i = 0; i < bldin.length; i++) {
          const cmd = buildinCommands[bldin[i]];
          // Ignore aliases and mod-only commands
          if (cmd.alias) {
            continue;
          }

          if (cmd.needsMod) {
            continue;
          }

          cmds.push(bldin[i]);
        }

        cmds.sort();
        client.say(chatter.channel, "Available commands: " + cmds.join(", "));
      }
    },
    "!cmds": { alias: "!help" },
    "!commands": { alias: "!help" },

    // Managing commands
    "!addcmd": {
      needsMod: true,
      exec: (chatter, args) => {
        const secondSpace = args.indexOf(" ");
        const cmd = args.substring(0, secondSpace);
        const text = args.substring(secondSpace + 1);

        if (botCommands.value[cmd] !== undefined) {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} Command ${cmd} already exists.`
          );
          return;
        }

        botCommands.value[cmd] = text;

        client.say(
          chatter.channel,
          `@${chatter.userstate.username} Added command ${cmd}.`
        );
      }
    },
    "!delcmd": {
      needsMod: true,
      exec: (chatter, args) => {
        const cmd = args;

        if (botCommands.value[cmd] === undefined) {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} Command ${cmd} does not exist.`
          );
          return;
        }

        botCommands.value[cmd] = undefined;

        client.say(
          chatter.channel,
          `@${chatter.userstate.username} Deleted command ${cmd}.`
        );
      }
    },
    "!editcmd": {
      needsMod: true,
      exec: (chatter, args) => {
        const secondSpace = args.indexOf(" ");
        const cmd = args.substring(0, secondSpace);
        const text = args.substring(secondSpace + 1);

        botCommands.value[cmd] = text;

        client.say(
          chatter.channel,
          `@${chatter.userstate.username} Edited command ${cmd}.`
        );
      }
    },
    "!movecmd": {
      needsMod: true,
      exec: (chatter, args) => {
        const secondSpace = args.indexOf(" ");
        const oldCmd = args.substring(0, secondSpace);
        const newCmd = args.substring(secondSpace + 1);

        if (botCommands.value[oldCmd] === undefined) {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} Command ${oldCmd} does not exist.`
          );
          return;
        }

        if (botCommands.value[newCmd] !== undefined) {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} Command ${newCmd} already exists.`
          );
          return;
        }

        botCommands.value[newCmd] = botCommands.value[oldCmd];
        botCommands.value[oldCmd] = undefined;

        client.say(
          chatter.channel,
          `@${chatter.userstate.username} Renamed command ${oldCmd} to ${newCmd}.`
        );
      }
    },

    // Permit users
    "!permit": {
      needsMod: true,
      exec: (chatter, args) => {
        const user = getUser(args);
        if (
          permittedUsers.value.includes(user) ||
          trustedUsers.value.includes(user)
        ) {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} ${user} is already allowed to send links.`
          );
          return;
        }

        permittedUsers.value.push(user);
        client.say(chatter.channel, `@${user} is allowed to send one link.`);
      }
    },
    "!trust": {
      needsMod: true,
      exec: (chatter, args) => {
        const user = getUser(args);
        if (trustedUsers.value.includes(user)) {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} ${user} is already allowed to permanently send links.`
          );
          return;
        }

        trustedUsers.value.push(user);
        client.say(chatter.channel, `@${user} is allowed to now send links.`);
      }
    },
    "!untrust": {
      needsMod: true,
      exec: (chatter, args) => {
        const user = getUser(args);
        if (
          !trustedUsers.value.includes(user) &&
          !permittedUsers.value.includes(user)
        ) {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} ${user} is already not allowed to send links.`
          );
          return;
        }

        const permittedIndex = permittedUsers.value.indexOf(user);
        if (permittedIndex >= 0) {
          permittedUsers.value.splice(permittedIndex, 1);
        }

        const trustedIndex = trustedUsers.value.indexOf(user);
        if (trustedIndex >= 0) {
          trustedUsers.value.splice(trustedIndex, 1);
        }

        client.say(
          chatter.channel,
          `@${chatter.userstate.username} ${user} can no longer send links.`
        );
      }
    },

    // Everyone cares about time
    "!localtime": {
      exec: chatter => {
        const date = new Date();
        function l0(num) {
          if (num < 10) {
            return "0" + num;
          }

          return num;
        }

        const time = l0(date.getHours()) + ":" + l0(date.getMinutes());
        client.say(
          chatter.channel,
          `@${chatter.userstate.username} The current time here is ${time}.`
        );
      }
    },
    "!uptime": {
      exec: chatter => {
        const streamStart = nodecg.readReplicant("start", "owl-twitch-info");
        if (typeof streamStart !== "string") {
          client.say(
            chatter.channel,
            `@${chatter.userstate.username} Cannot determine uptime right now.`
          );
          return;
        }

        const startDate = Date.parse(streamStart);
        const difference = new Date() - startDate;
        // https://stackoverflow.com/a/37096512
        function secondsToHms(d) {
          d = Number(d);
          const h = Math.floor(d / 3600);
          const m = Math.floor((d % 3600) / 60);
          const s = Math.floor((d % 3600) % 60);

          const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
          const mDisplay =
            m > 0 ? m + (m === 1 ? " minute and " : " minutes and ") : "";
          const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
          return hDisplay + mDisplay + sDisplay;
        }

        const time = secondsToHms(difference / 1000);

        client.say(
          chatter.channel,
          `@${chatter.userstate.username} The stream has been online for ${time}.`
        );
      }
    }
  };

  function handleCommands(chatter) {
    const firstSpace = chatter.message.indexOf(" ");
    const cmd =
      firstSpace >= 0
        ? chatter.message.substring(0, firstSpace)
        : chatter.message;
    const args =
      firstSpace >= 0 ? chatter.message.substring(firstSpace + 1) : "";

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

      while (replacement.startsWith("!") || replacement.startsWith('#')) {
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
      if (replacement.includes("$")) {
        replacement = replacement.replace(
          new RegExp("\\$u", "g"),
          "@" + chatter.userstate.username
        );
        const parts = chatter.message.split(" ");

        for (let i = 0; i < parts.length; i++) {
          replacement = replacement.replace(
            new RegExp("\\$" + i, "g"),
            parts[i]
          );
        }

        parts.splice(0, 1);
        replacement = replacement.replace(
          new RegExp("\\$@", "g"),
          parts.join(" ")
        );
      }

      client.say(chatter.channel, replacement);
      return true;
    }

    return false;
  }

  function isMod(userstate) {
    return userstate.mod || userstate.username === nodecg.bundleConfig.channel;
  }

  function getUser(args) {
    if (args.startsWith("@")) {
      return args.substring(1);
    }

    return args;
  }

  return emitter;
};
