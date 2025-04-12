const tourneyMatchReferee = require('../matches/tourneyMatchReferee.js');

module.exports = {
	async execute(bancho, processQueueEntry) {
		tourneyMatchReferee.execute(bancho, processQueueEntry);

		processQueueEntry.destroy();
	},
};