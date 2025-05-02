const knockoutLobby = require('../matches/knockoutLobby.js');

module.exports = {
	async execute(bancho, processQueueEntry) {
		let settings = JSON.parse(processQueueEntry.additions);

		knockoutLobby.execute(bancho, settings.interaction, settings.mappool, settings.players, settings.users, settings.scoreversion);

		processQueueEntry.destroy();
	},
};