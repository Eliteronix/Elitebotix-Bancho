const fs = require('fs');
const Discord = require('discord.js');
const cooldowns = new Discord.Collection();
const { Permissions } = require('discord.js');

module.exports = async function (msg, bancho) {

	//check if the message wasn't sent by the bot itself or another bot
	if (!(msg.author.bot) || msg.channel.id === '892873577479692358') {
		//Create a collection for the commands
		msg.client.commands = new Discord.Collection();

		//get all command files
		const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

		//Add the commands from the command files to the client.commands collection
		for (const file of commandFiles) {
			const command = require(`./commands/${file}`);

			// set a new item in the Collection
			// with the key as the command name and the value as the exported module
			msg.client.commands.set(command.name, command);
		}

		const prefix = 'e!';

		//Define if it is a command with prefix
		//Split the message into an args array
		let prefixCommand;
		let args;
		if (msg.content.startsWith(prefix)) {
			prefixCommand = true;
			args = msg.content.slice(prefix.length).trim().split(/ +/);
		} else {
			args = msg.content.trim().split(/ +/);
		}

		//Delete the first item from the args array and use it for the command variable
		let commandName = args.shift().toLowerCase();

		//Set the command and check for possible uses of aliases
		let command = msg.client.commands.get(commandName)
			|| msg.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

		if (!command) {
			return;
		}

		//Check if prefix has to be used or not
		if (command.prefixCommand !== prefixCommand) return;

		//Check if the command can't be used outside of DMs
		if (command.guildOnly && msg.channel.type === 'DM') {
			return msg.reply('I can\'t execute that command inside DMs!');
		}

		//Check permissions of the user
		if (command.permissions) {
			const authorPerms = msg.channel.permissionsFor(msg.member);
			if (!authorPerms || !authorPerms.has(command.permissions)) {
				return msg.reply(`You need the ${command.permissionsTranslated} permission to do this!`);
			}
		}

		//Check permissions of the bot
		if (msg.channel.type !== 'DM') {
			const botPermissions = msg.channel.permissionsFor(await msg.guild.members.fetch(msg.client.user.id));
			if (!botPermissions || !botPermissions.has(Permissions.FLAGS.SEND_MESSAGES) || !botPermissions.has(Permissions.FLAGS.READ_MESSAGE_HISTORY)) {
				//The bot can't possibly answer the message
				return;
			}

			//Check the command permissions
			if (command.botPermissions) {
				if (!botPermissions.has(command.botPermissions)) {
					return msg.reply(`I need the ${command.botPermissionsTranslated} permission to do this!`);
				}
			}
		}

		//Check if arguments are provided if needed
		if (command.args && !args.length) {
			//Set standard reply
			let reply = 'You didn\'t provide any arguments.';

			//Set reply with usage if needed.
			if (command.usage) {
				reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
			}

			//Send message
			return msg.reply(reply);
		}

		//Check if the cooldown collection has the command already; if not write it in
		if (!cooldowns.has(command.name)) {
			cooldowns.set(command.name, new Discord.Collection());
		}

		//Set current time
		const now = Date.now();
		//gets the collections for the current command used
		const timestamps = cooldowns.get(command.name);
		//set necessary cooldown amount; if non stated in command default to 5; calculate ms afterwards
		const cooldownAmount = (command.cooldown || 5) * 1000;

		//get expiration times for the cooldowns for the authorId
		if (timestamps.has(msg.author.id)) {
			const expirationTime = timestamps.get(msg.author.id) + cooldownAmount;

			//If cooldown didn't expire yet send cooldown message
			if (command.noCooldownMessage) {
				return;
			} else if (now < expirationTime) {
				const timeLeft = (expirationTime - now) / 1000;
				return msg.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
			}
		}

		//Automatically delete the timestamp after the cooldown
		setTimeout(() => timestamps.delete(msg.author.id), cooldownAmount);

		try {
			let additionalObjects = [msg.client, bancho];
			command.execute(msg, args, null, additionalObjects);
		} catch (error) {
			console.error(error);
			const eliteronixUser = await msg.client.users.cache.find(user => user.id === '138273136285057025');
			msg.reply('There was an error trying to execute that command. The developers have been alerted.');
			eliteronixUser.send(`There was an error trying to execute a command.\n\nMessage by ${msg.author.username}#${msg.author.discriminator}: \`${msg.content}\`\n\n${error}`);
		}
	}
};