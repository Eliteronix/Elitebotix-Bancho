const { trySendMessage, restartIfPossible } = require('../utils');

module.exports = {
	name: 'restart',
	help: '!restart [force] - Restarts the bot',
	tag: 'admin',
	async execute(bancho, message, args) {
		// eslint-disable-next-line no-console
		console.log('Duels', bancho.duels);
		// eslint-disable-next-line no-console
		console.log('Autohosts', bancho.autoHosts);
		// eslint-disable-next-line no-console
		console.log('TourneyMatchReferees', bancho.tourneyMatchReferees);
		// eslint-disable-next-line no-console
		console.log('KnockoutLobbies', bancho.knockoutLobbies);

		if (args[0] && args[0].toLowerCase() === 'force') {
			await trySendMessage(message.user, 'Restarting bot...');
			process.exit(0);
		} else {
			await trySendMessage(message.user, 'Restarting bot when possible...');
			bancho.update = 1;
			restartIfPossible(bancho);
		}
	},
};