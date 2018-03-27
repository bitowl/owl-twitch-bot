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

            nodecg.listenFor('delete-command', () => {
                this.deleteCommand();
            });
        }

        editCommand(event) {
            nodecg.sendMessage('edit', event.model.item);
        }

        confirmDeleteCommand(event) {
            this.commandToDelete = event.model.item.command
            nodecg.getDialog('delete-command').open();
        }
        deleteCommand() {
            botCommands.value[this.commandToDelete] = undefined;
            // TODO: fix error message: "trap returned falsish for property '!test2'"
        }

    }
    customElements.define(OwlBotCommands.is, OwlBotCommands);
})();