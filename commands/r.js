const { getValidTournamentBeatmap } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const { DBElitebotixDiscordUsers } = require('../dbObjects');
const { trySendMessage } = require('../utils');

module.exports = {
	name: 'r',
	help: '!r [mod] [StarRating] - Get a beatmap recommendation for your current duel StarRating. If you don\'t have your account connected to the bot (can be done by using /osu-link command in discord) nor didn\'t specify desired Star Rating, it will use default value of 4.5*',
	tag: 'general',
	async execute(bancho, message, args) {
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

		let osuUserId = await message.user.id;

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

		await trySendMessage(message.user, `[https://osu.ppy.sh/b/${beatmap.beatmapId} ${beatmap.artist} - ${beatmap.title} [${beatmap.difficulty}]]${modeText} + ${mod} | Beatmap ★: ${Math.floor(beatmap.starRating * 100) / 100}${hdBuff}| Your${specifiedRating ? ' specified' : ''} ${mod} duel ★: ${Math.floor(userStarRating * 100) / 100} | ${totalLength} ♫${beatmap.bpm} CS${beatmap.circleSize} AR${beatmap.approachRate} OD${beatmap.overallDifficulty}`);
	},
};