const { getUserDuelStarRating, getValidTournamentBeatmap } = require('./utils');
const { DBElitebotixProcessQueue, DBElitebotixDiscordUsers } = require('./dbObjects');
const { getOsuPP, getOsuBeatmap, getMods } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
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

	//Listen to now playing / now listening and send pp info
	if (message.message.match(/https?:\/\/osu\.ppy\.sh\/beatmapsets\/.+\/\d+/gm)) {
		return nowListening(bancho, message);
	}

	let args = message.message.slice(1).trim().split(/ +/);

	let commandName = args.shift().toLowerCase();

	//Set the command and check for possible uses of aliases
	let command = bancho.commands.find(cmd => cmd.name === commandName)
		|| bancho.commands.find(cmd => cmd.alias && cmd.alias.includes(commandName));

	if (!command) {
		return message.user.sendMessage('Command not found. Use !help to get a list of all commands.');
	}

	command.execute(bancho, message, args);
};

async function nowListening(bancho, message) {
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

	console.log(`Got beatmap ${beatmap.beatmapId} from ${message.user.username} (${message.user.id})`);

	bancho.lastUserMaps[message.user.id.toString()] = { beatmapId: beatmapId, modBits: modBits };

	let firstPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 95.00, 0, beatmap.maxCombo);
	let secondPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 98.00, 0, beatmap.maxCombo);
	let thirdPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 99.00, 0, beatmap.maxCombo);
	let fourthPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 100.00, 0, beatmap.maxCombo);

	let mods = getMods(beatmap.mods);

	if (!mods[0]) {
		mods = ['NM'];
	}

	mods = mods.join('');

	message.user.sendMessage(`[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]] [${mods}] | 95%: ${Math.round(firstPP)}pp | 98%: ${Math.round(secondPP)}pp | 99%: ${Math.round(thirdPP)}pp | 100%: ${Math.round(fourthPP)}pp | ♫${beatmap.bpm} CS${beatmap.circleSize} AR${beatmap.approachRate} OD${beatmap.overallDifficulty} HP${beatmap.hpDrain}`);
}