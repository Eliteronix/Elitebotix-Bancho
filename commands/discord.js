const { trySendMessage } = require('../utils');

module.exports = {
	name: 'discord',
	help: '!discord - Sends a link to the main Elitebotix discord',
	tag: 'general',
	async execute(bancho, message) {
		await trySendMessage(message.user, 'Feel free to join the [https://discord.gg/Asz5Gfe Discord]');
	},
};