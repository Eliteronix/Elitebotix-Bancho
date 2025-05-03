const { getOsuPP, getOsuBeatmap, getMods } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const { trySendMessage } = require('../utils');

module.exports = {
	name: 'np',
	help: '/ /np - Get the pp values for the current beatmap with the current mods',
	tag: 'general',
	async execute(bancho, message) {
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

		await trySendMessage(message.user, `[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]] [${mods}] | 95%: ${Math.round(firstPP)}pp | 98%: ${Math.round(secondPP)}pp | 99%: ${Math.round(thirdPP)}pp | 100%: ${Math.round(fourthPP)}pp | ♫${beatmap.bpm} CS${beatmap.circleSize} AR${beatmap.approachRate} OD${beatmap.overallDifficulty} HP${beatmap.hpDrain}`);
	},
};