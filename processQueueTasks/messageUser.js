const { trySendMessage } = require("../utils");

module.exports = {
	async execute(bancho, processQueueEntry) {
		let args = processQueueEntry.additions.split(';');

		const IRCUser = await bancho.getUserById(args[0]);

		trySendMessage(IRCUser, args[1]);

		processQueueEntry.destroy();
	},
};