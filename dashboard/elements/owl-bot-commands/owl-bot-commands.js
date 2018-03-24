(function () {
    'use strict';

    const botCommands = nodecg.Replicant('commands');

    class OwlBotCommands extends Polymer.Element {
        static get is() {
            return 'owl-bot-commands';
        }

        ready() {
            super.ready();
            botCommands.on('change', value => {
                this.commands = [];
                for (var command in value) {
                    if (value[command] === undefined) {
                        // This command was just deleted
                        continue;
                    }
                    this.push('commands', {
                        command: command,
                        response: value[command]
                    });
                }
            })
        }

        editCommand(event) {
            nodecg.sendMessage('edit', event.model.item);
        }

        deleteCommand(event) {
            // TODO: confirm wether deletion is wanted
            botCommands.value[event.model.item.command] = undefined;
            // TODO: fix error message: "trap returned falsish for property '!test2'"
        }

    }
    customElements.define(OwlBotCommands.is, OwlBotCommands);
})();