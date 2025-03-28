const { getOsuPP, getOsuBeatmap, getUserDuelStarRating, getValidTournamentBeatmap } = require('./utils');
const { DBElitebotixProcessQueue, DBElitebotixDiscordUsers } = require('./dbObjects');

// Replace utils and client dependencies

module.exports = async function (bancho, message) {

	if (!bancho.commands) {

		//get all command files
		const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

		//Add the commands from the command files to the client.commands collection
		for (const file of commandFiles) {
			const command = require(`./commands/${file}`);

			// set a new item in the Collection
			// with the key as the command name and the value as the exported module
			bancho.commands.push({ name: command.name, alias: command.alias, help: command.help });
		}
	}

	let args = message.message.slice(1).trim().split(/ +/);

	let commandName = args.shift().toLowerCase();

	//Set the command and check for possible uses of aliases
	let command = bancho.commands.find(cmd => cmd.name === commandName)
		|| bancho.commands.find(cmd => cmd.alias && cmd.alias.includes(interaction.commandName));

	if (!command) {
		return message.user.sendMessage('Command not found. Use !help to get a list of all commands.');
	}

	command.execute(bancho, message, args);

	return;
	//Listen to now playing / now listening and send pp info
	if (message.message.match(/https?:\/\/osu\.ppy\.sh\/beatmapsets\/.+\/\d+/gm)) {
		let beatmapId = message.message.match(/https?:\/\/osu\.ppy\.sh\/beatmapsets\/.+\/\d+/gm)[0].replace(/.+\//gm, '');

		let modBits = 0;

		if (message.message.includes('-NoFail')) {
			modBits += 1;
		}
		if (message.message.includes('-Easy')) {
			modBits += 2;
		}
		if (message.message.includes('+Hidden')) {
			modBits += 8;
		}
		if (message.message.includes('+HardRock')) {
			modBits += 16;
		}
		if (message.message.includes('+DoubleTime')) {
			modBits += 64;
		}
		if (message.message.includes('-HalfTime')) {
			modBits += 256;
		}
		if (message.message.includes('+Nightcore')) {
			modBits += 512 + 64; //Special case
		}
		if (message.message.includes('+Flashlight')) {
			modBits += 1024;
		}
		if (message.message.includes('+SpunOut')) {
			modBits += 4096;
		}
		if (message.message.includes('+FadeIn')) {
			modBits += 1048576;
		}
		if (message.message.includes('+KeyCoop')) {
			modBits += 33554432;
		}

		let beatmap = await getOsuBeatmap({ beatmapId: beatmapId, modBits: modBits });

		await message.user.fetchFromAPI();
		bancho.lastUserMaps.set(message.user.id.toString(), { beatmapId: beatmapId, modBits: modBits });

		let firstPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 95.00, 0, beatmap.maxCombo, client);
		let secondPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 98.00, 0, beatmap.maxCombo, client);
		let thirdPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 99.00, 0, beatmap.maxCombo, client);
		let fourthPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 100.00, 0, beatmap.maxCombo, client);

		let mods = getMods(beatmap.mods);

		if (!mods[0]) {
			mods = ['NM'];
		}

		mods = mods.join('');

		message.user.sendMessage(`[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]] [${mods}] | 95%: ${Math.round(firstPP)}pp | 98%: ${Math.round(secondPP)}pp | 99%: ${Math.round(thirdPP)}pp | 100%: ${Math.round(fourthPP)}pp | ♫${beatmap.bpm} CS${beatmap.circleSize} AR${beatmap.approachRate} OD${beatmap.overallDifficulty} HP${beatmap.hpDrain}`);
	} else if (message.message === '!queue1v1' || message.message === '!play1v1' || message.message === '!play') {
		await message.user.fetchFromAPI();

		let discordUser = await DBElitebotixDiscordUsers.findOne({
			attributes: ['osuUserId'],
			where: {
				osuUserId: message.user.id,
				osuVerified: true
			}
		});

		if (!discordUser) {
			console.log('no connected and verified account found', message.user, discordUser);
			return message.user.sendMessage(`Please connect and verify your account with the bot on discord as a backup by using: '/osu-link connect username:${message.user.username}' [https://discord.gg/Asz5Gfe Discord]`);
		}

		let existingQueueTasks = await DBElitebotixProcessQueue.findAll({
			attributes: ['additions'],
			where: {
				task: 'duelQueue1v1',
			},
		});

		for (let i = 0; i < existingQueueTasks.length; i++) {
			const osuUserId = existingQueueTasks[i].additions.split(';')[0];

			if (osuUserId === discordUser.osuUserId) {
				let ownRating = parseFloat(existingQueueTasks[i].additions.split(';')[1]);
				let tasksInReach = existingQueueTasks.filter((task) => {
					return Math.abs(ownRating - parseFloat(task.additions.split(';')[1])) < 1;
				});

				return message.user.sendMessage(`You are already in the queue for a 1v1 duel. There are ${existingQueueTasks.length - 1} opponents in the queue (${tasksInReach.length - 1} in reach).`);
			}
		}

		let ownStarRating = 5;
		try {
			message.user.sendMessage('Processing duel rating...');
			ownStarRating = await getUserDuelStarRating({ osuUserId: discordUser.osuUserId, client: client });

			ownStarRating = ownStarRating.total;
		} catch (e) {
			if (e !== 'No standard plays') {
				console.error('gotBanchoPrivateMessage.js | process duel rating for queue' + e);
			}
		}

		//Check again in case the user spammed the command
		existingQueueTasks = await DBElitebotixProcessQueue.findAll({
			attributes: ['additions'],
			where: {
				task: 'duelQueue1v1',
			},
		});

		for (let i = 0; i < existingQueueTasks.length; i++) {
			const osuUserId = existingQueueTasks[i].additions.split(';')[0];

			if (osuUserId === discordUser.osuUserId) {
				let ownRating = parseFloat(existingQueueTasks[i].additions.split(';')[1]);
				let tasksInReach = existingQueueTasks.filter((task) => {
					return Math.abs(ownRating - parseFloat(task.additions.split(';')[1])) < 1;
				});

				return message.user.sendMessage(`You are already in the queue for a 1v1 duel. There are ${existingQueueTasks.length - 1} opponents in the queue (${tasksInReach.length - 1} in reach).`);
			}
		}

		await DBElitebotixProcessQueue.create({
			guildId: 'none',
			task: 'duelQueue1v1',
			additions: `${discordUser.osuUserId};${ownStarRating};0.125`,
			date: new Date(),
			priority: 9
		});

		await updateQueueChannels();

		let tasksInReach = existingQueueTasks.filter((task) => {
			return Math.abs(ownStarRating - parseFloat(task.additions.split(';')[1])) < 1;
		});

		try {
			return await message.user.sendMessage(`You are now queued up for a 1v1 duel. There are ${existingQueueTasks.length} opponents in the queue (${tasksInReach.length} in reach).`);
		} catch (e) {
			if (e.message === 'Currently disconnected!') {
				await bancho.connect();
				return await message.user.sendMessage(`You are now queued up for a 1v1 duel. There are ${existingQueueTasks.length} opponents in the queue (${tasksInReach.length} in reach).`);
			} else {
				return console.error('gotBanchoPrivateMessage.js | queue1v1', e);
			}
		}
	} else if (message.message.toLowerCase().startsWith('!r')) {
		let args = message.message.slice(2).trim().split(/ +/);

		let specifiedRating = false;

		// set default values
		let modPools = ['NM', 'HD', 'HR', 'DT', 'FM'];
		let mod = modPools[Math.floor(Math.random() * modPools.length)];
		let userStarRating;
		let mode = 'Standard';

		for (let i = 0; i < args.length; i++) {
			if (args[i].toLowerCase() == 'nomod' || args[i].toLowerCase() == 'nm') {
				mod = 'NM';
				args.splice(i, 1);
				i--;
			} else if (args[i].toLowerCase() == 'hidden' || args[i].toLowerCase() == 'hd') {
				mod = 'HD';
				args.splice(i, 1);
				i--;
			} else if (args[i].toLowerCase() == ('hardrock') || args[i].toLowerCase() == ('hr')) {
				mod = 'HR';
				args.splice(i, 1);
				i--;
			} else if (args[i].toLowerCase() == ('doubletime') || args[i].toLowerCase() == ('dt')) {
				mod = 'DT';
				args.splice(i, 1);
				i--;
			} else if (args[i].toLowerCase() == ('freemod') || args[i].toLowerCase() == ('fm')) {
				mod = 'FM';
				args.splice(i, 1);
				i--;
			} else if (args[i].toLowerCase() == 'mania' || args[i].toLowerCase() == 'm') {
				mode = 'Mania';
				args.splice(i, 1);
				i--;
			} else if (args[i].toLowerCase() == 'taiko' || args[i].toLowerCase() == 't') {
				mode = 'Taiko';
				args.splice(i, 1);
				i--;
			} else if (args[i].toLowerCase() == 'catch the beat' || args[i].toLowerCase() == 'ctb') {
				mode = 'Catch the Beat';
				args.splice(i, 1);
				i--;
			} else if (parseFloat(args[i]) > 3 && parseFloat(args[i]) < 15) {
				userStarRating = parseFloat(args[i]);
				args.splice(i, 1);
				i--;
				specifiedRating = true;
			}
		}

		let osuUserId = await message.user.fetchFromAPI()
			.then((user) => {
				return user.id;
				// eslint-disable-next-line no-unused-vars
			}).catch((e) => {
				//
			});

		const discordUser = await DBElitebotixDiscordUsers.findOne({
			attributes: [
				'osuUserId',
				'osuDuelProvisional',
				'osuDuelStarRating',
				'osuNoModDuelStarRating',
				'osuHiddenDuelStarRating',
				'osuHardRockDuelStarRating',
				'osuDoubleTimeDuelStarRating',
				'osuFreeModDuelStarRating',
			],
			where: {
				osuUserId: osuUserId
			},
		});

		if (!discordUser && !userStarRating) {
			userStarRating = 4.5;
		}

		// check if the user has account connected, duel star rating not provisioanl and did not specify SR
		if (discordUser && discordUser.osuDuelProvisional && !userStarRating) {
			userStarRating = parseFloat(discordUser.osuDuelStarRating);
		} else if (mod == 'NM' && discordUser && discordUser.osuNoModDuelStarRating != null && !userStarRating) {
			userStarRating = parseFloat(discordUser.osuNoModDuelStarRating);
		} else if (mod == 'HD' && discordUser && discordUser.osuHiddenDuelStarRating != null && !userStarRating) {
			userStarRating = parseFloat(discordUser.osuHiddenDuelStarRating);
		} else if (mod == 'HR' && discordUser && discordUser.osuHardRockDuelStarRating != null && !userStarRating) {
			userStarRating = parseFloat(discordUser.osuHardRockDuelStarRating);
		} else if (mod == 'DT' && discordUser && discordUser.osuDoubleTimeDuelStarRating != null && !userStarRating) {
			userStarRating = parseFloat(discordUser.osuDoubleTimeDuelStarRating);
		} else if (mod == 'FM' && discordUser && discordUser.osuFreeModDuelStarRating != null && !userStarRating) {
			userStarRating = parseFloat(discordUser.osuFreeModDuelStarRating);
		}

		let beatmap = await getValidTournamentBeatmap({ modPool: mod, lowerBound: userStarRating - 0.125, upperBound: userStarRating + 0.125, mode: mode });

		const totalLengthSeconds = (beatmap.totalLength % 60) + '';
		const totalLengthMinutes = (beatmap.totalLength - beatmap.totalLength % 60) / 60;
		const totalLength = totalLengthMinutes + ':' + Math.round(totalLengthSeconds).toString().padStart(2, '0');

		let hdBuff = ' ';
		if (mod == 'HD') {
			hdBuff = ' (with Elitebotix HD buff) ';
		}
		let modeText = '';
		if (mode == 'Mania') {
			modeText = ' [Mania]';
		} else if (mode == 'Catch the Beat') {
			modeText = ' [Catch the Beat]';
		} else if (mode == 'Taiko') {
			modeText = ' [Taiko]';
		}

		message.user.sendMessage(`[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]]${modeText} + ${mod} | Beatmap ★: ${Math.floor(beatmap.starRating * 100) / 100}${hdBuff}| Your${specifiedRating ? ' specified' : ''} ${mod} duel ★: ${Math.floor(userStarRating * 100) / 100} | ${totalLength} ♫${beatmap.bpm} CS${beatmap.circleSize} AR${beatmap.approachRate} OD${beatmap.overallDifficulty}`);
	} else if (message.message.toLowerCase().startsWith('!autohost')) {
		let args = message.message.slice(9).trim().split(/ +/);

		const command = require('./commands/osu-autohost.js');

		process.send(`command ${command.name}`);

		command.execute(message, args, null, [client, bancho]);
	} else if (message.message.toLowerCase().startsWith('!with')) {
		let args = message.message.slice(5).trim().split(/ +/);
		let mods = args.join('').toUpperCase();
		let modBits = getModBits(mods);

		await message.user.fetchFromAPI();
		let oldBeatmap = bancho.lastUserMaps.get(message.user.id.toString());

		if (!oldBeatmap) {
			return message.user.sendMessage('Please /np a map first.');
		}

		let beatmap = await getOsuBeatmap({ beatmapId: oldBeatmap.beatmapId, modBits: modBits });

		bancho.lastUserMaps.set(message.user.id.toString(), { beatmapId: oldBeatmap.beatmapId, modBits: modBits });

		let firstPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 95.00, 0, beatmap.maxCombo, client);
		let secondPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 98.00, 0, beatmap.maxCombo, client);
		let thirdPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 99.00, 0, beatmap.maxCombo, client);
		let fourthPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 100.00, 0, beatmap.maxCombo, client);

		mods = getMods(beatmap.mods);

		if (!mods[0]) {
			mods = ['NM'];
		}

		mods = mods.join('');

		message.user.sendMessage(`[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]] [${mods}] | 95%: ${Math.round(firstPP)}pp | 98%: ${Math.round(secondPP)}pp | 99%: ${Math.round(thirdPP)}pp | 100%: ${Math.round(fourthPP)}pp`);
	} else if (message.message.toLowerCase().startsWith('!acc')) {
		let args = message.message.slice(5).trim().split(/ +/);

		if (!args[0]) {
			return message.user.sendMessage('Please specify an accuracy.');
		}

		let acc = parseFloat(args[0].replace(',', '.'));

		await message.user.fetchFromAPI();
		let oldBeatmap = bancho.lastUserMaps.get(message.user.id.toString());

		if (!oldBeatmap) {
			return message.user.sendMessage('Please /np a map first.');
		}

		let beatmap = await getOsuBeatmap({ beatmapId: oldBeatmap.beatmapId, modBits: oldBeatmap.modBits });

		let accPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, acc, 0, beatmap.maxCombo, client);

		let mods = getMods(beatmap.mods);

		if (!mods[0]) {
			mods = ['NM'];
		}

		mods = mods.join('');

		message.user.sendMessage(`[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]] [${mods}] | ${acc}%: ${Math.round(accPP)}pp`);
	}
};

