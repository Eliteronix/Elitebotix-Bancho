const { DBElitebotixDiscordUsers } = require('./dbObjects');

module.exports = {
	name: 'unlink',
	help: '!unlink - Unlink your discord account from your osu! account',
	async execute(bancho, message, args) {
		await message.user.fetchFromAPI();

		let discordUser = await DBElitebotixDiscordUsers.findOne({
			attributes: ['id', 'userId', 'osuVerified'],
			where: {
				osuUserId: message.user.id
			}
		});

		if (discordUser && discordUser.userId) {
			discordUser.userId = null;
			discordUser.osuVerified = false;
			await discordUser.save();

			return await message.user.sendMessage('Your discord account has been unlinked from your osu! account.');
		} else {
			await message.user.sendMessage('You have no discord account linked to your osu! account.');
		}
	},
};