const { getOsuPP, getOsuBeatmap, getMods, getModBits } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const { trySendMessage } = require('../utils');

module.exports = {
	name: 'with',
	help: '!with - Get the pp values for the last map with the given mods',
	tags: ['general'],
	async execute(bancho, message, args) {
		let mods = args.join('').toUpperCase();
		let modBits = getModBits(mods);
		let oldBeatmap = bancho.lastUserMaps[message.user.id.toString()];

		if (!oldBeatmap) {
			return await trySendMessage(message.user, 'Please /np a map first.');
		}

		let beatmap = await getOsuBeatmap({ beatmapId: oldBeatmap.beatmapId, modBits: modBits });

		bancho.lastUserMaps[message.user.id.toString()] = { beatmapId: oldBeatmap.beatmapId, modBits: oldBeatmap.modBits };

		let firstPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 95.00, 0, beatmap.maxCombo);
		let secondPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 98.00, 0, beatmap.maxCombo);
		let thirdPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 99.00, 0, beatmap.maxCombo);
		let fourthPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, 100.00, 0, beatmap.maxCombo);

		mods = getMods(beatmap.mods);

		if (!mods[0]) {
			mods = ['NM'];
		}

		mods = mods.join('');

		await trySendMessage(message.user, `[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]] [${mods}] | 95%: ${Math.round(firstPP)}pp | 98%: ${Math.round(secondPP)}pp | 99%: ${Math.round(thirdPP)}pp | 100%: ${Math.round(fourthPP)}pp`);
	},
};