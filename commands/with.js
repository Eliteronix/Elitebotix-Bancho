const { getOsuPP, getOsuBeatmap, getMods, getModBits } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);

module.exports = {
	name: 'with',
	help: '!with - Get the pp values for the last map with the given mods',
	async execute(bancho, message, args) {
		let args = message.message.slice(5).trim().split(/ +/);
		let mods = args.join('').toUpperCase();
		let modBits = getModBits(mods);

		await message.user.fetchFromAPI();
		let oldBeatmap = bancho.lastUserMaps[message.user.id.toString()];

		if (!oldBeatmap) {
			return message.user.sendMessage('Please /np a map first.');
		}

		let beatmap = await getOsuBeatmap({ beatmapId: oldBeatmap.beatmapId, modBits: modBits });

		bancho.lastUserMaps[message.user.id.toString()] = { beatmapId: beatmapId, modBits: modBits };

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
	},
};