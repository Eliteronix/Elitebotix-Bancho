const osuDuel = require('../matches/osu-duel.js');

module.exports = {
	async execute(bancho, processQueueEntry) {
		let settings = JSON.parse(processQueueEntry.additions);

		console.log(settings);

		osuDuel.execute(bancho, settings.interaction, settings.averageStarRating, settings.lowerBound, settings.upperBound, settings.bestOf, settings.onlyRanked, settings.users, settings.queued);

		processQueueEntry.destroy();
	},
};