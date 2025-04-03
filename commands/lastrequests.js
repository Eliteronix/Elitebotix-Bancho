module.exports = {
	name: 'lastrequests',
	help: '!lastrequests - Shows the last 5 twitch requests again',
	async execute(bancho, message, args) {
		let userRequests = [];

		for (let i = 0; i < bancho.sentRequests.length; i++) {
			if (bancho.sentRequests[i].osuUserId == message.user.id) {
				userRequests.push(bancho.sentRequests[i]);
			}
		}

		if (userRequests.length === 0) {
			return message.user.sendMessage('You have no requests since the last Elitebotix restart.');
		}

		//Remove everything but the last 5 requests
		while (userRequests.length > 5) {
			userRequests.shift();
		}

		//Resend the messages
		await message.user.sendMessage(`Here are your last ${userRequests.length} twitch requests:`);
		for (let i = 0; i < userRequests.length; i++) {
			await message.user.sendMessage(userRequests[i].main);
			if (userRequests[i].comment) {
				await message.user.sendMessage(userRequests[i].comment);
			}
		}
	},
};