const { DBDiscordUsers, DBOsuMultiScores, DBOsuBeatmaps } = require('../dbObjects');
const osu = require('node-osu');
const { getOsuBeatmap, getOsuUserServerMode, populateMsgFromInteraction, pause, getUserDuelStarRating, adjustHDStarRating, humanReadable } = require('../utils');
const { Permissions } = require('discord.js');
const { Op } = require('sequelize');

module.exports = {
	name: 'osu-duel',
	aliases: ['osu-quickmatch'],
	description: 'Lets you play a match which is being reffed by the bot',
	// usage: '[username] [username] ... (Use `_` instead of spaces; Use `--b` for bancho / `--r` for ripple; Use `--s`/`--t`/`--c`/`--m` for modes)',
	// permissions: Permissions.FLAGS.MANAGE_GUILD,
	// permissionsTranslated: 'Manage Server',
	botPermissions: Permissions.FLAGS.SEND_MESSAGES,
	botPermissionsTranslated: 'Send Messages',
	// guildOnly: true,
	//args: true,
	cooldown: 60,
	//noCooldownMessage: true,
	tags: 'osu',
	prefixCommand: true,
	async execute(msg, args, interaction, additionalObjects) {
		if (msg) {
			return msg.reply('Please use the / command `/osu-duel`');
		}
		if (interaction) {
			if (interaction.options._subcommand === 'match1v1' || interaction.options._subcommand === 'match2v2') {
				await interaction.deferReply();
				//Get the star ratings for both users
				msg = await populateMsgFromInteraction(interaction);

				let opponentId = null;
				let teammateId = null;
				let firstOpponentId = null;
				let secondOpponentId = null;
				let averageStarRating = null;
				let onlyRanked = false;

				for (let i = 0; i < interaction.options._hoistedOptions.length; i++) {
					if (interaction.options._hoistedOptions[i].name === 'opponent') {
						opponentId = interaction.options._hoistedOptions[i].value;
					} else if (interaction.options._hoistedOptions[i].name === 'starrating') {
						averageStarRating = interaction.options._hoistedOptions[i].value;

						if (averageStarRating < 3) {
							return await interaction.editReply('You can\'t play a match with a star rating lower than 3');
						} else if (averageStarRating > 10) {
							return await interaction.editReply('You can\'t play a match with a star rating higher than 10');
						}
					} else if (interaction.options._hoistedOptions[i].name === 'ranked' && interaction.options._hoistedOptions[i].value === true) {
						onlyRanked = true;
					} else if (interaction.options._hoistedOptions[i].name === 'teammate') {
						teammateId = interaction.options._hoistedOptions[i].value;
					} else if (interaction.options._hoistedOptions[i].name === 'firstopponent') {
						firstOpponentId = interaction.options._hoistedOptions[i].value;
					} else if (interaction.options._hoistedOptions[i].name === 'secondopponent') {
						secondOpponentId = interaction.options._hoistedOptions[i].value;
					}
				}

				const commandConfig = await getOsuUserServerMode(msg, []);
				const commandUser = commandConfig[0];

				if (!commandUser || !commandUser.osuUserId || !commandUser.osuVerified) {
					return await interaction.editReply('You don\'t have your osu! account connected and verified.\nPlease connect your account by using `/osu-link connect <username>`.');
				}

				if (opponentId && commandUser.userId === opponentId || firstOpponentId && commandUser.userId === firstOpponentId || secondOpponentId && commandUser.userId === secondOpponentId) {
					return await interaction.editReply('You cannot play against yourself.');
				}

				if (teammateId && commandUser.userId === teammateId) {
					return await interaction.editReply('You cannot team up with yourself.');
				}

				if (teammateId && firstOpponentId && teammateId === firstOpponentId || teammateId && secondOpponentId && teammateId === secondOpponentId) {
					return await interaction.editReply('Your teammate can\t also be an opponent.');
				}

				if (firstOpponentId && secondOpponentId && firstOpponentId === secondOpponentId) {
					return await interaction.editReply('You have to choose two different opponents.');
				}

				let ownStarRating = 4;
				try {
					ownStarRating = await getUserDuelStarRating({ osuUserId: commandUser.osuUserId, client: interaction.client });
				} catch (e) {
					if (e !== 'No standard plays') {
						console.log(e);
					}
				}

				let secondStarRating = 4;
				let secondUser = null;
				if (opponentId) {
					secondUser = await DBDiscordUsers.findOne({
						where: {
							userId: opponentId,
							osuVerified: true
						}
					});

					if (secondUser && secondUser.osuUserId) {
						try {
							secondStarRating = await getUserDuelStarRating({ osuUserId: secondUser.osuUserId, client: interaction.client });
						} catch (e) {
							if (e !== 'No standard plays') {
								console.log(e);
							}
						}
					} else {
						return await interaction.editReply(`<@${opponentId}> doesn't have their osu! account connected and verified.\nPlease have them connect their account by using \`/osu-link connect <username>\`.`);
					}
				} else {
					secondUser = await DBDiscordUsers.findOne({
						where: {
							userId: teammateId,
							osuVerified: true
						}
					});

					if (secondUser && secondUser.osuUserId) {
						try {
							secondStarRating = await getUserDuelStarRating({ osuUserId: secondUser.osuUserId, client: interaction.client });
						} catch (e) {
							if (e !== 'No standard plays') {
								console.log(e);
							}
						}
					} else {
						return await interaction.editReply(`<@${teammateId}> doesn't have their osu! account connected and verified.\nPlease have them connect their account by using \`/osu-link connect <username>\`.`);
					}
				}

				let thirdUser = null;
				let thirdStarRating = 4;
				if (firstOpponentId) {
					thirdUser = await DBDiscordUsers.findOne({
						where: {
							userId: firstOpponentId,
							osuVerified: true
						}
					});

					if (thirdUser && thirdUser.osuUserId) {
						try {
							thirdStarRating = await getUserDuelStarRating({ osuUserId: thirdUser.osuUserId, client: interaction.client });
						} catch (e) {
							if (e !== 'No standard plays') {
								console.log(e);
							}
						}
					} else {
						return await interaction.editReply(`<@${firstOpponentId}> doesn't have their osu! account connected and verified.\nPlease have them connect their account by using \`/osu-link connect <username>\`.`);
					}
				}

				let fourthUser = null;
				let fourthStarRating = 4;
				if (secondOpponentId) {
					fourthUser = await DBDiscordUsers.findOne({
						where: {
							userId: secondOpponentId,
							osuVerified: true
						}
					});

					if (fourthUser && fourthUser.osuUserId) {
						try {
							fourthStarRating = await getUserDuelStarRating({ osuUserId: fourthUser.osuUserId, client: interaction.client });
						} catch (e) {
							if (e !== 'No standard plays') {
								console.log(e);
							}
						}
					} else {
						return await interaction.editReply(`<@${secondOpponentId}> doesn't have their osu! account connected and verified.\nPlease have them connect their account by using \`/osu-link connect <username>\`.`);
					}
				}

				if (!averageStarRating) {
					if (opponentId) {
						averageStarRating = (ownStarRating.total + secondStarRating.total) / 2;
					} else {
						averageStarRating = (ownStarRating.total + secondStarRating.total + thirdStarRating.total + fourthStarRating.total) / 4;
					}
				}

				let lowerBound = averageStarRating - 0.125;
				let upperBound = averageStarRating + 0.125;

				if (opponentId) {
					let sentMessage = await interaction.editReply(`<@${secondUser.userId}>, you were challenged to a duel by <@${commandUser.userId}>. (SR: ${Math.round(averageStarRating * 100) / 100}*)\nReact with ✅ to accept.\nReact with ❌ to decline.`);

					let pingMessage = await interaction.channel.send(`<@${secondUser.userId}>`);
					await sentMessage.react('✅');
					await sentMessage.react('❌');
					pingMessage.delete();
					//Await for the user to react with a checkmark
					const filter = (reaction, user) => {
						return ['✅', '❌'].includes(reaction.emoji.name) && user.id === secondUser.userId;
					};

					let responded = await sentMessage.awaitReactions({ filter, max: 1, time: 120000, errors: ['time'] })
						.then(collected => {
							const reaction = collected.first();

							if (reaction.emoji.name === '✅') {
								return true;
							} else {
								return false;
							}
						})
						.catch(() => {
							return false;
						});

					sentMessage.reactions.removeAll().catch(() => { });

					if (!responded) {
						return await interaction.editReply(`<@${secondUser.userId}> declined or didn't respond in time.`);
					}
				} else {
					let sentMessage = await interaction.editReply(`<@${commandUser.userId}> wants to play a match with <@${secondUser.userId}> against <@${thirdUser.userId}> and <@${fourthUser.userId}>. (SR: ${Math.round(averageStarRating * 100) / 100}*)\nReact with ✅ to accept.\nReact with ❌ to decline.`);

					let pingMessage = await interaction.channel.send(`<@${secondUser.userId}>, <@${thirdUser.userId}>, <@${fourthUser.userId}>`);
					await sentMessage.react('✅');
					await sentMessage.react('❌');
					pingMessage.delete();

					let responded = false;
					let accepted = [];
					let declined = false;
					let decliner = null;

					const collector = sentMessage.createReactionCollector({ time: 120000 });

					collector.on('collect', (reaction, user) => {
						if (reaction.emoji.name === '✅' && [secondUser.userId, thirdUser.userId, fourthUser.userId].includes(user.id)) {
							if (!accepted.includes(user.id)) {
								accepted.push(user.id);

								if (accepted.length === 3) {
									collector.stop();
								}
							}
						} else if (reaction.emoji.name === '❌' && [secondUser.userId, thirdUser.userId, fourthUser.userId].includes(user.id)) {
							decliner = user.id;
							collector.stop();
						}
					});

					collector.on('end', () => {
						if (accepted.length < 3) {
							declined = true;
						}
						responded = true;
					});

					while (!responded) {
						await pause(1000);
					}

					sentMessage.reactions.removeAll().catch(() => { });

					if (declined) {
						if (decliner) {
							return await interaction.editReply(`<@${decliner}> declined.`);
						} else {
							return await interaction.editReply('Someone didn\'t respond in time.');
						}
					}
				}

				await interaction.editReply('Duel has been accepted. Creating pool and lobby...');

				//Set up the mappools
				let dbMaps = [];
				let dbMapIds = [];

				// Set up the modpools
				let modPools = ['NM', 'HD', 'HR', 'DT', 'FM'];
				shuffle(modPools);
				modPools.push('NM', 'FM');

				const player1Scores = await DBOsuMultiScores.findAll({
					where: {
						osuUserId: commandUser.osuUserId,
						tourneyMatch: true,
						matchName: {
							[Op.notLike]: 'MOTD:%',
						},
						mode: 'Standard',
						[Op.or]: [
							{ warmup: false },
							{ warmup: null }
						],
					}
				});

				for (let i = 0; i < player1Scores.length; i++) {
					player1Scores[i] = player1Scores[i].beatmapId;
				}

				const player2Scores = await DBOsuMultiScores.findAll({
					where: {
						osuUserId: secondUser.osuUserId,
						tourneyMatch: true,
						matchName: {
							[Op.notLike]: 'MOTD:%',
						},
						mode: 'Standard',
						[Op.or]: [
							{ warmup: false },
							{ warmup: null }
						],
					}
				});

				for (let i = 0; i < player2Scores.length; i++) {
					player2Scores[i] = player2Scores[i].beatmapId;
				}

				let player3Scores = null;
				let player4Scores = null;

				if (thirdUser) {
					player3Scores = await DBOsuMultiScores.findAll({
						where: {
							osuUserId: thirdUser.osuUserId,
							tourneyMatch: true,
							matchName: {
								[Op.notLike]: 'MOTD:%',
							},
							mode: 'Standard',
							[Op.or]: [
								{ warmup: false },
								{ warmup: null }
							],
						}
					});

					for (let i = 0; i < player3Scores.length; i++) {
						player3Scores[i] = player3Scores[i].beatmapId;
					}

					player4Scores = await DBOsuMultiScores.findAll({
						where: {
							osuUserId: fourthUser.osuUserId,
							tourneyMatch: true,
							matchName: {
								[Op.notLike]: 'MOTD:%',
							},
							mode: 'Standard',
							[Op.or]: [
								{ warmup: false },
								{ warmup: null }
							],
						}
					});

					for (let i = 0; i < player4Scores.length; i++) {
						player4Scores[i] = player4Scores[i].beatmapId;
					}
				}

				//Get the map for each modpool; limited by drain time, star rating and both players either having played or not played it
				for (let i = 0; i < modPools.length; i++) {
					let dbBeatmap = null;
					let beatmaps = null;

					if (i === 6) {
						console.log('Duel Match: Get all TB Beatmaps');
						if (opponentId) {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									[Op.or]: {
										noModMap: true,
										freeModMap: true,
									},
									drainLength: {
										[Op.and]: {
											[Op.gte]: 270,
											[Op.lte]: 360,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
											},
										}
									},
									circleSize: {
										[Op.lte]: 5,
									},
									approachRate: {
										[Op.gte]: 8,
									},
								}
							});
						} else {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									[Op.or]: {
										noModMap: true,
										freeModMap: true,
									},
									drainLength: {
										[Op.and]: {
											[Op.gte]: 270,
											[Op.lte]: 360,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
												[Op.in]: player3Scores,
												[Op.in]: player4Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
												[Op.notIn]: player3Scores,
												[Op.notIn]: player4Scores,
											},
										}
									},
									circleSize: {
										[Op.lte]: 5,
									},
									approachRate: {
										[Op.gte]: 8,
									},
								}
							});
						}
						console.log('Duel Match: Grabbed all TB Beatmaps');
					} else if (modPools[i] === 'NM') {
						console.log('Duel Match: Get all NM Beatmaps');
						if (opponentId) {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									noModMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
											},
										}
									},
								}
							});
						} else {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									noModMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
												[Op.in]: player3Scores,
												[Op.in]: player4Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
												[Op.notIn]: player3Scores,
												[Op.notIn]: player4Scores,
											},
										}
									},
								}
							});
						}
						console.log('Duel Match: Grabbed all NM Beatmaps');
					} else if (modPools[i] === 'HD') {
						console.log('Duel Match: Get all HD Beatmaps');
						let HDLowerBound = lowerBound - 0.8;
						let HDUpperBound = upperBound - 0.15;
						if (opponentId) {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									hiddenMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: HDLowerBound,
											[Op.lte]: HDUpperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
											},
										}
									},
								}
							});
						} else {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									hiddenMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: HDLowerBound,
											[Op.lte]: HDUpperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
												[Op.in]: player3Scores,
												[Op.in]: player4Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
												[Op.notIn]: player3Scores,
												[Op.notIn]: player4Scores,
											},
										}
									},
								}
							});
						}
						console.log('Duel Match: Grabbed all HD Beatmaps');
					} else if (modPools[i] === 'HR') {
						console.log('Duel Match: Get all HR Beatmaps');
						if (opponentId) {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									hardRockMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
											},
										}
									},
								}
							});
						} else {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									hardRockMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
												[Op.in]: player3Scores,
												[Op.in]: player4Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
												[Op.notIn]: player3Scores,
												[Op.notIn]: player4Scores,
											},
										}
									},
								}
							});
						}
						console.log('Duel Match: Grabbed all HR Beatmaps');
					} else if (modPools[i] === 'DT') {
						console.log('Duel Match: Get all DT Beatmaps');
						if (opponentId) {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									doubleTimeMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 120,
											[Op.lte]: 405,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
											},
										}
									},
								}
							});
						} else {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									doubleTimeMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 120,
											[Op.lte]: 405,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
												[Op.in]: player3Scores,
												[Op.in]: player4Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
												[Op.notIn]: player3Scores,
												[Op.notIn]: player4Scores,
											},
										}
									},
								}
							});
						}
						console.log('Duel Match: Grabbed all DT Beatmaps');
					} else if (modPools[i] === 'FM') {
						console.log('Duel Match: Get all FM Beatmaps');
						if (opponentId) {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									freeModMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
											},
										}
									},
								}
							});
						} else {
							beatmaps = await DBOsuBeatmaps.findAll({
								where: {
									mode: 'Standard',
									approvalStatus: {
										[Op.not]: 'Not found',
									},
									freeModMap: true,
									drainLength: {
										[Op.and]: {
											[Op.gte]: 100,
											[Op.lte]: 270,
										}
									},
									starRating: {
										[Op.and]: {
											[Op.gte]: lowerBound,
											[Op.lte]: upperBound,
										}
									},
									beatmapId: {
										[Op.or]: {
											[Op.and]: {
												[Op.in]: player1Scores,
												[Op.in]: player2Scores,
												[Op.in]: player3Scores,
												[Op.in]: player4Scores,
											},
											[Op.and]: {
												[Op.notIn]: player1Scores,
												[Op.notIn]: player2Scores,
												[Op.notIn]: player3Scores,
												[Op.notIn]: player4Scores,
											},
										}
									},
								}
							});
						}
						console.log('Duel Match: Grabbed all FM Beatmaps');
					}

					while (dbBeatmap === null) {
						const index = Math.floor(Math.random() * beatmaps.length);

						if (!beatmaps.length) {
							console.log('Duel Match: No more maps left to choose from');
							if (opponentId) {
								return await interaction.editReply(`<@${commandUser.userId}>, <@${secondUser.userId}> the bot could not find enough viable maps with this criteria. (SR: ${Math.round(averageStarRating * 100) / 100}*)`);
							} else {
								return await interaction.editReply(`<@${commandUser.userId}>, <@${secondUser.userId}>, <@${thirdUser.userId}>, <@${fourthUser.userId}> the bot could not find enough viable maps with this criteria. (SR: ${Math.round(averageStarRating * 100) / 100}*)`);
							}
						}

						if (!beatmaps[index]) {
							beatmaps.splice(index, 1);
							console.log('Duel Match: Beatmap was null, removed from array');
							continue;
						}

						if (modPools[i] === 'HD') {
							console.log('Duel Match: Refresh the HD Beatmap');
							beatmaps[index] = await getOsuBeatmap({ beatmapId: beatmaps[index].beatmapId, modBits: 0 });
							beatmaps[index].starRating = adjustHDStarRating(beatmaps[index].starRating, beatmaps[index].approachRate);
							console.log('Duel Match: Refreshed the HD Beatmap');
						} else if (modPools[i] === 'HR') {
							console.log('Duel Match: Refresh the HR Beatmap');
							beatmaps[index] = await getOsuBeatmap({ beatmapId: beatmaps[index].beatmapId, modBits: 16 });
							console.log('Duel Match: Refreshed the HR Beatmap');
						} else if (modPools[i] === 'DT') {
							console.log('Duel Match: Refresh the DT Beatmap');
							beatmaps[index] = await getOsuBeatmap({ beatmapId: beatmaps[index].beatmapId, modBits: 64 });
							console.log('Duel Match: Refreshed the DT Beatmap');
						} else {
							console.log('Duel Match: Refresh the NM/FM Beatmap');
							beatmaps[index] = await getOsuBeatmap({ beatmapId: beatmaps[index].beatmapId, modBits: 0 });
							console.log('Duel Match: Refreshed the NM/FM Beatmap');
						}

						if (!beatmaps[index] || onlyRanked && beatmaps[index].approvalStatus !== 'Ranked') {
							beatmaps.splice(index, 1);
							console.log('Beatmap was null or not ranked, removing from pool');
							continue;
						}

						console.log('Duel Match: Get beatmap score count');
						const mapScoreAmount = await DBOsuMultiScores.count({
							where: {
								beatmapId: beatmaps[index].beatmapId,
								matchName: {
									[Op.notLike]: 'MOTD:%',
								},
								[Op.or]: [
									{ warmup: false },
									{ warmup: null }
								],
							}
						});
						console.log('Duel Match: Grabbed beatmap score count');

						// eslint-disable-next-line no-undef
						if (!beatmaps[index] || parseFloat(beatmaps[index].starRating) < lowerBound || parseFloat(beatmaps[index].starRating) > upperBound || mapScoreAmount < 25 && process.env.SERVER !== 'Dev') {
							beatmaps.splice(index, 1);
							console.log('Beatmap was null, lower bound, or upper bound, or score count was less than 25, removing from pool');
						} else if (!dbMapIds.includes(beatmaps[index].beatmapsetId)) {
							dbBeatmap = beatmaps[index];
							dbMapIds.push(beatmaps[index].beatmapsetId);
							dbMaps.push(beatmaps[index]);
							console.log('Duel Match: Beatmap is valid, adding to pool');
						}
					}
				}

				modPools[6] = 'FreeMod';
				modPools[modPools.indexOf('FM')] = 'FreeMod';


				//Check if the game can be set up and set it up
				let startDate = new Date();
				let endDate = new Date();
				let gameLength = 0;
				//Add initial waiting time
				endDate.setUTCMinutes(endDate.getUTCMinutes() + 5);
				gameLength += 300;
				//Add maximum waiting time between maps
				endDate.setUTCMinutes(endDate.getUTCMinutes() + 2 * 7);
				gameLength += 120 * 7;
				//Add map times; 5 per map
				endDate.setUTCMinutes(endDate.getUTCMinutes() + 5 * 7);
				gameLength += 300 * 7;
				//Add leaving time
				endDate.setUTCMinutes(endDate.getUTCMinutes() + 1);
				gameLength += 60;

				//Set up the lobby
				let bancho = additionalObjects[1];
				let channel = null;

				let teamname1 = commandUser.osuName;
				let teamname2 = secondUser.osuName;

				if (thirdUser) {
					teamname1 = `${commandUser.osuName.substring(0, commandUser.osuName.length / 2)}${secondUser.osuName.substring(secondUser.osuName.length / 2, secondUser.osuName.length)}`;
					teamname2 = `${thirdUser.osuName.substring(0, thirdUser.osuName.length / 2)}${fourthUser.osuName.substring(fourthUser.osuName.length / 2, fourthUser.osuName.length)}`;
				}
				for (let i = 0; i < 5; i++) {
					try {
						try {
							console.log('Duel Match: Connecting to Bancho');
							await bancho.connect();
						} catch (error) {
							if (!error.message === 'Already connected/connecting') {
								throw (error);
							}
						}
						console.log('Duel Match: Creating match');
						if (opponentId) {
							channel = await bancho.createLobby(`ETX: (${teamname1}) vs (${teamname2})`);
						} else {
							channel = await bancho.createLobby(`ETX Teams: (${teamname1}) vs (${teamname2})`);
						}
						console.log('Duel Match: Created match');
						break;
					} catch (error) {
						if (i === 4) {
							return await interaction.editReply('I am having issues creating the lobby and the match has been aborted.\nPlease try again later.');
						} else {
							await pause(10000);
						}
					}
				}

				const lobby = channel.lobby;

				const password = Math.random().toString(36).substring(8);

				await lobby.setPassword(password);
				await channel.sendMessage('!mp map 975342 0');
				if (opponentId) {
					await channel.sendMessage('!mp set 0 3 2');
				} else {
					await channel.sendMessage('!mp set 0 3 4');
				}

				let lobbyStatus = 'Joining phase';
				let mapIndex = 0;

				await channel.sendMessage(`!mp invite #${commandUser.osuUserId}`);
				let user = await additionalObjects[0].users.fetch(commandUser.userId);
				await messageUserWithRetries(user, interaction, `Your match has been created. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\``);

				await channel.sendMessage(`!mp invite #${secondUser.osuUserId}`);
				user = await additionalObjects[0].users.fetch(secondUser.userId);
				await messageUserWithRetries(user, interaction, `Your match has been created. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\``);

				if (thirdUser) {
					await channel.sendMessage(`!mp invite #${thirdUser.osuUserId}`);
					let user = await additionalObjects[0].users.fetch(thirdUser.userId);
					await messageUserWithRetries(user, interaction, `Your match has been created. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\``);

					await channel.sendMessage(`!mp invite #${fourthUser.osuUserId}`);
					user = await additionalObjects[0].users.fetch(fourthUser.userId);
					await messageUserWithRetries(user, interaction, `Your match has been created. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\``);
				}

				let pingMessage = null;
				if (opponentId) {
					await interaction.editReply(`<@${commandUser.userId}> <@${secondUser.userId}> your match has been created. You have been invited ingame by \`Eliteronix\` and also got a DM as a backup.`);
					pingMessage = await interaction.channel.send(`<@${commandUser.userId}> <@${secondUser.userId}>`);
				} else {
					await interaction.editReply(`<@${commandUser.userId}> <@${secondUser.userId}> <@${thirdUser.userId}> <@${fourthUser.userId}> your match has been created. You have been invited ingame by \`Eliteronix\` and also got a DM as a backup.`);
					pingMessage = await interaction.channel.send(`<@${commandUser.userId}> <@${secondUser.userId}> <@${thirdUser.userId}> <@${fourthUser.userId}>`);
				}
				pingMessage.delete();
				//Start the timer to close the lobby if not everyone joined by then
				await channel.sendMessage('!mp timer 300');

				let playerIds = [commandUser.osuUserId, secondUser.osuUserId];
				let dbPlayers = [commandUser, secondUser];
				if (thirdUser) {
					//Push the other 2 users aswell
					playerIds.push(thirdUser.osuUserId);
					playerIds.push(fourthUser.osuUserId);
					dbPlayers.push(thirdUser);
					dbPlayers.push(fourthUser);
				}
				let scores = [0, 0];

				//Add discord messages and also ingame invites for the timers
				channel.on('message', async (msg) => {
					if (msg.user.ircUsername === 'BanchoBot' && msg.message === 'Countdown finished') {
						//Banchobot countdown finished
						if (lobbyStatus === 'Joining phase') {
							//Not everyone joined and the lobby will be closed
							await channel.sendMessage('The lobby will be closed as not everyone joined.');
							pause(60000);
							await channel.sendMessage('!mp close');
							try {
								await processQueueTask.destroy();
							} catch (error) {
								//Nothing
							}
							return await channel.leave();
						} else if (lobbyStatus === 'Waiting for start') {
							await channel.sendMessage('!mp start 5');

							lobbyStatus === 'Map being played';
						}
					}
				});

				lobby.on('playerJoined', async (obj) => {
					if (!playerIds.includes(obj.player.user.id.toString())) {
						channel.sendMessage(`!mp kick #${obj.player.user.id}`);
					} else if (lobbyStatus === 'Joining phase') {
						let allPlayersJoined = true;
						for (let i = 0; i < dbPlayers.length && allPlayersJoined; i++) {
							if (!lobby.playersById[dbPlayers[i].osuUserId.toString()]) {
								allPlayersJoined = false;
							}
						}
						if (allPlayersJoined) {
							lobbyStatus = 'Waiting for start';

							while (lobby._beatmapId != dbMaps[mapIndex].beatmapId) {
								await channel.sendMessage(`!mp map ${dbMaps[mapIndex].beatmapId}`);
							}

							let noFail = 'NF';
							if (modPools[mapIndex] === 'FreeMod') {
								noFail = '';
							}

							while (modPools[mapIndex] === 'FreeMod' && !lobby.freemod //There is no FreeMod combination otherwise
								|| modPools[mapIndex] !== 'FreeMod' && !lobby.mods
								|| modPools[mapIndex] === 'NM' && lobby.mods.length !== 1 //Only NM has only one mod
								|| modPools[mapIndex] !== 'FreeMod' && modPools[mapIndex] !== 'NM' && lobby.mods.length !== 2 //Only FreeMod and NM don't have two mods
								|| modPools[mapIndex] === 'HD' && !((lobby.mods[0].shortMod === 'hd' && lobby.mods[1].shortMod === 'nf') || (lobby.mods[0].shortMod === 'nf' && lobby.mods[1].shortMod === 'hd')) //Only HD has HD and NF
								|| modPools[mapIndex] === 'HR' && !((lobby.mods[0].shortMod === 'hr' && lobby.mods[1].shortMod === 'nf') || (lobby.mods[0].shortMod === 'nf' && lobby.mods[1].shortMod === 'hr')) //Only HR has HR and NF
								|| modPools[mapIndex] === 'DT' && !((lobby.mods[0].shortMod === 'dt' && lobby.mods[1].shortMod === 'nf') || (lobby.mods[0].shortMod === 'nf' && lobby.mods[1].shortMod === 'dt')) //Only DT has DT and NF
							) {
								await channel.sendMessage(`!mp mods ${modPools[mapIndex]} ${noFail}`);
								await pause(5000);
							}

							let mapInfo = await getOsuMapInfo(dbMaps[mapIndex]);
							await channel.sendMessage(mapInfo);
							if (modPools[mapIndex] === 'FreeMod') {
								await channel.sendMessage('Valid Mods: HD, HR, EZ (x1.7) | NM will be 0.5x of the score achieved.');
							}
							await channel.sendMessage('Everyone please ready up!');
							await channel.sendMessage('!mp timer 120');
							mapIndex++;
						}
					}
				});

				lobby.on('allPlayersReady', async () => {
					await lobby.updateSettings();
					let playersInLobby = 0;
					for (let i = 0; i < 16; i++) {
						if (lobby.slots[i]) {
							playersInLobby++;
						}
					}
					if (lobbyStatus === 'Waiting for start' && playersInLobby === dbPlayers.length) {
						await channel.sendMessage('!mp start 5');

						lobbyStatus === 'Map being played';
					}
				});

				lobby.on('matchFinished', async (results) => {
					if (modPools[mapIndex - 1] === 'FreeMod') {
						for (let i = 0; i < results.length; i++) {
							//Increase the score by 1.7 if EZ was played
							if (results[i].player.mods) {
								for (let j = 0; j < results[i].player.mods.length; j++) {
									if (results[i].player.mods[j].enumValue === 2) {
										console.log(results[i].score);
										results[i].score = results[i].score * 1.7;
										console.log(results[i].score);
									}
								}
							}
						}
					}
					if (modPools[mapIndex - 1] === 'FreeMod' && mapIndex - 1 < 6) {
						for (let i = 0; i < results.length; i++) {
							//Reduce the score by 0.5 if it was FreeMod and no mods / only nofail was picked
							if (!results[i].player.mods || results[i].player.mods.length === 0 || results[i].player.mods.length === 1 && results[i].player.mods[0].enumValue === 1) {
								results[i].score = results[i].score * 0.5;
							} else {
								let invalidModsPicked = false;
								for (let j = 0; j < results[i].player.mods.length; j++) {
									if (results[i].player.mods[j].enumValue !== 1 && results[i].player.mods[j].enumValue !== 2 && results[i].player.mods[j].enumValue !== 8 && results[i].player.mods[j].enumValue !== 16) {
										invalidModsPicked = true;
									}
								}

								if (invalidModsPicked) {
									results[i].score = results[i].score / 100;
								}
							}
						}
					}

					quicksort(results);

					let scoreTeam1 = 0;
					let scoreTeam2 = 0;
					if (opponentId) {
						for (let i = 0; i < results.length; i++) {
							if (playerIds[0] == results[i].player.user.id) {
								scoreTeam1 = + parseFloat(results[i].score);
							} else if (playerIds[1] == results[i].player.user.id) {
								scoreTeam2 = + parseFloat(results[i].score);
							}
						}
					} else {
						for (let i = 0; i < results.length; i++) {
							if (playerIds[0] == results[i].player.user.id || playerIds[1] == results[i].player.user.id) {
								scoreTeam1 = scoreTeam1 + parseFloat(results[i].score);
							} else if (playerIds[2] == results[i].player.user.id || playerIds[3] == results[i].player.user.id) {
								scoreTeam2 = scoreTeam2 + parseFloat(results[i].score);
							}
						}
					}
					if (results.length) {
						let winner = teamname1;

						if (scoreTeam1 < scoreTeam2) {
							winner = teamname2;
						}

						await channel.sendMessage(`${teamname1}: ${humanReadable(scoreTeam1)} | ${teamname2}: ${humanReadable(scoreTeam2)} | Difference: ${humanReadable(Math.abs(scoreTeam1 - scoreTeam2))} | Winner: ${winner}`);
					} else {
						await channel.sendMessage('!mp close');

						try {
							await processQueueTask.destroy();
						} catch (error) {
							//Nothing
						}
						return await channel.leave();
					}

					//Increase the score of the player at the top of the list
					if (scoreTeam1 > scoreTeam2) {
						scores[0]++;
					} else {
						scores[1]++;
					}
					await channel.sendMessage(`Score: ${teamname1} | ${scores[0]} - ${scores[1]} | ${teamname2}`);

					if (mapIndex < dbMaps.length && scores[0] < 4 && scores[1] < 4) {
						lobbyStatus = 'Waiting for start';

						while (lobby._beatmapId != dbMaps[mapIndex].beatmapId) {
							await channel.sendMessage(`!mp map ${dbMaps[mapIndex].beatmapId}`);
							await pause(5000);
						}

						let noFail = 'NF';
						if (modPools[mapIndex] === 'FreeMod') {
							noFail = '';
						}

						while (modPools[mapIndex] === 'FreeMod' && !lobby.freemod //There is no FreeMod combination otherwise
							|| modPools[mapIndex] !== 'FreeMod' && !lobby.mods
							|| modPools[mapIndex] === 'NM' && lobby.mods.length !== 1 //Only NM has only one mod
							|| modPools[mapIndex] !== 'FreeMod' && modPools[mapIndex] !== 'NM' && lobby.mods.length !== 2 //Only FreeMod and NM don't have two mods
							|| modPools[mapIndex] === 'HD' && !((lobby.mods[0].shortMod === 'hd' && lobby.mods[1].shortMod === 'nf') || (lobby.mods[0].shortMod === 'nf' && lobby.mods[1].shortMod === 'hd')) //Only HD has HD and NF
							|| modPools[mapIndex] === 'HR' && !((lobby.mods[0].shortMod === 'hr' && lobby.mods[1].shortMod === 'nf') || (lobby.mods[0].shortMod === 'nf' && lobby.mods[1].shortMod === 'hr')) //Only HR has HR and NF
							|| modPools[mapIndex] === 'DT' && !((lobby.mods[0].shortMod === 'dt' && lobby.mods[1].shortMod === 'nf') || (lobby.mods[0].shortMod === 'nf' && lobby.mods[1].shortMod === 'dt')) //Only DT has DT and NF
						) {
							await channel.sendMessage(`!mp mods ${modPools[mapIndex]} ${noFail}`);
							await pause(5000);
						}

						let mapInfo = await getOsuMapInfo(dbMaps[mapIndex]);
						await channel.sendMessage(mapInfo);
						await channel.sendMessage('Everyone please ready up!');
						if (modPools[mapIndex] === 'FreeMod' && mapIndex < 6) {
							await channel.sendMessage('Valid Mods: HD, HR, EZ (x1.7) | NM will be 0.5x of the score achieved.');
						} else if (modPools[mapIndex] === 'FreeMod' && mapIndex === 6) {
							await channel.sendMessage('Valid Mods: HD, HR, EZ (x1.7) | NM will be just as achieved.');
						}
						await channel.sendMessage('!mp timer 120');
						mapIndex++;
					} else {
						lobbyStatus = 'Lobby finished';

						if (scores[0] === 4) {
							await channel.sendMessage(`Congratulations ${teamname1} for winning the match!`);
						} else {
							await channel.sendMessage(`Congratulations ${teamname2} for winning the match!`);
						}
						await channel.sendMessage('Thank you for playing! The lobby will automatically close in one minute.');
						await pause(5000);

						// eslint-disable-next-line no-undef
						const osuApi = new osu.Api(process.env.OSUTOKENV1, {
							// baseUrl: sets the base api url (default: https://osu.ppy.sh/api)
							notFoundAsError: true, // Throw an error on not found instead of returning nothing. (default: true)
							completeScores: false, // When fetching scores also fetch the beatmap they are for (Allows getting accuracy) (default: false)
							parseNumeric: false // Parse numeric values into numbers/floats, excluding ids
						});

						osuApi.getMatch({ mp: lobby.id })
							.then(async (match) => {
								let userDuelStarRating = await getUserDuelStarRating({ osuUserId: commandUser.osuUserId, client: interaction.client });
								let messages = ['Your SR has been updated!'];
								if (Math.round(commandUser.osuDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.total * 1000) / 1000) {
									messages.push(`SR: ${Math.round(commandUser.osuDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.total * 1000) / 1000}`);
								}
								if (Math.round(commandUser.osuNoModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.noMod * 1000) / 1000) {
									messages.push(`NM: ${Math.round(commandUser.osuNoModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.noMod * 1000) / 1000}`);
								}
								if (Math.round(commandUser.osuHiddenDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hidden * 1000) / 1000) {
									messages.push(`HD: ${Math.round(commandUser.osuHiddenDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hidden * 1000) / 1000}`);
								}
								if (Math.round(commandUser.osuHardRockDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hardRock * 1000) / 1000) {
									messages.push(`HR: ${Math.round(commandUser.osuHardRockDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hardRock * 1000) / 1000}`);
								}
								if (Math.round(commandUser.osuDoubleTimeDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.doubleTime * 1000) / 1000) {
									messages.push(`DT: ${Math.round(commandUser.osuDoubleTimeDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.doubleTime * 1000) / 1000}`);
								}
								if (Math.round(commandUser.osuFreeModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.freeMod * 1000) / 1000) {
									messages.push(`FM: ${Math.round(commandUser.osuFreeModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.freeMod * 1000) / 1000}`);
								}
								if (messages.length > 1) {
									const IRCUser = await bancho.getUser(commandUser.osuName);
									for (let i = 0; i < messages.length; i++) {
										await IRCUser.sendMessage(messages[i]);
									}
								}

								userDuelStarRating = await getUserDuelStarRating({ osuUserId: secondUser.osuUserId, client: interaction.client });
								messages = ['Your SR has been updated!'];
								if (Math.round(secondUser.osuDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.total * 1000) / 1000) {
									messages.push(`SR: ${Math.round(secondUser.osuDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.total * 1000) / 1000}`);
								}
								if (Math.round(secondUser.osuNoModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.noMod * 1000) / 1000) {
									messages.push(`NM: ${Math.round(secondUser.osuNoModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.noMod * 1000) / 1000}`);
								}
								if (Math.round(secondUser.osuHiddenDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hidden * 1000) / 1000) {
									messages.push(`HD: ${Math.round(secondUser.osuHiddenDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hidden * 1000) / 1000}`);
								}
								if (Math.round(secondUser.osuHardRockDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hardRock * 1000) / 1000) {
									messages.push(`HR: ${Math.round(secondUser.osuHardRockDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hardRock * 1000) / 1000}`);
								}
								if (Math.round(secondUser.osuDoubleTimeDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.doubleTime * 1000) / 1000) {
									messages.push(`DT: ${Math.round(secondUser.osuDoubleTimeDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.doubleTime * 1000) / 1000}`);
								}
								if (Math.round(secondUser.osuFreeModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.freeMod * 1000) / 1000) {
									messages.push(`FM: ${Math.round(secondUser.osuFreeModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.freeMod * 1000) / 1000}`);
								}
								if (messages.length > 1) {
									const IRCUser = await bancho.getUser(secondUser.osuName);
									for (let i = 0; i < messages.length; i++) {
										await IRCUser.sendMessage(messages[i]);
									}
								}

								if (thirdUser) {
									userDuelStarRating = await getUserDuelStarRating({ osuUserId: thirdUser.osuUserId, client: interaction.client });
									messages = ['Your SR has been updated!'];
									if (Math.round(thirdUser.osuDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.total * 1000) / 1000) {
										messages.push(`SR: ${Math.round(thirdUser.osuDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.total * 1000) / 1000}`);
									}
									if (Math.round(thirdUser.osuNoModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.noMod * 1000) / 1000) {
										messages.push(`NM: ${Math.round(thirdUser.osuNoModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.noMod * 1000) / 1000}`);
									}
									if (Math.round(thirdUser.osuHiddenDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hidden * 1000) / 1000) {
										messages.push(`HD: ${Math.round(thirdUser.osuHiddenDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hidden * 1000) / 1000}`);
									}
									if (Math.round(thirdUser.osuHardRockDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hardRock * 1000) / 1000) {
										messages.push(`HR: ${Math.round(thirdUser.osuHardRockDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hardRock * 1000) / 1000}`);
									}
									if (Math.round(thirdUser.osuDoubleTimeDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.doubleTime * 1000) / 1000) {
										messages.push(`DT: ${Math.round(thirdUser.osuDoubleTimeDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.doubleTime * 1000) / 1000}`);
									}
									if (Math.round(thirdUser.osuFreeModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.freeMod * 1000) / 1000) {
										messages.push(`FM: ${Math.round(thirdUser.osuFreeModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.freeMod * 1000) / 1000}`);
									}
									if (messages.length > 1) {
										const IRCUser = await bancho.getUser(thirdUser.osuName);
										for (let i = 0; i < messages.length; i++) {
											await IRCUser.sendMessage(messages[i]);
										}
									}

									userDuelStarRating = await getUserDuelStarRating({ osuUserId: fourthUser.osuUserId, client: interaction.client });
									messages = ['Your SR has been updated!'];
									if (Math.round(fourthUser.osuDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.total * 1000) / 1000) {
										messages.push(`SR: ${Math.round(fourthUser.osuDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.total * 1000) / 1000}`);
									}
									if (Math.round(fourthUser.osuNoModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.noMod * 1000) / 1000) {
										messages.push(`NM: ${Math.round(fourthUser.osuNoModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.noMod * 1000) / 1000}`);
									}
									if (Math.round(fourthUser.osuHiddenDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hidden * 1000) / 1000) {
										messages.push(`HD: ${Math.round(fourthUser.osuHiddenDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hidden * 1000) / 1000}`);
									}
									if (Math.round(fourthUser.osuHardRockDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hardRock * 1000) / 1000) {
										messages.push(`HR: ${Math.round(fourthUser.osuHardRockDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hardRock * 1000) / 1000}`);
									}
									if (Math.round(fourthUser.osuDoubleTimeDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.doubleTime * 1000) / 1000) {
										messages.push(`DT: ${Math.round(fourthUser.osuDoubleTimeDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.doubleTime * 1000) / 1000}`);
									}
									if (Math.round(fourthUser.osuFreeModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.freeMod * 1000) / 1000) {
										messages.push(`FM: ${Math.round(fourthUser.osuFreeModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.freeMod * 1000) / 1000}`);
									}
									if (messages.length > 1) {
										const IRCUser = await bancho.getUser(fourthUser.osuName);
										for (let i = 0; i < messages.length; i++) {
											await IRCUser.sendMessage(messages[i]);
										}
									}
								}
							})
							.catch(() => {
								//Nothing
							});

						await pause(55000);
						await channel.sendMessage('!mp close');

						try {
							await processQueueTask.destroy();
						} catch (error) {
							//Nothing
						}
						return await channel.leave();
					}
				});
			}
		}
	},
};

