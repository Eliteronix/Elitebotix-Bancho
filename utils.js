const { DBGuilds, DBDiscordUsers, DBOsuBeatmaps, DBOsuMultiScores, DBDuelRatingHistory } = require('./dbObjects');
const Canvas = require('canvas');
const Discord = require('discord.js');
const osu = require('node-osu');
const { Op } = require('sequelize');

module.exports = {
	getGuildPrefix: async function (msg) {
		//Define prefix command
		let guildPrefix;

		//Check if the channel type is not a dm
		if (msg.channel.type === 'DM') {
			//Set prefix to standard prefix
			guildPrefix = 'e!';
		} else {
			//Get guild from the db
			const guild = await DBGuilds.findOne({
				where: { guildId: msg.guildId },
			});

			//Check if a guild record was found
			if (guild) {
				if (guild.customPrefixUsed) {
					guildPrefix = guild.customPrefix;
				} else {
					//Set prefix to standard prefix
					guildPrefix = 'e!';
				}
			} else {
				//Set prefix to standard prefix
				guildPrefix = 'e!';
			}
		}
		return guildPrefix;
	},
	humanReadable: function (input) {
		let output = '';
		if (input) {
			input = input.toString();
			for (let i = 0; i < input.length; i++) {
				if (i > 0 && (input.length - i) % 3 === 0) {
					output = output + ',';
				}
				output = output + input.charAt(i);
			}
		}

		return output;
	},
	getMods: function (input) {
		return getModsFunction(input);
	},
	getOsuUserServerMode: async function (msg, args) {
		let server = 'bancho';
		let mode = 0;

		//Check user settings
		const discordUser = await DBDiscordUsers.findOne({
			where: { userId: msg.author.id },
		});

		if (discordUser && discordUser.osuMainServer) {
			server = discordUser.osuMainServer;
		}

		if (discordUser && discordUser.osuMainMode) {
			mode = discordUser.osuMainMode;
		}

		for (let i = 0; i < args.length; i++) {
			if (args[i] === '--s' || args[i] === '--standard') {
				mode = 0;
				args.splice(i, 1);
				i--;
			} else if (args[i] === '--t' || args[i] === '--taiko') {
				mode = 1;
				args.splice(i, 1);
				i--;
			} else if (args[i] === '--c' || args[i] === '--catch') {
				mode = 2;
				args.splice(i, 1);
				i--;
			} else if (args[i] === '--m' || args[i] === '--mania') {
				mode = 3;
				args.splice(i, 1);
				i--;
			} else if (args[i] === '--r' || args[i] === '--ripple') {
				server = 'ripple';
				args.splice(i, 1);
				i--;
			} else if (args[i] === '--b' || args[i] === '--bancho') {
				server = 'bancho';
				args.splice(i, 1);
				i--;
			} else if (args[i] === '--tournaments') {
				server = 'tournaments';
				args.splice(i, 1);
				i--;
			}

		}
		const outputArray = [discordUser, server, mode];
		return outputArray;
	},
	async createLeaderboard(data, backgroundFile, title, filename, page) {
		if (page && (page - 1) * 48 > data.length) {
			page = null;
		}
		let totalPages = Math.floor((data.length - 1) / 48) + 1;

		let dataStart = 0;
		let dataEnd = Infinity;
		if (page) {
			dataStart = 48 * (page - 1);
			dataEnd = 48 * page;

			for (let i = 0; i < dataStart; i++) {
				data.splice(0, 1);
			}

			for (let i = leaderboar48dEntriesPerPage; i < data.length; i++) {
				data.splice(48, 1);
				i--;
			}
		}

		let columns = 1;
		let canvasWidth = 900;
		let rows = data.length;
		if (data.length > 63) {
			columns = 5;
			rows = 2 + Math.floor((data.length - 3) / columns) + 1;
		} else if (data.length > 48) {
			columns = 4;
			rows = 2 + Math.floor((data.length - 3) / columns) + 1;
		} else if (data.length > 33) {
			columns = 3;
			rows = 2 + Math.floor((data.length - 3) / columns) + 1;
		} else if (data.length > 15) {
			columns = 2;
			rows = 2 + Math.floor((data.length - 3) / columns) + 1;
		}
		canvasWidth = canvasWidth * columns;
		const canvasHeight = 125 + 20 + rows * 90;

		//Create Canvas
		const canvas = Canvas.createCanvas(canvasWidth, canvasHeight);

		Canvas.registerFont('./other/Comfortaa-Bold.ttf', { family: 'comfortaa' });

		//Get context and load the image
		const ctx = canvas.getContext('2d');

		const background = await Canvas.loadImage(`./other/${backgroundFile}`);

		for (let i = 0; i < canvas.height / background.height; i++) {
			for (let j = 0; j < canvas.width / background.width; j++) {
				ctx.drawImage(background, j * background.width, i * background.height, background.width, background.height);
			}
		}

		// Write the title of the leaderboard
		ctx.fillStyle = '#ffffff';
		fitTextOnMiddleCanvasFunction(ctx, title, 35, 'comfortaa, sans-serif', 50, canvas.width, 50);

		// Write the data
		ctx.textAlign = 'center';

		for (let i = 0; i < data.length && dataStart + i < dataEnd; i++) {
			let xPosition = canvas.width / 2;
			let yPositionName = 125 + i * 90;
			let yPositionValue = 160 + i * 90;
			if (columns > 1) {
				if (i + dataStart === 0) {
					xPosition = canvas.width / 2;
				} else if (i + dataStart === 1) {
					if (columns === 2) {
						xPosition = canvas.width / 3;
					} else {
						xPosition = canvas.width / 4;
					}
				} else if (i + dataStart === 2) {
					if (columns === 2) {
						xPosition = (canvas.width / 3) * 2;
					} else {
						xPosition = (canvas.width / 4) * 3;
					}
					yPositionName = 125 + (Math.floor((i - 3) / columns) + 2) * 90;
					yPositionValue = 160 + (Math.floor((i - 3) / columns) + 2) * 90;
				} else {
					if (dataStart === 0) {
						//Create standard xPosition
						xPosition = (canvas.width / (columns + 1)) * (((i - 3) % columns) + 1);
						//Stretch it
						let max = canvas.width / (columns + 1) / 2;
						let iterator = (i - 3) % columns;
						let standardizedIterator = iterator - (columns - 1) / 2;
						let lengthScaled = max / (columns / 2) * standardizedIterator;
						xPosition += lengthScaled;
						yPositionName = 125 + (Math.floor((i - 3) / columns) + 2) * 90;
						yPositionValue = 160 + (Math.floor((i - 3) / columns) + 2) * 90;
					} else {
						//Create standard xPosition
						xPosition = (canvas.width / (columns + 1)) * ((i % columns) + 1);
						//Stretch it
						let max = canvas.width / (columns + 1) / 2;
						let iterator = i % columns;
						let standardizedIterator = iterator - (columns - 1) / 2;
						let lengthScaled = max / (columns / 2) * standardizedIterator;
						xPosition += lengthScaled;
						yPositionName = 125 + (Math.floor(i / columns) + 1) * 90;
						yPositionValue = 160 + (Math.floor(i / columns) + 1) * 90;
					}
				}
			}

			if (data[i].color && data[i].color !== '#000000') {
				ctx.fillStyle = data[i].color;
			} else if (i + dataStart === 0) {
				ctx.fillStyle = '#E2B007';
			} else if (i + dataStart === 1) {
				ctx.fillStyle = '#C4CACE';
			} else if (i + dataStart === 2) {
				ctx.fillStyle = '#CC8E34';
			} else {
				ctx.fillStyle = '#ffffff';
			}

			ctx.font = 'bold 25px comfortaa, sans-serif';
			ctx.fillText(`${i + 1 + dataStart}. ${data[i].name}`, xPosition, yPositionName);
			ctx.font = '25px comfortaa, sans-serif';
			ctx.fillText(data[i].value, xPosition, yPositionValue);
		}

		let today = new Date().toLocaleDateString();

		ctx.font = 'bold 15px comfortaa, sans-serif';
		ctx.fillStyle = '#ffffff';

		if (page) {
			ctx.textAlign = 'left';
			ctx.fillText(`Page ${page} / ${totalPages}`, canvas.width / 140, canvas.height - 10);
		}

		ctx.textAlign = 'right';
		ctx.fillText(`Made by Elitebotix on ${today}`, canvas.width - canvas.width / 140, canvas.height - 10);

		//Create as an attachment and return
		return new Discord.MessageAttachment(canvas.toBuffer(), filename);
	},
	async createMOTDAttachment(stagename, beatmap, doubletime) {
		let canvasWidth = 1000;
		const canvasHeight = 1000;

		//Create Canvas
		const canvas = Canvas.createCanvas(canvasWidth, canvasHeight);

		Canvas.registerFont('./other/Comfortaa-Bold.ttf', { family: 'comfortaa' });

		//Get context and load the image
		const ctx = canvas.getContext('2d');

		const background = await Canvas.loadImage('./other/osu-background.png');

		for (let i = 0; i < canvas.height / background.height; i++) {
			for (let j = 0; j < canvas.width / background.width; j++) {
				ctx.drawImage(background, j * background.width, i * background.height, background.width, background.height);
			}
		}

		// Write the stage of the map
		ctx.font = 'bold 50px comfortaa, sans-serif';
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.fillText(stagename, canvas.width / 2, 65);

		ctx.fillStyle = 'rgba(173, 216, 230, 0.25)';
		ctx.fillRect(100, 100, 800, 800);

		// Write the map infos
		ctx.font = 'bold 50px comfortaa, sans-serif';
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		fitTextOnMiddleCanvasFunction(ctx, beatmap.artist, 40, 'comfortaa, sans-serif', 200, canvas.width, 220);
		fitTextOnMiddleCanvasFunction(ctx, beatmap.title, 40, 'comfortaa, sans-serif', 240, canvas.width, 220);
		fitTextOnMiddleCanvasFunction(ctx, `Mapper: ${beatmap.creator}`, 40, 'comfortaa, sans-serif', 280, canvas.width, 220);
		fitTextOnMiddleCanvasFunction(ctx, `[${beatmap.version}]`, 100, 'comfortaa, sans-serif', 450, canvas.width, 220);
		let doubletimeMod = '';
		if (doubletime) {
			doubletimeMod = '+DoubleTime';
			ctx.save();
			ctx.beginPath();
			// move the rotation point to the center of the rect
			ctx.translate(775, 700);
			// rotate the rect
			ctx.rotate(45 * Math.PI / 180);

			// draw the rect on the transformed context
			// Note: after transforming [0,0] is visually [x,y]
			//       so the rect needs to be offset accordingly when drawn
			ctx.rect(-60, -60, 120, 120);

			ctx.fillStyle = 'rgb(56, 172, 236)';
			ctx.fill();

			// restore the context to its untranslated/unrotated state
			ctx.restore();

			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 65px comfortaa, sans-serif';
			ctx.fillText('DT', 775, 725);
		}
		fitTextOnMiddleCanvasFunction(ctx, `Mods: Freemod${doubletimeMod}`, 50, 'comfortaa, sans-serif', 575, canvas.width, 220);
		fitTextOnMiddleCanvasFunction(ctx, '(All mods allowed except: Relax, Autopilot, Auto, ScoreV2)', 25, 'comfortaa, sans-serif', 600, canvas.width, 220);
		fitTextOnMiddleCanvasFunction(ctx, `Length: ${Math.floor(beatmap.length.total / 60)}:${(beatmap.length.total % 60).toString().padStart(2, '0')}`, 35, 'comfortaa, sans-serif', 700, canvas.width, 220);
		fitTextOnMiddleCanvasFunction(ctx, `SR: ${Math.round(beatmap.difficulty.rating * 100) / 100} | ${beatmap.bpm} BPM`, 35, 'comfortaa, sans-serif', 750, canvas.width, 220);
		fitTextOnMiddleCanvasFunction(ctx, `CS ${beatmap.difficulty.size} | HP ${beatmap.difficulty.drain} | OD ${beatmap.difficulty.overall} | AR ${beatmap.difficulty.approach}`, 35, 'comfortaa, sans-serif', 800, canvas.width, 220);

		let today = new Date().toLocaleDateString();

		ctx.font = 'bold 15px comfortaa, sans-serif';
		ctx.fillStyle = '#ffffff';

		ctx.textAlign = 'right';
		ctx.fillText(`Made by Elitebotix on ${today}`, canvas.width - canvas.width / 140, canvas.height - 10);

		//Create as an attachment and return
		return new Discord.MessageAttachment(canvas.toBuffer(), `${stagename}.png`);
	}, pause(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},
	getAccuracy(score, mode) {
		return getAccuracyFunction(score, mode);
	},
	getIDFromPotentialOsuLink(link) {
		if (link.endsWith('/')) {
			link = link.substring(0, link.length - 1);
		}
		return link.replace(/.+\//g, '');
	},
	async populateMsgFromInteraction(interaction) {
		let userMentions = new Discord.Collection();
		let roleMentions = new Discord.Collection();
		let channelMentions = new Discord.Collection();

		if (interaction.options._hoistedOptions) {
			for (let i = 0; i < interaction.options._hoistedOptions.length; i++) {
				if (interaction.options._hoistedOptions[i].type === 'USER') {
					userMentions.set(interaction.options._hoistedOptions[i].user.id, interaction.options._hoistedOptions[i].user);
				} else if (interaction.options._hoistedOptions[i].value && interaction.options._hoistedOptions[i].type === 'STRING' && interaction.options._hoistedOptions[i].value.startsWith('<@') && interaction.options._hoistedOptions[i].value.endsWith('>')) {
					let user = await interaction.client.users.fetch(interaction.options._hoistedOptions[i].value.replace(/\D/g, ''));
					userMentions.set(user.id, user);
				} else if (interaction.options._hoistedOptions[i].type === 'ROLE') {
					roleMentions.set(interaction.options._hoistedOptions[i].role.id, interaction.options._hoistedOptions[i].role);
				} else if (interaction.options._hoistedOptions[i].type === 'CHANNEL') {
					channelMentions.set(interaction.options._hoistedOptions[i].channel.id, interaction.options._hoistedOptions[i].channel);
				}
			}
		}

		let mentions = {
			users: userMentions,
			roles: roleMentions,
			channels: channelMentions
		};

		let guildId = null;

		if (interaction.guild) {
			guildId = interaction.guild.id;
		}

		return {
			author: interaction.user,
			client: interaction.client,
			channel: interaction.channel,
			guild: interaction.guild,
			mentions: mentions,
			guildId: guildId
		};
	},
	async getOsuBeatmap(input) {
		return await getOsuBeatmapFunction(input);
	},
	async getUserDuelStarRating(input) {
		return await getUserDuelStarRatingFunction(input);
	},
	adjustHDStarRating(starRating, approachRate) {
		return adjustHDStarRatingFunction(starRating, approachRate);
	}
};

async function getUserDuelStarRatingFunction(input) {
	//Try to get it from tournament data if available
	let userScores;

	let endDate = new Date();
	if (input.date) {
		endDate = input.date;
	}

	let startDate = new Date(endDate);
	startDate.setUTCFullYear(endDate.getUTCFullYear() - 1);

	//Check if it is the last moment of a year
	let completeYear = false;
	if (endDate.getUTCDate() === 31
		&& endDate.getUTCMonth() === 11
		&& endDate.getUTCHours() === 23
		&& endDate.getUTCMinutes() === 59
		&& endDate.getUTCSeconds() === 59
		&& endDate.getUTCMilliseconds() === 999) {
		completeYear = true;
	}

	let duelRatings = {
		total: null,
		noMod: null,
		hidden: null,
		hardRock: null,
		doubleTime: null,
		freeMod: null,
		stepData: {
			NM: [],
			HD: [],
			HR: [],
			DT: [],
			FM: []
		},
		scores: {
			NM: [],
			HD: [],
			HR: [],
			DT: [],
			FM: []
		},
		provisional: false,
		outdated: false
	};

	let yearStats = null;
	if (completeYear) {
		yearStats = await DBDuelRatingHistory.findOne({
			where: {
				osuUserId: input.osuUserId,
				year: endDate.getUTCFullYear(),
				month: 12,
				date: 31
			}
		});

		let halfAYearAgo = new Date();
		halfAYearAgo.setUTCMonth(halfAYearAgo.getUTCMonth() - 6);

		if (yearStats && yearStats.updatedAt < halfAYearAgo) {
			await yearStats.destroy();
			yearStats = null;
		}
	}

	if (yearStats) {
		duelRatings.total = yearStats.osuDuelStarRating;
		duelRatings.noMod = yearStats.osuNoModDuelStarRating;
		duelRatings.hidden = yearStats.osuHiddenDuelStarRating;
		duelRatings.hardRock = yearStats.osuHardRockDuelStarRating;
		duelRatings.doubleTime = yearStats.osuDoubleTimeDuelStarRating;
		duelRatings.freeMod = yearStats.osuFreeModDuelStarRating;
		duelRatings.provisional = yearStats.osuDuelProvisional;
		duelRatings.outdated = yearStats.osuDuelOutdated;

		return duelRatings;
	}

	//Get the tournament data either limited by the date
	userScores = await DBOsuMultiScores.findAll({
		where: {
			osuUserId: input.osuUserId,
			tourneyMatch: true,
			scoringType: 'Score v2',
			mode: 'Standard',
			[Op.or]: [
				{ warmup: false },
				{ warmup: null }
			],
			[Op.and]: [
				{
					gameEndDate: {
						[Op.lte]: endDate
					}
				},
				{
					gameEndDate: {
						[Op.gte]: startDate
					}
				},
			]
		}
	});

	//Check for scores from the past half a year
	const lastHalfYear = new Date();
	lastHalfYear.setUTCMonth(lastHalfYear.getUTCMonth() - 6);

	const pastHalfYearScoreCount = await DBOsuMultiScores.count({
		where: {
			osuUserId: input.osuUserId,
			tourneyMatch: true,
			scoringType: 'Score v2',
			mode: 'Standard',
			gameEndDate: {
				[Op.gte]: lastHalfYear
			}
		}
	});

	let outdated = false;

	if (pastHalfYearScoreCount < 5) {
		outdated = true;
	}

	duelRatings.outdated = outdated;

	//Sort it by match ID
	quicksortMatchId(userScores);

	let scoresPerMod = 35;

	let modPools = ['NM', 'HD', 'HR', 'DT', 'FM'];

	//Loop through all modpools
	for (let modIndex = 0; modIndex < modPools.length; modIndex++) {
		//Get only unique maps for each modpool
		const checkedMapIds = [];
		const userMapIds = [];
		const userMaps = [];
		for (let i = 0; i < userScores.length; i++) {
			//Check if the map is already in; the score is above 10k and the map is not an aspire map
			if (checkedMapIds.indexOf(userScores[i].beatmapId) === -1 && parseInt(userScores[i].score) > 10000 && userScores[i].beatmapId !== '1033882' && userScores[i].beatmapId !== '529285') {
				checkedMapIds.push(userScores[i].beatmapId);
				if (getScoreModpoolFunction(userScores[i]) === modPools[modIndex]) {
					if (userMapIds.indexOf(userScores[i].beatmapId) === -1) {
						userMapIds.push(userScores[i].beatmapId);
						userMaps.push({ beatmapId: userScores[i].beatmapId, score: parseInt(userScores[i].score), matchId: userScores[i].matchId, matchName: userScores[i].matchName, matchStartDate: userScores[i].matchStartDate, modBits: parseInt(userScores[i].gameRawMods) + parseInt(userScores[i].rawMods) });
					}
				}
			}
		}

		//Group the maps into steps of 0.1 of difficulty
		const steps = [];
		const stepData = [];
		for (let i = 0; i < userMaps.length && i < scoresPerMod; i++) {
			//Get the most recent data
			let dbBeatmap = null;
			if (modPools[modIndex] === 'HR') {
				dbBeatmap = await getOsuBeatmapFunction({ beatmapId: userMaps[i].beatmapId, modBits: 16 });
			} else if (modPools[modIndex] === 'DT') {
				dbBeatmap = await getOsuBeatmapFunction({ beatmapId: userMaps[i].beatmapId, modBits: 64 });
			} else if (modPools[modIndex] === 'FM') {
				let mods = getModsFunction(userMaps[i].modBits);

				if (mods.includes('EZ')) {
					mods.splice(mods.indexOf('EZ'), 1);
				}

				if (mods.length === 0) {
					mods = 0;
				} else {
					mods = getModBitsFunction(mods.join(''));
				}

				dbBeatmap = await getOsuBeatmapFunction({ beatmapId: userMaps[i].beatmapId, modBits: mods });
			} else {
				dbBeatmap = await getOsuBeatmapFunction({ beatmapId: userMaps[i].beatmapId, modBits: 0 });
			}

			//Filter by ranked maps > 4*
			if (dbBeatmap && parseFloat(dbBeatmap.starRating) > 3.5 && (dbBeatmap.approvalStatus === 'Ranked' || dbBeatmap.approvalStatus === 'Approved')) {
				//Standardize the score from the mod multiplier
				if (modPools[modIndex] === 'HD') {
					userMaps[i].score = userMaps[i].score / 1.06;
				} else if (modPools[modIndex] === 'HR') {
					userMaps[i].score = userMaps[i].score / 1.1;
				} else if (modPools[modIndex] === 'DT') {
					userMaps[i].score = userMaps[i].score / 1.2;
				} else if (modPools[modIndex] === 'FM') {
					if (getModsFunction(userMaps[i].modBits).includes('HD')) {
						userMaps[i].score = userMaps[i].score / 1.06;
					}
					if (getModsFunction(userMaps[i].modBits).includes('HR')) {
						userMaps[i].score = userMaps[i].score / 1.1;
					}
					if (getModsFunction(userMaps[i].modBits).includes('FL')) {
						userMaps[i].score = userMaps[i].score / 1.12;
					}
					if (getModsFunction(userMaps[i].modBits).includes('DT')) {
						userMaps[i].score = userMaps[i].score / 1.2;
					}
					if (getModsFunction(userMaps[i].modBits).includes('EZ')) {
						userMaps[i].score = userMaps[i].score / 0.5;
					}
					if (getModsFunction(userMaps[i].modBits).includes('HT')) {
						userMaps[i].score = userMaps[i].score / 0.3;
					}
				}

				//Calculate the weights based on the graph below
				//https://www.desmos.com/calculator/wmdwcyfduw
				let c = 175000;
				let b = 2;
				let a = 0.7071;
				let overPerformWeight = (1 / (a * Math.sqrt(2))) * Math.E ** (-0.5 * Math.pow((((userMaps[i].score / c) - b) / a), 2));
				let underPerformWeight = (1 / (a * Math.sqrt(2))) * Math.E ** (-0.5 * Math.pow((((userMaps[i].score / c) - b) / a), 2));

				if (parseFloat(userMaps[i].score) > 350000) {
					overPerformWeight = 1;
				} else if (parseFloat(userMaps[i].score) < 350000) {
					underPerformWeight = 1;
				}

				userMaps[i].weight = Math.abs(overPerformWeight + underPerformWeight - 1);

				let mapStarRating = dbBeatmap.starRating;
				if (modPools[modIndex] === 'HD') {
					mapStarRating = adjustHDStarRatingFunction(dbBeatmap.starRating, dbBeatmap.approachRate);
				} else if (modPools[modIndex] === 'FM' && getModsFunction(dbBeatmap.mods).includes('HD') && !getModsFunction(dbBeatmap.mods).includes('DT')) {
					mapStarRating = adjustHDStarRatingFunction(dbBeatmap.starRating, dbBeatmap.approachRate);
				}

				userMaps[i].starRating = mapStarRating;

				//Add the map to the scores array
				if (modIndex === 0) {
					duelRatings.scores.NM.push(userMaps[i]);
				} else if (modIndex === 1) {
					duelRatings.scores.HD.push(userMaps[i]);
				} else if (modIndex === 2) {
					duelRatings.scores.HR.push(userMaps[i]);
				} else if (modIndex === 3) {
					duelRatings.scores.DT.push(userMaps[i]);
				} else if (modIndex === 4) {
					duelRatings.scores.FM.push(userMaps[i]);
				}

				//Add the data to the 5 steps in the area of the maps' star rating -> 5.0 will be representing 4.8, 4.9, 5.0, 5.1, 5.2
				for (let i = 0; i < 5; i++) {
					let starRatingStep = Math.round((Math.round(mapStarRating * 10) / 10 + 0.1 * i - 0.2) * 10) / 10;
					if (steps.indexOf(starRatingStep) === -1) {
						stepData.push({
							step: starRatingStep,
							totalOverPerformWeight: overPerformWeight,
							totalUnderPerformWeight: underPerformWeight,
							amount: 1,
							averageOverPerformWeight: overPerformWeight,
							averageUnderPerformWeight: underPerformWeight,
							averageWeight: Math.abs(((overPerformWeight + underPerformWeight) / 1) - 1),
							overPerformWeightedStarRating: (starRatingStep) * overPerformWeight,
							underPerformWeightedStarRating: (starRatingStep) * underPerformWeight,
							weightedStarRating: (starRatingStep) * Math.abs(((overPerformWeight + underPerformWeight) / 1) - 1),
						});
						steps.push(starRatingStep);
					} else {
						stepData[steps.indexOf(starRatingStep)].totalOverPerformWeight += overPerformWeight;
						stepData[steps.indexOf(starRatingStep)].totalUnderPerformWeight += underPerformWeight;
						stepData[steps.indexOf(starRatingStep)].amount++;
						stepData[steps.indexOf(starRatingStep)].averageOverPerformWeight = stepData[steps.indexOf(starRatingStep)].totalOverPerformWeight / stepData[steps.indexOf(starRatingStep)].amount;
						stepData[steps.indexOf(starRatingStep)].averageUnderPerformWeight = stepData[steps.indexOf(starRatingStep)].totalUnderPerformWeight / stepData[steps.indexOf(starRatingStep)].amount;
						stepData[steps.indexOf(starRatingStep)].averageWeight = Math.abs(stepData[steps.indexOf(starRatingStep)].averageOverPerformWeight + stepData[steps.indexOf(starRatingStep)].averageUnderPerformWeight - 1);
						stepData[steps.indexOf(starRatingStep)].overPerformWeightedStarRating = stepData[steps.indexOf(starRatingStep)].step * stepData[steps.indexOf(starRatingStep)].averageOverPerformWeight;
						stepData[steps.indexOf(starRatingStep)].underPerformWeightedStarRating = stepData[steps.indexOf(starRatingStep)].step * stepData[steps.indexOf(starRatingStep)].averageUnderPerformWeight;
						stepData[steps.indexOf(starRatingStep)].weightedStarRating = stepData[steps.indexOf(starRatingStep)].step * stepData[steps.indexOf(starRatingStep)].averageWeight;
					}
				}
			} else {
				userMaps.splice(i, 1);
				i--;
			}
		}

		//Calculated the starrating for the modpool
		let totalWeight = 0;
		let totalWeightedStarRating = 0;
		for (let i = 0; i < stepData.length; i++) {
			if (stepData[i].amount > 1) {
				totalWeight += stepData[i].averageWeight;
				totalWeightedStarRating += stepData[i].weightedStarRating;
			}
		}

		if (userMaps.length < 5) {
			duelRatings.provisional = true;
		}

		//add the values to the modpool data
		if (totalWeight > 0 && userMaps.length > 0) {
			let weightedStarRating = totalWeightedStarRating / totalWeight;

			for (let i = 0; i < scoresPerMod; i++) {
				weightedStarRating = applyOsuDuelStarratingCorrection(weightedStarRating, userMaps[i % userMaps.length], Math.round((1 - (i * 1 / scoresPerMod)) * 100) / 100);
			}

			if (modIndex === 0) {
				duelRatings.noMod = weightedStarRating;
				duelRatings.stepData.NM = stepData;
			} else if (modIndex === 1) {
				duelRatings.hidden = weightedStarRating;
				duelRatings.stepData.HD = stepData;
			} else if (modIndex === 2) {
				duelRatings.hardRock = weightedStarRating;
				duelRatings.stepData.HR = stepData;
			} else if (modIndex === 3) {
				duelRatings.doubleTime = weightedStarRating;
				duelRatings.stepData.DT = stepData;
			} else if (modIndex === 4) {
				duelRatings.freeMod = weightedStarRating;
				duelRatings.stepData.FM = stepData;
			}
		}
	}

	//Check the past year for individual ratings and limit a potential drop to .2
	let lastYearStats = await DBDuelRatingHistory.findOne({
		where: {
			osuUserId: input.osuUserId,
			year: endDate.getUTCFullYear() - 1,
			month: 12,
			date: 31
		}
	});

	let halfAYearAgo = new Date();
	halfAYearAgo.setUTCMonth(halfAYearAgo.getUTCMonth() - 6);

	if (lastYearStats && lastYearStats.updatedAt < halfAYearAgo) {
		await lastYearStats.destroy();
		lastYearStats = null;
	}

	if (!lastYearStats && (duelRatings.noMod > 0 || duelRatings.hidden > 0 || duelRatings.hardRock > 0 || duelRatings.doubleTime > 0 || duelRatings.freeMod > 0)) {
		let newEndDate = new Date(endDate);
		newEndDate.setUTCFullYear(newEndDate.getUTCFullYear() - 1);
		newEndDate.setUTCMonth(11);
		newEndDate.setUTCDate(31);
		newEndDate.setUTCHours(23);
		newEndDate.setUTCMinutes(59);
		newEndDate.setUTCSeconds(59);
		newEndDate.setUTCMilliseconds(999);

		let lastYearDuelRating = await getUserDuelStarRatingFunction({ osuUserId: input.osuUserId, client: input.client, date: newEndDate });

		lastYearStats = {
			osuUserId: input.osuUserId,
			osuDuelStarRating: lastYearDuelRating.total,
			osuNoModDuelStarRating: lastYearDuelRating.noMod,
			osuHiddenDuelStarRating: lastYearDuelRating.hidden,
			osuHardRockDuelStarRating: lastYearDuelRating.hardRock,
			osuDoubleTimeDuelStarRating: lastYearDuelRating.doubleTime,
			osuFreeModDuelStarRating: lastYearDuelRating.freeMod,
		};
	} else if (!lastYearStats) {
		lastYearStats = {
			osuUserId: input.osuUserId,
			osuDuelStarRating: null,
			osuNoModDuelStarRating: null,
			osuHiddenDuelStarRating: null,
			osuHardRockDuelStarRating: null,
			osuDoubleTimeDuelStarRating: null,
			osuFreeModDuelStarRating: null,
		};
	}

	//Get the modpool spread out of the past 100 user scores for the total value
	if (duelRatings.noMod || duelRatings.hidden || duelRatings.hardRock || duelRatings.doubleTime || duelRatings.freeMod) {

		if (lastYearStats && lastYearStats.osuNoModDuelStarRating && duelRatings.noMod < lastYearStats.osuNoModDuelStarRating - 0.2) {
			duelRatings.noMod = lastYearStats.osuNoModDuelStarRating - 0.2;
		}

		if (lastYearStats && lastYearStats.osuHiddenDuelStarRating && duelRatings.hidden < lastYearStats.osuHiddenDuelStarRating - 0.2) {
			duelRatings.hidden = lastYearStats.osuHiddenDuelStarRating - 0.2;
		}

		if (lastYearStats && lastYearStats.osuHardRockDuelStarRating && duelRatings.hardRock < lastYearStats.osuHardRockDuelStarRating - 0.2) {
			duelRatings.hardRock = lastYearStats.osuHardRockDuelStarRating - 0.2;
		}

		if (lastYearStats && lastYearStats.osuDoubleTimeDuelStarRating && duelRatings.doubleTime < lastYearStats.osuDoubleTimeDuelStarRating - 0.2) {
			duelRatings.doubleTime = lastYearStats.osuDoubleTimeDuelStarRating - 0.2;
		}

		if (lastYearStats && lastYearStats.osuFreeModDuelStarRating && duelRatings.freeMod < lastYearStats.osuFreeModDuelStarRating - 0.2) {
			duelRatings.freeMod = lastYearStats.osuFreeModDuelStarRating - 0.2;
		}

		//Get ratio of modPools played maps
		const modPoolAmounts = [0, 0, 0, 0, 0];
		for (let i = 0; i < userScores.length && i < 100; i++) {
			modPoolAmounts[modPools.indexOf(getScoreModpoolFunction(userScores[i]))]++;
		}

		if (duelRatings.noMod === null) {
			modPoolAmounts[0] = 0;
		}
		if (duelRatings.hidden === null) {
			modPoolAmounts[1] = 0;
		}
		if (duelRatings.hardRock === null) {
			modPoolAmounts[2] = 0;
		}
		if (duelRatings.doubleTime === null) {
			modPoolAmounts[3] = 0;
		}
		if (duelRatings.freeMod === null) {
			modPoolAmounts[4] = 0;
		}

		//Set total star rating based on the spread
		duelRatings.total = (duelRatings.noMod * modPoolAmounts[0] + duelRatings.hidden * modPoolAmounts[1] + duelRatings.hardRock * modPoolAmounts[2] + duelRatings.doubleTime * modPoolAmounts[3] + duelRatings.freeMod * modPoolAmounts[4]) / (modPoolAmounts[0] + modPoolAmounts[1] + modPoolAmounts[2] + modPoolAmounts[3] + modPoolAmounts[4]);

		if (completeYear && !yearStats) {
			//Create the yearStats if they don't exist
			await DBDuelRatingHistory.create({
				osuUserId: input.osuUserId,
				year: endDate.getUTCFullYear(),
				month: endDate.getUTCMonth() + 1,
				date: endDate.getUTCDate(),
				osuDuelStarRating: duelRatings.total,
				osuNoModDuelStarRating: duelRatings.noMod,
				osuHiddenDuelStarRating: duelRatings.hidden,
				osuHardRockDuelStarRating: duelRatings.hardRock,
				osuDoubleTimeDuelStarRating: duelRatings.doubleTime,
				osuFreeModDuelStarRating: duelRatings.freeMod,
				osuDuelProvisional: duelRatings.provisional,
				osuDuelOutdated: duelRatings.outdated,
			});

			let futurePossiblyAffectedDuelRatings = await DBDuelRatingHistory.findAll({
				where: {
					osuUserId: input.osuUserId,
					year: {
						[Op.gt]: endDate.getUTCFullYear()
					}
				}
			});

			for (let i = 0; i < futurePossiblyAffectedDuelRatings.length; i++) {
				await futurePossiblyAffectedDuelRatings[i].destroy();
			}
		}

		//Log the values in the discords if they changed and the user is connected to the bot
		let discordUser = await DBDiscordUsers.findOne({
			where: {
				osuUserId: input.osuUserId
			}
		});

		if (!discordUser) {
			discordUser = await DBDiscordUsers.create({ osuUserId: input.osuUserId });
		}

		if (discordUser && !input.date) {
			if (input.client) {
				try {
					let guildId = '727407178499096597';
					let channelId = '946150632128135239';
					// eslint-disable-next-line no-undef
					if (process.env.SERVER === 'Dev') {
						guildId = '800641468321759242';
						channelId = '946190123677126666';
						// eslint-disable-next-line no-undef
					} else if (process.env.SERVER === 'QA') {
						guildId = '800641367083974667';
						channelId = '946190678189293569';
					}
					const guild = await input.client.guilds.fetch(guildId);
					const channel = await guild.channels.fetch(channelId);
					let message = [`${discordUser.osuName} / ${discordUser.osuUserId}:`];
					if (Math.round(discordUser.osuDuelStarRating * 1000) / 1000 !== Math.round(duelRatings.total * 1000) / 1000) {
						message.push(`SR: ${Math.round(discordUser.osuDuelStarRating * 1000) / 1000} -> ${Math.round(duelRatings.total * 1000) / 1000}`);
						message.push(`Ratio: ${modPoolAmounts[0]} NM | ${modPoolAmounts[1]} HD | ${modPoolAmounts[2]} HR | ${modPoolAmounts[3]} DT | ${modPoolAmounts[4]} FM`);
					}
					if (Math.round(discordUser.osuNoModDuelStarRating * 1000) / 1000 !== Math.round(duelRatings.noMod * 1000) / 1000) {
						message.push(`NM: ${Math.round(discordUser.osuNoModDuelStarRating * 1000) / 1000} -> ${Math.round(duelRatings.noMod * 1000) / 1000}`);
					}
					if (Math.round(discordUser.osuHiddenDuelStarRating * 1000) / 1000 !== Math.round(duelRatings.hidden * 1000) / 1000) {
						message.push(`HD: ${Math.round(discordUser.osuHiddenDuelStarRating * 1000) / 1000} -> ${Math.round(duelRatings.hidden * 1000) / 1000}`);
					}
					if (Math.round(discordUser.osuHardRockDuelStarRating * 1000) / 1000 !== Math.round(duelRatings.hardRock * 1000) / 1000) {
						message.push(`HR: ${Math.round(discordUser.osuHardRockDuelStarRating * 1000) / 1000} -> ${Math.round(duelRatings.hardRock * 1000) / 1000}`);
					}
					if (Math.round(discordUser.osuDoubleTimeDuelStarRating * 1000) / 1000 !== Math.round(duelRatings.doubleTime * 1000) / 1000) {
						message.push(`DT: ${Math.round(discordUser.osuDoubleTimeDuelStarRating * 1000) / 1000} -> ${Math.round(duelRatings.doubleTime * 1000) / 1000}`);
					}
					if (Math.round(discordUser.osuFreeModDuelStarRating * 1000) / 1000 !== Math.round(duelRatings.freeMod * 1000) / 1000) {
						message.push(`FM: ${Math.round(discordUser.osuFreeModDuelStarRating * 1000) / 1000} -> ${Math.round(duelRatings.freeMod * 1000) / 1000}`);
					}
					if (discordUser.osuDuelProvisional !== duelRatings.provisional) {
						message.push(`Provisional: ${discordUser.osuDuelProvisional} -> ${duelRatings.provisional}`);
					}
					if (discordUser.osuDuelOutdated !== duelRatings.outdated) {
						message.push(`Outdated: ${discordUser.osuDuelOutdated} -> ${duelRatings.outdated}`);
					}

					let oldDerankStats = await getDerankStatsFunction(discordUser);
					//Setting the new values even tho it does that later just to get the new derank values
					discordUser.osuDuelStarRating = Math.round(duelRatings.total * 100000000000000) / 100000000000000;
					discordUser.osuNoModDuelStarRating = duelRatings.noMod;
					discordUser.osuHiddenDuelStarRating = duelRatings.hidden;
					discordUser.osuHardRockDuelStarRating = duelRatings.hardRock;
					discordUser.osuDoubleTimeDuelStarRating = duelRatings.doubleTime;
					discordUser.osuFreeModDuelStarRating = duelRatings.freeMod;
					discordUser.osuDuelProvisional = duelRatings.provisional;
					discordUser.osuDuelOutdated = duelRatings.outdated;
					let newDerankStats = await getDerankStatsFunction(discordUser);

					if (oldDerankStats.expectedPpRankOsu !== newDerankStats.expectedPpRankOsu) {
						message.push(`Deranked Rank change: #${oldDerankStats.expectedPpRankOsu} -> #${newDerankStats.expectedPpRankOsu} (${newDerankStats.expectedPpRankOsu - oldDerankStats.expectedPpRankOsu})`);
					}

					if (message.length > 1) {
						channel.send(`\`\`\`${message.join('\n')}\`\`\``);

						if (discordUser.osuDuelRatingUpdates) {
							const user = await input.client.users.fetch(discordUser.userId);
							if (user) {
								user.send(`Your duel ratings have been updated.\`\`\`${message.join('\n')}\`\`\``);
							}
						}
					}
				} catch (e) {
					console.log(e);
				}
			}

			discordUser.osuDuelStarRating = duelRatings.total;
			discordUser.osuNoModDuelStarRating = duelRatings.noMod;
			discordUser.osuHiddenDuelStarRating = duelRatings.hidden;
			discordUser.osuHardRockDuelStarRating = duelRatings.hardRock;
			discordUser.osuDoubleTimeDuelStarRating = duelRatings.doubleTime;
			discordUser.osuFreeModDuelStarRating = duelRatings.freeMod;
			discordUser.osuDuelProvisional = duelRatings.provisional;
			discordUser.osuDuelOutdated = duelRatings.outdated;
			await discordUser.save();
		}

		return duelRatings;
	}

	if (input.date) {
		return duelRatings;
	}

	duelRatings.provisional = true;

	//Get it from the top plays if no tournament data is available
	// eslint-disable-next-line no-undef
	const osuApi = new osu.Api(process.env.OSUTOKENV1, {
		// baseUrl: sets the base api url (default: https://osu.ppy.sh/api)
		notFoundAsError: true, // Throw an error on not found instead of returning nothing. (default: true)
		completeScores: false, // When fetching scores also fetch the beatmap they are for (Allows getting accuracy) (default: false)
		parseNumeric: false // Parse numeric values into numbers/floats, excluding ids
	});

	let topScores = null;

	for (let i = 0; i < 5 && !topScores; i++) {
		topScores = await osuApi.getUserBest({ u: input.osuUserId, m: 0, limit: 100 })
			.then((response) => {
				i = Infinity;
				return response;
			})
			.catch(async (err) => {
				if (i === 4) {
					if (err.message === 'Not found') {
						throw new Error('No standard plays');
					} else {
						console.log(err);
					}
				} else {
					await new Promise(resolve => setTimeout(resolve, 10000));
				}
			});
	}

	let stars = [];
	for (let i = 0; i < topScores.length; i++) {
		//Add difficulty ratings
		const dbBeatmap = await getOsuBeatmapFunction({ beatmapId: topScores[i].beatmapId, modBits: topScores[i].raw_mods });
		if (dbBeatmap && dbBeatmap.starRating && parseFloat(dbBeatmap.starRating) > 0) {
			stars.push(dbBeatmap.starRating);
		}
	}

	let averageStars = 0;
	for (let i = 0; i < stars.length; i++) {
		averageStars += parseFloat(stars[i]);
	}

	duelRatings.total = (averageStars / stars.length) * 0.9;
	duelRatings.noMod = null;
	duelRatings.hidden = null;
	duelRatings.hardRock = null;
	duelRatings.doubleTime = null;
	duelRatings.freeMod = null;

	let discordUser = await DBDiscordUsers.findOne({
		where: {
			osuUserId: input.osuUserId
		}
	});

	if (!discordUser) {
		discordUser = await DBDiscordUsers.create({ osuUserId: input.osuUserId });
	}

	if (discordUser) {
		discordUser.osuDuelStarRating = duelRatings.total;
		discordUser.osuNoModDuelStarRating = duelRatings.noMod;
		discordUser.osuHiddenDuelStarRating = duelRatings.hidden;
		discordUser.osuHardRockDuelStarRating = duelRatings.hardRock;
		discordUser.osuDoubleTimeDuelStarRating = duelRatings.doubleTime;
		discordUser.osuFreeModDuelStarRating = duelRatings.freeMod;
		await discordUser.save();
	}

	return duelRatings;
}

async function getDerankStatsFunction(discordUser) {
	let ppDiscordUsers = await DBDiscordUsers.findAll({
		where: {
			osuUserId: {
				[Op.gt]: 0
			},
			osuPP: {
				[Op.gt]: 0
			}
		},
		order: [
			['osuPP', 'DESC']
		]
	});

	quicksortOsuPP(ppDiscordUsers);

	let duelDiscordUsers = await DBDiscordUsers.findAll({
		where: {
			osuUserId: {
				[Op.gt]: 0
			},
			osuDuelStarRating: {
				[Op.gt]: 0
			}
		},
		order: [
			['osuDuelStarRating', 'DESC']
		]
	});

	let ppRank = null;

	for (let i = 0; i < ppDiscordUsers.length && !ppRank; i++) {
		if (parseFloat(discordUser.osuPP) >= parseFloat(ppDiscordUsers[i].osuPP)) {
			ppRank = i + 1;
		}
	}

	if (!ppRank) {
		ppRank = ppDiscordUsers.length + 1;
	}

	let duelRank = null;

	for (let i = 0; i < duelDiscordUsers.length && !duelRank; i++) {
		if (parseFloat(discordUser.osuDuelStarRating) >= parseFloat(duelDiscordUsers[i].osuDuelStarRating)) {
			duelRank = i + 1;
		}
	}

	if (!duelRank) {
		duelRank = duelDiscordUsers.length + 1;
	}

	if (!discordUser.userId) {
		ppDiscordUsers.length = ppDiscordUsers.length + 1;
		duelDiscordUsers.length = duelDiscordUsers.length + 1;
	}

	let expectedPpRank = Math.round(duelRank / duelDiscordUsers.length * ppDiscordUsers.length);


	let rankOffset = 0;

	if (!discordUser.userId && expectedPpRank > 1) {
		rankOffset = 1;
	}

	let expectedPpRankPercentageDifference = Math.round((100 / ppDiscordUsers.length * ppRank - 100 / ppDiscordUsers.length * expectedPpRank) * 100) / 100;

	let expectedPpRankOsu = ppDiscordUsers[expectedPpRank - 1 - rankOffset].osuRank;

	return {
		ppRank: ppRank,
		ppUsersLength: ppDiscordUsers.length,
		duelRank: duelRank,
		duelUsersLength: duelDiscordUsers.length,
		expectedPpRank: expectedPpRank,
		expectedPpRankPercentageDifference: expectedPpRankPercentageDifference,
		expectedPpRankOsu: expectedPpRankOsu
	};
}

function fitTextOnMiddleCanvasFunction(ctx, text, startingSize, fontface, yPosition, width, widthReduction) {

	// start with a large font size
	var fontsize = startingSize;

	// lower the font size until the text fits the canvas
	do {
		fontsize--;
		ctx.font = fontsize + 'px ' + fontface;
	} while (ctx.measureText(text).width > width - widthReduction);

	// draw the text
	ctx.textAlign = 'center';
	ctx.fillText(text, width / 2, yPosition);

	return fontsize;

}

async function getOsuBeatmapFunction(input) {
	let beatmapId = input.beatmapId;
	let modBits = 0;
	if (input.modBits) {
		modBits = input.modBits;
	}
	let forceUpdate = false;
	if (input.forceUpdate) {
		forceUpdate = true;
	}

	let lastRework = new Date();
	lastRework.setUTCFullYear(2021);
	lastRework.setUTCMonth(10);
	lastRework.setUTCDate(13);
	lastRework.setUTCHours(17);
	let lastWeek = new Date();
	lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);

	let dbBeatmap = null;

	//Repeat up to 3 times if errors appear
	for (let i = 0; i < 3; i++) {
		if (!dbBeatmap) {
			try {
				dbBeatmap = await DBOsuBeatmaps.findOne({
					where: { beatmapId: beatmapId, mods: modBits }
				});

				//Date of reworked DT, HT, EZ and HR values
				if (getModsFunction(modBits).includes('DT') || getModsFunction(modBits).includes('HT') || getModsFunction(modBits).includes('EZ') || getModsFunction(modBits).includes('HR')) {
					lastRework.setUTCFullYear(2022);
					lastRework.setUTCMonth(2);
					lastRework.setUTCDate(19);
				}

				if (!dbBeatmap
					|| forceUpdate
					|| dbBeatmap && dbBeatmap.updatedAt < lastRework //If reworked
					|| dbBeatmap && dbBeatmap.approvalStatus !== 'Ranked' && dbBeatmap.approvalStatus !== 'Approved' && (!dbBeatmap.updatedAt || dbBeatmap.updatedAt.getTime() < lastWeek.getTime()) //Update if old non-ranked map
					|| dbBeatmap && dbBeatmap.approvalStatus === 'Ranked' && dbBeatmap.approvalStatus === 'Approved' && (!dbBeatmap.starRating || !dbBeatmap.maxCombo || dbBeatmap.starRating == 0 || !dbBeatmap.mode)) { //Always update ranked maps if values are missing
					// eslint-disable-next-line no-undef
					const osuApi = new osu.Api(process.env.OSUTOKENV1, {
						// baseUrl: sets the base api url (default: https://osu.ppy.sh/api)
						notFoundAsError: true, // Throw an error on not found instead of returning nothing. (default: true)
						completeScores: false, // When fetching scores also fetch the beatmap they are for (Allows getting accuracy) (default: false)
						parseNumeric: false // Parse numeric values into numbers/floats, excluding ids
					});

					await osuApi.getBeatmaps({ b: beatmapId, mods: modBits })
						.then(async (beatmaps) => {
							let noVisualModBeatmap = beatmaps[0];
							if (getModsFunction(modBits).includes('MI') || getModsFunction(modBits).includes('HD') || getModsFunction(modBits).includes('FL') || getModsFunction(modBits).includes('FI') || getModsFunction(modBits).includes('NF') || getModsFunction(modBits).includes('NC') || getModsFunction(modBits).includes('PF') || getModsFunction(modBits).includes('SD')) {
								let realNoVisualModBeatmap = await getOsuBeatmapFunction({ beatmapId: beatmapId, modBits: getModBitsFunction(getModsFunction(modBits).join(''), true) });
								noVisualModBeatmap.difficulty.rating = realNoVisualModBeatmap.starRating;
								noVisualModBeatmap.difficulty.aim = realNoVisualModBeatmap.aimRating;
								noVisualModBeatmap.difficulty.speed = realNoVisualModBeatmap.speedRating;
								noVisualModBeatmap.maxCombo = realNoVisualModBeatmap.maxCombo;
							}

							//Recalculate bpm for HT and DT
							let bpm = beatmaps[0].bpm;
							let cs = beatmaps[0].difficulty.size;
							let ar = beatmaps[0].difficulty.approach;
							let od = beatmaps[0].difficulty.overall;
							let hpDrain = beatmaps[0].difficulty.drain;
							let drainLength = beatmaps[0].length.drain;
							let totalLength = beatmaps[0].length.total;

							if (getModsFunction(modBits).includes('DT') || getModsFunction(modBits).includes('NC')) {
								bpm = parseFloat(beatmaps[0].bpm) * 1.5;
								drainLength = parseFloat(beatmaps[0].length.drain) / 1.5;
								totalLength = parseFloat(beatmaps[0].length.total) / 1.5;
							} else if (getModsFunction(modBits).includes('HT')) {
								bpm = parseFloat(beatmaps[0].bpm) * 0.75;
								drainLength = parseFloat(beatmaps[0].length.drain) / 0.75;
								totalLength = parseFloat(beatmaps[0].length.total) / 0.75;
							}

							//HR
							if (getModsFunction(modBits).includes('HR')) {
								cs = parseFloat(beatmaps[0].difficulty.size) * 1.3;
								ar = parseFloat(beatmaps[0].difficulty.approach) * 1.4;
								od = parseFloat(beatmaps[0].difficulty.overall) * 1.4;
								hpDrain = parseFloat(beatmaps[0].difficulty.drain) * 1.4;
							}

							//EZ
							if (getModsFunction(modBits).includes('EZ')) {
								cs = parseFloat(beatmaps[0].difficulty.size) / 2;
								ar = parseFloat(beatmaps[0].difficulty.approach) / 2;
								od = parseFloat(beatmaps[0].difficulty.overall) / 2;
								hpDrain = parseFloat(beatmaps[0].difficulty.drain) / 2;
							}

							cs = Math.min(Math.round(cs * 100) / 100, 10);
							ar = Math.min(Math.round(ar * 100) / 100, 10);
							od = Math.min(Math.round(od * 100) / 100, 10);
							hpDrain = Math.min(Math.round(hpDrain * 100) / 100, 10);

							//Map has to be updated
							if (dbBeatmap) {
								dbBeatmap.title = beatmaps[0].title;
								dbBeatmap.artist = beatmaps[0].artist;
								dbBeatmap.difficulty = beatmaps[0].version;
								dbBeatmap.starRating = noVisualModBeatmap.difficulty.rating;
								dbBeatmap.aimRating = noVisualModBeatmap.difficulty.aim;
								dbBeatmap.speedRating = noVisualModBeatmap.difficulty.speed;
								dbBeatmap.drainLength = drainLength;
								dbBeatmap.totalLength = totalLength;
								dbBeatmap.circleSize = cs;
								dbBeatmap.approachRate = ar;
								dbBeatmap.overallDifficulty = od;
								dbBeatmap.hpDrain = hpDrain;
								dbBeatmap.mapper = beatmaps[0].creator;
								dbBeatmap.beatmapsetId = beatmaps[0].beatmapSetId;
								dbBeatmap.bpm = bpm;
								dbBeatmap.mode = beatmaps[0].mode;
								dbBeatmap.approvalStatus = beatmaps[0].approvalStatus;
								dbBeatmap.maxCombo = noVisualModBeatmap.maxCombo;
								dbBeatmap.circles = beatmaps[0].objects.normal;
								dbBeatmap.sliders = beatmaps[0].objects.slider;
								dbBeatmap.spinners = beatmaps[0].objects.spinner;
								dbBeatmap.mods = modBits;
								dbBeatmap.userRating = beatmaps[0].rating;
								await dbBeatmap.save();
							} else { // Map has to be added new
								//Get the tourney map flags
								let tourneyMap = false;
								let noModMap = false;
								let hiddenMap = false;
								let hardRockMap = false;
								let doubleTimeMap = false;
								let freeModMap = false;

								let tourneyScores = await DBOsuMultiScores.findAll({
									where: {
										beatmapId: beatmaps[0].id,
										tourneyMatch: true,
										matchName: {
											[Op.notLike]: 'MOTD:%',
										},
										[Op.or]: [
											{ warmup: false },
											{ warmup: null }
										],
									}
								});

								if (tourneyScores.length > 0) {
									tourneyMap = true;
								}

								for (let i = 0; i < tourneyScores.length; i++) {
									if (getScoreModpoolFunction(tourneyScores[i]) === 'NM') {
										noModMap = true;
									} else if (getScoreModpoolFunction(tourneyScores[i]) === 'HD') {
										hiddenMap = true;
									} else if (getScoreModpoolFunction(tourneyScores[i]) === 'HR') {
										hardRockMap = true;
									} else if (getScoreModpoolFunction(tourneyScores[i]) === 'DT') {
										doubleTimeMap = true;
									} else if (getScoreModpoolFunction(tourneyScores[i]) === 'FM') {
										freeModMap = true;
									}
								}

								dbBeatmap = await DBOsuBeatmaps.create({
									title: beatmaps[0].title,
									artist: beatmaps[0].artist,
									difficulty: beatmaps[0].version,
									starRating: noVisualModBeatmap.difficulty.rating,
									aimRating: noVisualModBeatmap.difficulty.aim,
									speedRating: noVisualModBeatmap.difficulty.speed,
									drainLength: drainLength,
									totalLength: totalLength,
									circleSize: cs,
									approachRate: ar,
									overallDifficulty: od,
									hpDrain: hpDrain,
									mapper: beatmaps[0].creator,
									beatmapId: beatmaps[0].id,
									beatmapsetId: beatmaps[0].beatmapSetId,
									bpm: bpm,
									mode: beatmaps[0].mode,
									approvalStatus: beatmaps[0].approvalStatus,
									maxCombo: noVisualModBeatmap.maxCombo,
									circles: beatmaps[0].objects.normal,
									sliders: beatmaps[0].objects.slider,
									spinners: beatmaps[0].objects.spinner,
									mods: modBits,
									userRating: beatmaps[0].rating,
									tourneyMap: tourneyMap,
									noModMap: noModMap,
									hiddenMap: hiddenMap,
									hardRockMap: hardRockMap,
									doubleTimeMap: doubleTimeMap,
									freeModMap: freeModMap,
								});
							}
						})
						.catch(async (error) => {
							//Nothing
							//Map is already saved; Delay next check until 7 days
							if (dbBeatmap) {
								dbBeatmap.approvalStatus = 'Not found';
								await dbBeatmap.save();
							} else if (error.message === 'Not found') { // Map has to be added new
								dbBeatmap = await DBOsuBeatmaps.create({
									beatmapId: beatmapId,
									approvalStatus: 'Not found',
									mods: modBits,
									starRating: 0,
									maxCombo: 0,
								});
							}
						});
				}

				i = Infinity;
			} catch (e) {
				if (i < 2) {
					dbBeatmap = null;
				}
			}
		}
	}

	if (dbBeatmap && dbBeatmap.approvalStatus === 'Not found') {
		return null;
	}

	return dbBeatmap;
}

