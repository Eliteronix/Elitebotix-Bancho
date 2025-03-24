module.exports = {
	name: 'discord',
	help: '!discord - Sends a link to the main Elitebotix discord',
	async execute(bancho, message, args) {
		message.user.sendMessage('Feel free to join the [https://discord.gg/Asz5Gfe Discord]');
	},
};