async function messageUserWithRetries(user, interaction, content) {
	for (let i = 0; i < 3; i++) {
		try {
			await user.send(content)
				.then(() => {
					i = Infinity;
				})
				.catch(async (error) => {
					throw (error);
				});
		} catch (error) {
			if (error.message === 'Cannot send messages to this user' || error.message === 'Internal Server Error') {
				if (i === 2) {
					interaction.followUp(`[Duel] <@${user.id}>, it seems like I can't DM you in Discord. Please enable DMs so that I can keep you up to date with the match procedure!`);
				} else {
					await pause(2500);
				}
			} else {
				i = Infinity;
				console.log(error);
			}
		}
	}
}

function shuffle(array) {
	let currentIndex = array.length, randomIndex;

	// While there remain elements to shuffle...
	while (currentIndex != 0) {

		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
	}

	return array;
}

function partition(list, start, end) {
	const pivot = list[end];
	let i = start;
	for (let j = start; j < end; j += 1) {
		if (parseInt(list[j].score) >= parseInt(pivot.score)) {
			[list[j], list[i]] = [list[i], list[j]];
			i++;
		}
	}
	[list[i], list[end]] = [list[end], list[i]];
	return i;
}

function quicksort(list, start = 0, end = undefined) {
	if (end === undefined) {
		end = list.length - 1;
	}
	if (start < end) {
		const p = partition(list, start, end);
		quicksort(list, start, p - 1);
		quicksort(list, p + 1, end);
	}
	return list;
}

