module.exports = {
	async execute(bancho, processQueueEntry) {
		let args = processQueueEntry.additions.split(';');

		bancho.twitchClient.join(args[0]);

		processQueueEntry.destroy();
	},
};