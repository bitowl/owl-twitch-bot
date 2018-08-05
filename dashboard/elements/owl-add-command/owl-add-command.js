(function () {
    'use strict';

    const botCommands = nodecg.Replicant('commands');

    class OwlAddCommand extends Polymer.Element {
        static get is() {
            return 'owl-add-command';
        }

        ready() {
            super.ready();
            
            this.cancelEditing();

            nodecg.listenFor('edit', value => {
                this.isEditMode = true;
                this.command = value.command;
                this.response = value.response;
                this.oldCommand = value.command;
            })
        }

        addCommand() {
            if (this.command.length === undefined || this.response.length == 0) {return;}
            botCommands.value[this.command] = this.response;
            this.cancelEditing();
        }

        editCommand() {
            if (this.command.length == 0 || this.response.length == 0) {return;}
            if (this.oldCommand !== null && this.oldCommand != this.command) {
                // The command was actually changed, delete the old command
                botCommands.value[this.oldCommand] = undefined;
            }

            botCommands.value[this.command] = this.response;

            this.cancelEditing();
        }
        cancelEditing() {
            this.command = '';
            this.response = '';
            this.isEditMode = false;
            this.oldCommand = null;
        }
    }
    customElements.define(OwlAddCommand.is, OwlAddCommand);
})();