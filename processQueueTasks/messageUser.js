module.exports = {
	async execute(bancho, processQueueEntry) {
		let args = processQueueEntry.additions.split(';');

		const IRCUser = bancho.getUserById(args[0]);

		IRCUser.sendMessage(args[1]);

		processQueueEntry.destroy();
	},
};