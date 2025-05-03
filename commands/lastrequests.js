const { trySendMessage } = require('../utils');

module.exports = {
	name: 'lastrequests',
	help: '!lastrequests - Shows the last 5 twitch requests again',
	tag: 'general',
	async execute(bancho, message) {
		let userRequests = [];

		for (let i = 0; i < bancho.sentRequests.length; i++) {
			if (bancho.sentRequests[i].osuUserId == message.user.id) {
				userRequests.push(bancho.sentRequests[i]);
			}
		}

		if (userRequests.length === 0) {
			return await trySendMessage(message.user, 'You have no requests since the last Elitebotix restart.');
		}

		//Remove everything but the last 5 requests
		while (userRequests.length > 5) {
			userRequests.shift();
		}

		//Resend the messages
		await trySendMessage(message.user, `Here are your last ${userRequests.length} twitch requests:`);
		for (let i = 0; i < userRequests.length; i++) {
			await trySendMessage(message.user, userRequests[i].main);
			if (userRequests[i].comment) {
				await trySendMessage(message.user, userRequests[i].comment);
			}
		}
	},
};