module.exports = {
	name: 'restart',
	help: '!restart [force] - Restarts the bot',
	async execute(bancho, message, args) {
		console.log(bancho.autoHosts);
		if (args[0] && args[0].toLowerCase() === 'force') {
			await message.reply('Restarting bot...');
			process.exit(0);
		} else {
			await message.reply('Restarting bot when possible...');
			bancho.update = 1;
		}
	},
};