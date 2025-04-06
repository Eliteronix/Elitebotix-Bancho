const autohost = require('../matches/autohost.js');

module.exports = {
	async execute(bancho, processQueueEntry) {
		let args = processQueueEntry.additions.split(';');

		autohost.execute(bancho, args[0], JSON.parse(args[1]));

		processQueueEntry.destroy();
	},
};