function getModBitsFunction(input, noVisualMods) {
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
		} else if (input.substring(i, i + 2) === 'FL' && !noVisualMods) {
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
		} else if (input.substring(i, i + 2) === 'HD' && !noVisualMods) {
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

function getModsFunction(input) {
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

function getScoreModpoolFunction(dbScore) {
	//Evaluate with which mods the game was played
	if (!dbScore.freeMod && dbScore.rawMods === '0' && (dbScore.gameRawMods === '0' || dbScore.gameRawMods === '1')) {
		return 'NM';
	} else if (!dbScore.freeMod && dbScore.rawMods === '0' && (dbScore.gameRawMods === '8' || dbScore.gameRawMods === '9')) {
		return 'HD';
	} else if (!dbScore.freeMod && dbScore.rawMods === '0' && (dbScore.gameRawMods === '16' || dbScore.gameRawMods === '17')) {
		return 'HR';
	} else if (!dbScore.freeMod && dbScore.rawMods === '0' && (dbScore.gameRawMods === '64' || dbScore.gameRawMods === '65' || dbScore.gameRawMods === '576' || dbScore.gameRawMods === '577')) {
		return 'DT';
	} else {
		return 'FM';
	}
}

function partitionMatchId(list, start, end) {
	const pivot = list[end];
	let i = start;
	for (let j = start; j < end; j += 1) {
		if (parseInt(list[j].matchId) >= parseInt(pivot.matchId)) {
			[list[j], list[i]] = [list[i], list[j]];
			i++;
		}
	}
	[list[i], list[end]] = [list[end], list[i]];
	return i;
}

function quicksortMatchId(list, start = 0, end = undefined) {
	if (end === undefined) {
		end = list.length - 1;
	}
	if (start < end) {
		const p = partitionMatchId(list, start, end);
		quicksortMatchId(list, start, p - 1);
		quicksortMatchId(list, p + 1, end);
	}
	return list;
}

function applyOsuDuelStarratingCorrection(rating, score, weight) {
	//Get the expected score for the starrating
	//https://www.desmos.com/calculator/oae69zr9ze
	const a = 120000;
	const b = -1.67;
	const c = 20000;
	let expectedScore = a * Math.pow(parseFloat(score.starRating) + (b - rating), 2) + c;

	//Set the score to the lowest expected of c if a really high starrating occurs
	if (parseFloat(score.starRating) > Math.abs(b - rating)) {
		expectedScore = c;
	} else if (expectedScore > 950000) {
		expectedScore = 950000;
	}

	//Get the difference to the actual score
	let scoreDifference = score.score - expectedScore;

	if (score.score > 950000) {
		scoreDifference = 0;
	}

	//Get the star rating change by the difference
	//https://www.desmos.com/calculator/zlckiq6hgx
	const z = 0.000000000000000005;
	let starRatingChange = z * Math.pow(scoreDifference, 3);

	if (starRatingChange > 1) {
		starRatingChange = 1;
	} else if (starRatingChange < -1) {
		starRatingChange = -1;
	}

	//Get the new rating
	const newRating = rating + (starRatingChange * weight);

	return newRating;
}

function adjustHDStarRatingFunction(starRating, approachRate) {

	//Adapt starRating from 0.2 to 0.75 depending on the AR for the HD modpool only
	approachRate = parseFloat(approachRate);
	if (approachRate < 7.5) {
		approachRate = 7.5;
	} else if (approachRate > 9) {
		approachRate = 9;
	}

	let starRatingAdjust = (0.55 / 1.5 * Math.abs(approachRate - 9)) + 0.2;

	return parseFloat(starRating) + starRatingAdjust;
}

function getAccuracyFunction(score, mode) {
	let accuracy = ((score.counts[300] * 100 + score.counts[100] * 33.33 + score.counts[50] * 16.67) / (parseInt(score.counts[300]) + parseInt(score.counts[100]) + parseInt(score.counts[50]) + parseInt(score.counts.miss))) / 100;

	if (mode === 1) {
		accuracy = (parseInt(score.counts[300]) + parseInt(score.counts[100] * 0.5)) / (parseInt(score.counts[300]) + parseInt(score.counts[100]) + parseInt(score.counts[50]) + parseInt(score.counts.miss));
	} else if (mode === 2) {
		let objects = parseInt(score.counts[300]) + parseInt(score.counts[50]) + parseInt(score.counts.miss);
		accuracy = (objects / (objects + parseInt(score.counts.katu) + parseInt(score.counts.miss)));
	} else if (mode === 3) {
		accuracy = (50 * parseInt(score.counts[50]) + 100 * parseInt(score.counts[100]) + 200 * parseInt(score.counts.katu) + 300 * (parseInt(score.counts[300]) + parseInt(score.counts.geki))) / (300 * (parseInt(score.counts.miss) + parseInt(score.counts[50]) + parseInt(score.counts[100]) + parseInt(score.counts.katu) + parseInt(score.counts[300]) + parseInt(score.counts.geki)));
	}

	return accuracy;
}

function partitionOsuPP(list, start, end) {
	const pivot = list[end];
	let i = start;
	for (let j = start; j < end; j += 1) {
		if (parseFloat(list[j].osuPP) >= parseFloat(pivot.osuPP)) {
			[list[j], list[i]] = [list[i], list[j]];
			i++;
		}
	}
	[list[i], list[end]] = [list[end], list[i]];
	return i;
}

function quicksortOsuPP(list, start = 0, end = undefined) {
	if (end === undefined) {
		end = list.length - 1;
	}
	if (start < end) {
		const p = partitionOsuPP(list, start, end);
		quicksortOsuPP(list, start, p - 1);
		quicksortOsuPP(list, p + 1, end);
	}
	return list;
}