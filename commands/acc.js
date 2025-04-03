const { getOsuPP, getOsuBeatmap, getMods } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);

module.exports = {
	name: 'acc',
	help: '!acc - Get the last map\'s pp value with the given accuracy',
	async execute(bancho, message, args) {
		if (!args[0]) {
			return message.user.sendMessage('Please specify an accuracy.');
		}

		let acc = parseFloat(args[0].replace(',', '.'));

		let oldBeatmap = bancho.lastUserMaps.get(message.user.id.toString());

		if (!oldBeatmap) {
			return message.user.sendMessage('Please /np a map first.');
		}

		let beatmap = await getOsuBeatmap({ beatmapId: oldBeatmap.beatmapId, modBits: oldBeatmap.modBits });

		let accPP = await getOsuPP(beatmap.beatmapId, null, beatmap.mods, acc, 0, beatmap.maxCombo);

		let mods = getMods(beatmap.mods);

		if (!mods[0]) {
			mods = ['NM'];
		}

		mods = mods.join('');

		message.user.sendMessage(`[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]] [${mods}] | ${acc}%: ${Math.round(accPP)}pp`);
	},
};