async function updateQueueChannels() {
	await DBElitebotixProcessQueue.create({
		guildId: 'none',
		task: 'updateQueueChannels',
		date: new Date(),
		priority: 0
	});
}

function getMods(input) {
	let mods = [];
	let modsBits = input;
	let PFpossible = false;
	let hasNC = false;
	if (modsBits >= 1073741824) {
		mods.push('MI');
		modsBits = modsBits - 1073741824;
	}
	if (modsBits >= 536870912) {
		mods.push('V2');
		modsBits = modsBits - 536870912;
	}
	if (modsBits >= 268435456) {
		mods.push('2K');
		modsBits = modsBits - 268435456;
	}
	if (modsBits >= 134217728) {
		mods.push('3K');
		modsBits = modsBits - 134217728;
	}
	if (modsBits >= 67108864) {
		mods.push('1K');
		modsBits = modsBits - 67108864;
	}
	if (modsBits >= 33554432) {
		mods.push('KC');
		modsBits = modsBits - 33554432;
	}
	if (modsBits >= 16777216) {
		mods.push('9K');
		modsBits = modsBits - 16777216;
	}
	if (modsBits >= 8388608) {
		mods.push('TG');
		modsBits = modsBits - 8388608;
	}
	if (modsBits >= 4194304) {
		mods.push('CI');
		modsBits = modsBits - 4194304;
	}
	if (modsBits >= 2097152) {
		mods.push('RD');
		modsBits = modsBits - 2097152;
	}
	if (modsBits >= 1048576) {
		mods.push('FI');
		modsBits = modsBits - 1048576;
	}
	if (modsBits >= 524288) {
		mods.push('8K');
		modsBits = modsBits - 524288;
	}
	if (modsBits >= 262144) {
		mods.push('7K');
		modsBits = modsBits - 262144;
	}
	if (modsBits >= 131072) {
		mods.push('6K');
		modsBits = modsBits - 131072;
	}
	if (modsBits >= 65536) {
		mods.push('5K');
		modsBits = modsBits - 65536;
	}
	if (modsBits >= 32768) {
		mods.push('4K');
		modsBits = modsBits - 32768;
	}
	if (modsBits >= 16384) {
		PFpossible = true;
		modsBits = modsBits - 16384;
	}
	if (modsBits >= 8192) {
		mods.push('AP');
		modsBits = modsBits - 8192;
	}
	if (modsBits >= 4096) {
		mods.push('SO');
		modsBits = modsBits - 4096;
	}
	if (modsBits >= 2048) {
		modsBits = modsBits - 2048;
	}
	if (modsBits >= 1024) {
		mods.push('FL');
		modsBits = modsBits - 1024;
	}
	if (modsBits >= 512) {
		hasNC = true;
		mods.push('NC');
		modsBits = modsBits - 512;
	}
	if (modsBits >= 256) {
		mods.push('HT');
		modsBits = modsBits - 256;
	}
	if (modsBits >= 128) {
		mods.push('RX');
		modsBits = modsBits - 128;
	}
	if (modsBits >= 64) {
		if (!hasNC) {
			mods.push('DT');
		}
		modsBits = modsBits - 64;
	}
	if (modsBits >= 32) {
		if (PFpossible) {
			mods.push('PF');
		} else {
			mods.push('SD');
		}
		modsBits = modsBits - 32;
	}
	if (modsBits >= 16) {
		mods.push('HR');
		modsBits = modsBits - 16;
	}
	if (modsBits >= 8) {
		mods.push('HD');
		modsBits = modsBits - 8;
	}
	if (modsBits >= 4) {
		mods.push('TD');
		modsBits = modsBits - 4;
	}
	if (modsBits >= 2) {
		mods.push('EZ');
		modsBits = modsBits - 2;
	}
	if (modsBits >= 1) {
		mods.push('NF');
		modsBits = modsBits - 1;
	}

	return mods.reverse();
}

