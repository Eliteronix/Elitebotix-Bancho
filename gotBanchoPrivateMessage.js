const fs = require('fs');

// Replace utils and client dependencies

module.exports = async function (bancho, message) {
	if (message.self) return;

	await message.user.fetchFromAPI();

	if (message.user.username === process.env.OSUNAME) return;

	if (!bancho.commands) {
		//get all command files
		const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

		bancho.commands = [];

		//Add the commands from the command files to the client.commands collection
		for (const file of commandFiles) {
			const command = require(`./commands/${file}`);

			// set a new item in the Collection
			// with the key as the command name and the value as the exported module
			bancho.commands.push({ name: command.name, alias: command.alias, help: command.help, execute: command.execute });
		}
	}

	let args = message.message.slice(1).trim().split(/ +/);

	let commandName = args.shift().toLowerCase();

	//Listen to now playing / now listening and send pp info
	if (message.message.match(/https?:\/\/osu\.ppy\.sh\/beatmapsets\/.+\/\d+/gm)) {
		let command = bancho.commands.find(cmd => cmd.name === 'np');

		return command.execute(bancho, message, args);
	}

	//Set the command and check for possible uses of aliases
	let command = bancho.commands.find(cmd => cmd.name === commandName)
		|| bancho.commands.find(cmd => cmd.alias && cmd.alias.includes(commandName));

	if (!command) {
		return message.user.sendMessage('Command not found. Use !help to get a list of all commands.');
	}

	command.execute(bancho, message, args);
};