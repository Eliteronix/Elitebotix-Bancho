const { trySendMessage } = require('../utils');
const { developers } = require('../config.json');

module.exports = {
	name: 'help',
	help: '!help - List all commands or get info about a specific command.',
	tag: 'general',
	async execute(bancho, message) {
		for (let i = 0; i < bancho.commands.length; i++) {
			if (bancho.commands[i].name === 'help') continue; // Skip the help command itself

			let tags = ['general'];

			if (developers.includes(message.user.id)) {
				tags.push('admin');
			}

			if (!tags.includes(bancho.commands[i].tag)) continue; // Skip commands that are not for the user

			if (bancho.commands[i].help) {
				await trySendMessage(message.user, bancho.commands[i].help);
			} else {
				await trySendMessage(message.user, `The stupid dev forgot to add a help message for ${bancho.commands[i].name}. Sorry about that!`);
			}
		}
	},
};