function getModBits(input, noVisualMods) {
	let modBits = 0;

	if (input === 'NM') {
		return modBits;
	}

	for (let i = 0; i < input.length; i += 2) {
		if (input.substring(i, i + 2) === 'MI' && !noVisualMods) {
			modBits += 1073741824;
		} else if (input.substring(i, i + 2) === 'V2') {
			modBits += 536870912;
		} else if (input.substring(i, i + 2) === '2K') {
			modBits += 268435456;
		} else if (input.substring(i, i + 2) === '3K') {
			modBits += 134217728;
		} else if (input.substring(i, i + 2) === '1K') {
			modBits += 67108864;
		} else if (input.substring(i, i + 2) === 'KC') {
			modBits += 33554432;
		} else if (input.substring(i, i + 2) === '9K') {
			modBits += 16777216;
		} else if (input.substring(i, i + 2) === 'TG') {
			modBits += 8388608;
		} else if (input.substring(i, i + 2) === 'CI') {
			modBits += 4194304;
		} else if (input.substring(i, i + 2) === 'RD') {
			modBits += 2097152;
		} else if (input.substring(i, i + 2) === 'FI' && !noVisualMods) {
			modBits += 1048576;
		} else if (input.substring(i, i + 2) === '8K') {
			modBits += 524288;
		} else if (input.substring(i, i + 2) === '7K') {
			modBits += 262144;
		} else if (input.substring(i, i + 2) === '6K') {
			modBits += 131072;
		} else if (input.substring(i, i + 2) === '5K') {
			modBits += 65536;
		} else if (input.substring(i, i + 2) === '4K') {
			modBits += 32768;
		} else if (input.substring(i, i + 2) === 'PF' && !noVisualMods) {
			modBits += 16384;
			modBits += 32;
		} else if (input.substring(i, i + 2) === 'AP') {
			modBits += 8192;
		} else if (input.substring(i, i + 2) === 'SO' && !noVisualMods) {
			modBits += 4096;
		} else if (input.substring(i, i + 2) === 'FL') {
			modBits += 1024;
		} else if (input.substring(i, i + 2) === 'NC') {
			if (!noVisualMods) {
				modBits += 512;
			}
			modBits += 64;
		} else if (input.substring(i, i + 2) === 'HT') {
			modBits += 256;
		} else if (input.substring(i, i + 2) === 'RX') {
			modBits += 128;
		} else if (input.substring(i, i + 2) === 'DT') {
			modBits += 64;
		} else if (input.substring(i, i + 2) === 'SD' && !noVisualMods) {
			modBits += 32;
		} else if (input.substring(i, i + 2) === 'HR') {
			modBits += 16;
		} else if (input.substring(i, i + 2) === 'HD' && (input.includes('FL') || !input.includes('FL') && !noVisualMods)) {
			modBits += 8;
		} else if (input.substring(i, i + 2) === 'TD') {
			modBits += 4;
		} else if (input.substring(i, i + 2) === 'EZ') {
			modBits += 2;
		} else if (input.substring(i, i + 2) === 'NF' && !noVisualMods) {
			modBits += 1;
		}
	}

	return modBits;
}