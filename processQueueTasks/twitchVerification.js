module.exports = {
	async execute(bancho, processQueueEntry) {
		let twitchName = processQueueEntry.additions;

		twitchClient = bancho.twitchClient;
		if (!twitchClient) {
			console.error('Twitch client not connected, cannot verify Twitch account.');
			processQueueEntry.destroy();
			return;
		}

		// Send message to Twitch chat
		try {
			await twitchClient.say(twitchName, 'Your connection has been verified.');
		} catch (error) {
			console.error('Error sending verification message:', error);
			processQueueEntry.destroy();
			return;
		}

		processQueueEntry.destroy();
	},
};