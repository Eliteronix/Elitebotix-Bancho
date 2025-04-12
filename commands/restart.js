const { trySendMessage, restartIfPossible } = require("../utils");

module.exports = {
	name: 'restart',
	help: '!restart [force] - Restarts the bot',
	tag: 'admin',
	async execute(bancho, message, args) {
		console.log('Duels', bancho.duels);
		console.log('Autohosts', bancho.autoHosts);
		console.log('TourneyMatchReferees', bancho.tourneyMatchReferees);

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