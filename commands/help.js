const { trySendMessage } = require('../utils');

module.exports = {
	name: 'help',
	help: '!help - List all commands or get info about a specific command.',
	tags: ['general'],
	async execute(bancho, message, args) {
		for (let i = 0; i < bancho.commands.length; i++) {
			if (bancho.commands[i].help) {
				await trySendMessage(message.user, bancho.commands[i].help);
			} else {
				await trySendMessage(message.user, `The stupid dev forgot to add a help message for ${bancho.commands[i].name}. Sorry about that!`);
			}
		}
	},
};