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
	},
};