function partitionDuelStarRating(list, start, end) {
	const pivot = list[end];
	let i = start;
	for (let j = start; j < end; j += 1) {
		if (list[j].osuDuelStarRating >= pivot.osuDuelStarRating) {
			[list[j], list[i]] = [list[i], list[j]];
			i++;
		}
	}
	[list[i], list[end]] = [list[end], list[i]];
	return i;
}

function quicksortDuelStarRating(list, start = 0, end = undefined) {
	if (end === undefined) {
		end = list.length - 1;
	}
	if (start < end) {
		const p = partitionDuelStarRating(list, start, end);
		quicksortDuelStarRating(list, start, p - 1);
		quicksortDuelStarRating(list, p + 1, end);
	}
	return list;
}

function partitionStep(list, start, end) {
	const pivot = list[end];
	let i = start;
	for (let j = start; j < end; j += 1) {
		if (list[j].step < pivot.step) {
			[list[j], list[i]] = [list[i], list[j]];
			i++;
		}
	}
	[list[i], list[end]] = [list[end], list[i]];
	return i;
}

function quicksortStep(list, start = 0, end = undefined) {
	if (end === undefined) {
		end = list.length - 1;
	}
	if (start < end) {
		const p = partitionStep(list, start, end);
		quicksortStep(list, start, p - 1);
		quicksortStep(list, p + 1, end);
	}
	return list;
}

