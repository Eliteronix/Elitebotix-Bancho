const { trySendMessage, updateUniqueOsuUsers } = require('../utils');

module.exports = {
	async execute(bancho, processQueueEntry) {
		let args = processQueueEntry.additions.split(';');

		updateUniqueOsuUsers(args[0]);

		const IRCUser = await bancho.getUserById(args[0]);

		trySendMessage(IRCUser, args[1]);

		processQueueEntry.destroy();
	},
};