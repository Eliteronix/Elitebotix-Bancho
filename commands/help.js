module.exports = {
	name: 'help',
	help: '!help - List all commands or get info about a specific command.',
	async execute(bancho, message, args) {

		for (let i = 0; i < bancho.commands.length; i++) {
			if (bancho.commands[i].help) {
				await message.user.sendMessage(bancho.commands[i].help);
			} else {
				await message.user.sendMessage(`The stupid dev forgot to add a help message for ${bancho.commands[i].name}. Sorry about that!`);
			}
		}

		await message.user.sendMessage('/ /np - Get the pp values for the current beatmap with the current mods');
		await message.user.sendMessage('!acc - Get the last map\'s pp value with the given accuracy');
		await message.user.sendMessage('!with - Get the pp values for the last map with the given mods');
		await message.user.sendMessage('!autohost <password> - Autohosts a lobby with tournament maps');
		await message.user.sendMessage('!play / !play1v1 / !queue1v1 - Queue up for 1v1 matches');
		await message.user.sendMessage('!lastrequests - Shows the last 5 twitch requests again');
		await message.user.sendMessage('!leave / !leave1v1 / !queue1v1-leave - Leave the queue for 1v1 matches');
		await message.user.sendMessage('!r [mod] [StarRating] - Get a beatmap recommendation for your current duel StarRating. If you don\'t have your account connected to the bot (can be done by using /osu-link command in discord) nor didn\'t specify desired Star Rating, it will use default value of 4.5*');
		await message.user.sendMessage('!unlink - Unlink your discord account from your osu! account');
	},
};