function partitionScore(list, start, end) {
	const pivot = list[end];
	let i = start;
	for (let j = start; j < end; j += 1) {
		if (list[j].score < pivot.score) {
			[list[j], list[i]] = [list[i], list[j]];
			i++;
		}
	}
	[list[i], list[end]] = [list[end], list[i]];
	return i;
}

function quicksortScore(list, start = 0, end = undefined) {
	if (end === undefined) {
		end = list.length - 1;
	}
	if (start < end) {
		const p = partitionScore(list, start, end);
		quicksortScore(list, start, p - 1);
		quicksortScore(list, p + 1, end);
	}
	return list;
}

function partitionMatchId(list, start, end) {
	const pivot = list[end];
	let i = start;
	for (let j = start; j < end; j += 1) {
		if (parseInt(list[j].matchId) > parseInt(pivot.matchId)) {
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

async function getOsuMapInfo(dbBeatmap) {
	const mapScores = await DBOsuMultiScores.findAll({
		where: {
			beatmapId: dbBeatmap.beatmapId,
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

	let tournaments = [];

	for (let i = 0; i < mapScores.length; i++) {
		let acronym = mapScores[i].matchName.replace(/:.+/gm, '');

		if (tournaments.indexOf(acronym) === -1) {
			tournaments.push(acronym);
		}
	}

	return `https://osu.ppy.sh/b/${dbBeatmap.beatmapId} | https://beatconnect.io/b/${dbBeatmap.beatmapsetId} | Map played ${mapScores.length} times in: ${tournaments.join(', ')}`;
}