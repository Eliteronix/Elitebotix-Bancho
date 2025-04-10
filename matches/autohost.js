const { logMatchCreation, addMatchMessage, trySendMessage, restartIfPossible, reconnectToBanchoAndChannels } = require('../utils');
const { DBElitebotixDiscordUsers, DBElitebotixOsuMultiGameScores, DBElitebotixProcessQueue } = require('../dbObjects');
const { Op } = require('sequelize');
const { getNextMap } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);

module.exports = {
	async execute(bancho, osuUserId, settings) {
		let password = settings.password;
		let winCondition = '0';
		let modsInput = null;
		let nmStarRating = null;
		let hdStarRating = null;
		let hrStarRating = null;
		let dtStarRating = null;
		let fmStarRating = null;

		let createMessage = 'Creating lobby...';
		if (password) {
			createMessage = `Creating lobby with password ${password} ...`;
		}

		let banchoUser = await bancho.getUserById(osuUserId);

		await trySendMessage(banchoUser, createMessage);

		let discordUser = await DBElitebotixDiscordUsers.findOne({
			where: {
				osuUserId: osuUserId,
				osuVerified: true
			}
		});

		if (!discordUser) {
			return await trySendMessage(banchoUser, 'Please connect and verify your account with the bot on discord as a backup by using: /osu-link connect [https://discord.gg/Asz5Gfe Discord]');
		}

		//Fill in star ratings if needed
		if (!nmStarRating) {
			nmStarRating = parseFloat(discordUser.osuNoModDuelStarRating);
		}
		if (!hdStarRating) {
			hdStarRating = parseFloat(discordUser.osuHiddenDuelStarRating);
		}
		if (!hrStarRating) {
			hrStarRating = parseFloat(discordUser.osuHardRockDuelStarRating);
		}
		if (!dtStarRating) {
			dtStarRating = parseFloat(discordUser.osuDoubleTimeDuelStarRating);
		}
		if (!fmStarRating) {
			fmStarRating = parseFloat(discordUser.osuFreeModDuelStarRating);
		}

		let matchName = 'ETX Autohost';

		//Get the mods that should be played
		let mods = [];

		if (!modsInput || modsInput && modsInput.toLowerCase().includes('nm')) {
			mods.push('NM');
			matchName = matchName + ` | ${nmStarRating.toFixed(1)} NM`;
		}
		if (!modsInput || modsInput && modsInput.toLowerCase().includes('hd')) {
			mods.push('HD');
			matchName = matchName + ` | ${hdStarRating.toFixed(1)} HD`;
		}
		if (!modsInput || modsInput && modsInput.toLowerCase().includes('hr')) {
			mods.push('HR');
			matchName = matchName + ` | ${hrStarRating.toFixed(1)} HR`;
		}
		if (!modsInput || modsInput && modsInput.toLowerCase().includes('dt')) {
			mods.push('DT');
			matchName = matchName + ` | ${dtStarRating.toFixed(1)} DT`;
		}
		if (!modsInput || modsInput && modsInput.toLowerCase().includes('fm')) {
			mods.push('FM');
			matchName = matchName + ` | ${fmStarRating.toFixed(1)} FM`;
		}

		if (!mods.length) {
			mods.push('NM');
			matchName = matchName + ` | ${nmStarRating.toFixed(1)} NM`;

			mods.push('HD');
			matchName = matchName + ` | ${hdStarRating.toFixed(1)} HD`;

			mods.push('HR');
			matchName = matchName + ` | ${hrStarRating.toFixed(1)} HR`;

			mods.push('DT');
			matchName = matchName + ` | ${dtStarRating.toFixed(1)} DT`;

			mods.push('FM');
			matchName = matchName + ` | ${fmStarRating.toFixed(1)} FM`;
		}

		let channel = null;

		for (let i = 0; i < 5; i++) {
			try {
				await reconnectToBanchoAndChannels(bancho);

				channel = await bancho.createLobby(matchName);
				bancho.autoHosts.push(parseInt(channel.lobby.id));
				if (settings.interaction) {
					await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'interactionResponse', additions: `${settings.interaction};The lobby has been created. You have been sent an invite ingame.`, priority: 1, date: new Date() });
				}
				break;
			} catch (error) {
				if (i === 4) {
					if (settings.interaction) {
						await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'interactionResponse', additions: `${settings.interaction};I am having issues creating the lobby and the match has been aborted. Please try again later.`, priority: 1, date: new Date() });
					}
					return await trySendMessage(banchoUser, 'I am having issues creating the lobby and the match has been aborted. Please try again later.');
				} else {
					await new Promise(resolve => setTimeout(resolve, 10000));
				}
			}
		}

		let matchMessages = [];

		channel.on('message', async (msg) => {
			addMatchMessage(lobby.id, matchMessages, msg.user.ircUsername, msg.message);
		});

		const lobby = channel.lobby;
		logMatchCreation(lobby.name, lobby.id);

		await trySendMessage(channel, `!mp password ${password}`);
		await trySendMessage(channel, '!mp addref Eliteronix');
		await trySendMessage(channel, `!mp set 0 ${winCondition}`);
		await trySendMessage(channel, `!mp invite #${discordUser.osuUserId}`);

		let poolIterator = 0;
		let currentPotentialMods = [];

		for (let i = 0; i < 10; i++) {
			getNextModPool();
		}

		let avoidMaps = [];
		let threeMonthsAgo = new Date();
		threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

		const player1Scores = await DBElitebotixOsuMultiGameScores.findAll({
			attributes: ['beatmapId'],
			where: {
				osuUserId: discordUser.osuUserId,
				mode: 0,
				gameStartDate: {
					[Op.gte]: threeMonthsAgo,
				}
			}
		});

		for (let i = 0; i < player1Scores.length; i++) {
			avoidMaps.push(player1Scores[i].beatmapId);
		}

		let date = new Date();
		date.setUTCMinutes(date.getUTCMinutes() + 5);
		await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'importMatch', additions: `${lobby.id};0;${new Date().getTime()};${lobby.name}`, priority: 1, date: date });

		channel.on('message', async (msg) => {
			if (msg.user.ircUsername === 'BanchoBot' && msg.message === 'Countdown finished') {
				await trySendMessage(channel, '!mp start 10');
			} else if (msg.user._id == discordUser.osuUserId) {
				let modUpdate = false;
				//If it is the creator
				if (msg.message === '!commands') {
					await trySendMessage(channel, '!abort - Aborts the currently playing map.');
					await trySendMessage(channel, '!condition - Allows you to change the win condition. (Score/Scorev2/Accuracy)');
					await trySendMessage(channel, '!password - Allows you to change the password.');
					await trySendMessage(channel, '!skip - Skips the currently selected map.');
					await trySendMessage(channel, '!timeout - Increases the timer to 5 minutes.');
					await trySendMessage(channel, '!mods - Allows you to change the played mods. (Ex: "NM,HR,DT")');
					await trySendMessage(channel, '!sr - Allows you to change the SR of all mods (Ex: "!sr 5.6")');
					await trySendMessage(channel, '!nm - Allows you to change the NM SR (Ex: "!nm 5.6")');
					await trySendMessage(channel, '!hd - Allows you to change the HD SR (Ex: "!hd 5.6")');
					await trySendMessage(channel, '!hr - Allows you to change the HR SR (Ex: "!hr 5.6")');
					await trySendMessage(channel, '!dt - Allows you to change the DT SR (Ex: "!dt 5.6")');
					await trySendMessage(channel, '!fm - Allows you to change the FM SR (Ex: "!fm 5.6")');
				} else if (msg.message === '!skip') {
					await trySendMessage(channel, '!mp aborttimer');
					await trySendMessage(channel, 'Looking for new map...');
					let nextModPool = getNextModPool(true);

					let beatmap = await getPoolBeatmap(nextModPool, nmStarRating, hdStarRating, hrStarRating, dtStarRating, fmStarRating, avoidMaps);
					let tries = 0;
					while (lobby._beatmapId != beatmap.beatmapId) {
						if (tries % 5 === 0 && tries) {
							beatmap = await getPoolBeatmap(nextModPool, nmStarRating, hdStarRating, hrStarRating, dtStarRating, fmStarRating, avoidMaps);
						}

						await trySendMessage(channel, '!mp abort');
						await trySendMessage(channel, `!mp map ${beatmap.beatmapId}`);
						await new Promise(resolve => setTimeout(resolve, 5000));
						await lobby.updateSettings();
						tries++;
					}

					if (winCondition === '3') {
						while (nextModPool === 'FM' && !lobby.freemod //There is no FreeMod combination otherwise
							|| nextModPool !== 'FM' && lobby.freemod
							|| nextModPool !== 'NM' && nextModPool !== 'FM' && !lobby.mods
							|| nextModPool === 'NM' && lobby.mods && lobby.mods.length !== 1 //Only NM has only one mod
							|| nextModPool === 'HD' && lobby.mods && lobby.mods.length < 2
							|| nextModPool === 'HD' && lobby.mods && lobby.mods[1].shortMod !== 'hd'
							|| nextModPool === 'HR' && lobby.mods && lobby.mods.length < 2
							|| nextModPool === 'HR' && lobby.mods && lobby.mods[1].shortMod !== 'hr'
							|| nextModPool === 'DT' && lobby.mods && lobby.mods.length < 2
							|| nextModPool === 'DT' && lobby.mods && lobby.mods[1].shortMod !== 'dt'
						) {
							if (nextModPool === 'FM') {
								await trySendMessage(channel, '!mp mods FreeMod');
							} else {
								await trySendMessage(channel, `!mp mods ${nextModPool} NF`);
							}

							await new Promise(resolve => setTimeout(resolve, 5000));
							await lobby.updateSettings();
						}
					} else {
						while (nextModPool === 'FM' && !lobby.freemod //There is no FreeMod combination otherwise
							|| nextModPool !== 'FM' && lobby.freemod
							|| nextModPool !== 'NM' && nextModPool !== 'FM' && !lobby.mods
							|| nextModPool === 'NM' && lobby.mods && lobby.mods.length //Only NM has only one mod
							|| nextModPool === 'HD' && lobby.mods && lobby.mods.length < 1
							|| nextModPool === 'HD' && lobby.mods && lobby.mods[0].shortMod !== 'hd'
							|| nextModPool === 'HR' && lobby.mods && lobby.mods.length < 1
							|| nextModPool === 'HR' && lobby.mods && lobby.mods[0].shortMod !== 'hr'
							|| nextModPool === 'DT' && lobby.mods && lobby.mods.length < 1
							|| nextModPool === 'DT' && lobby.mods && lobby.mods[0].shortMod !== 'dt'
						) {
							if (nextModPool === 'FM') {
								await trySendMessage(channel, '!mp mods FreeMod');
							} else {
								await trySendMessage(channel, `!mp mods ${nextModPool}`);
							}

							await new Promise(resolve => setTimeout(resolve, 5000));
						}
					}

					await trySendMessage(channel, '!mp timer 120');
				} else if (msg.message === '!abort') {
					await trySendMessage(channel, '!mp abort');
					await new Promise(resolve => setTimeout(resolve, 5000));
					await trySendMessage(channel, '!mp timer 120');
				} else if (msg.message === '!timeout') {
					await trySendMessage(channel, '!mp timer 300');
				} else if (msg.message.toLowerCase().startsWith('!mods')) {
					let matchName = 'ETX Autohost';

					//Get the mods that should be played
					mods = [];

					if (msg.message.toLowerCase().includes('nm')) {
						mods.push('NM');
						matchName = matchName + ` | ${nmStarRating.toFixed(1)} NM`;
					}
					if (msg.message.toLowerCase().includes('hd')) {
						mods.push('HD');
						matchName = matchName + ` | ${hdStarRating.toFixed(1)} HD`;
					}
					if (msg.message.toLowerCase().includes('hr')) {
						mods.push('HR');
						matchName = matchName + ` | ${hrStarRating.toFixed(1)} HR`;
					}
					if (msg.message.toLowerCase().includes('dt')) {
						mods.push('DT');
						matchName = matchName + ` | ${dtStarRating.toFixed(1)} DT`;
					}
					if (msg.message.toLowerCase().includes('fm')) {
						mods.push('FM');
						matchName = matchName + ` | ${fmStarRating.toFixed(1)} FM`;
					}

					if (!mods.length) {
						mods.push('NM');
						matchName = matchName + ` | ${nmStarRating.toFixed(1)} NM`;

						mods.push('HD');
						matchName = matchName + ` | ${hdStarRating.toFixed(1)} HD`;

						mods.push('HR');
						matchName = matchName + ` | ${hrStarRating.toFixed(1)} HR`;

						mods.push('DT');
						matchName = matchName + ` | ${dtStarRating.toFixed(1)} DT`;

						mods.push('FM');
						matchName = matchName + ` | ${fmStarRating.toFixed(1)} FM`;
					}

					currentPotentialMods = [];

					for (let i = 0; i < 10; i++) {
						getNextModPool();
					}

					await trySendMessage(channel, `!mp name ${matchName}`);
					await trySendMessage(channel, 'Adapted the played mods. The changes will take place next map. Use !skip to update now.');
				} else if (msg.message.toLowerCase().startsWith('!sr')) {
					let args = msg.message.slice(3).trim().split(/ +/);
					if (!args.length) {
						await trySendMessage(channel, 'You didn\'t specify a star rating');
					} else if (isNaN(parseFloat(args[0]))) {
						await trySendMessage(channel, `"${args[0]}" is not a valid star rating`);
					} else if (parseFloat(args[0]) > 10 || parseFloat(args[0]) < 3.5) {
						await trySendMessage(channel, 'The star rating should not be higher than 10 or lower than 3.5');
					} else {
						nmStarRating = parseFloat(args[0]);
						hdStarRating = parseFloat(args[0]);
						hrStarRating = parseFloat(args[0]);
						dtStarRating = parseFloat(args[0]);
						fmStarRating = parseFloat(args[0]);
						modUpdate = true;
					}
				} else if (msg.message.toLowerCase().startsWith('!nm')) {
					let args = msg.message.slice(3).trim().split(/ +/);
					if (!args.length) {
						await trySendMessage(channel, 'You didn\'t specify a star rating');
					} else if (isNaN(parseFloat(args[0]))) {
						await trySendMessage(channel, `"${args[0]}" is not a valid star rating`);
					} else if (parseFloat(args[0]) > 10 || parseFloat(args[0]) < 3.5) {
						await trySendMessage(channel, 'The star rating should not be higher than 10 or lower than 3.5');
					} else {
						nmStarRating = parseFloat(args[0]);
						modUpdate = true;
					}
				} else if (msg.message.toLowerCase().startsWith('!hd')) {
					let args = msg.message.slice(3).trim().split(/ +/);
					if (!args.length) {
						await trySendMessage(channel, 'You didn\'t specify a star rating');
					} else if (isNaN(parseFloat(args[0]))) {
						await trySendMessage(channel, `"${args[0]}" is not a valid star rating`);
					} else if (parseFloat(args[0]) > 10 || parseFloat(args[0]) < 3.5) {
						await trySendMessage(channel, 'The star rating should not be higher than 10 or lower than 3.5');
					} else {
						hdStarRating = parseFloat(args[0]);
						modUpdate = true;
					}
				} else if (msg.message.toLowerCase().startsWith('!hr')) {
					let args = msg.message.slice(3).trim().split(/ +/);
					if (!args.length) {
						await trySendMessage(channel, 'You didn\'t specify a star rating');
					} else if (isNaN(parseFloat(args[0]))) {
						await trySendMessage(channel, `"${args[0]}" is not a valid star rating`);
					} else if (parseFloat(args[0]) > 10 || parseFloat(args[0]) < 3.5) {
						await trySendMessage(channel, 'The star rating should not be higher than 10 or lower than 3.5');
					} else {
						hrStarRating = parseFloat(args[0]);
						modUpdate = true;
					}
				} else if (msg.message.toLowerCase().startsWith('!dt')) {
					let args = msg.message.slice(3).trim().split(/ +/);
					if (!args.length) {
						await trySendMessage(channel, 'You didn\'t specify a star rating');
					} else if (isNaN(parseFloat(args[0]))) {
						await trySendMessage(channel, `"${args[0]}" is not a valid star rating`);
					} else if (parseFloat(args[0]) > 10 || parseFloat(args[0]) < 3.5) {
						await trySendMessage(channel, 'The star rating should not be higher than 10 or lower than 3.5');
					} else {
						dtStarRating = parseFloat(args[0]);
						modUpdate = true;
					}
				} else if (msg.message.toLowerCase().startsWith('!fm')) {
					let args = msg.message.slice(3).trim().split(/ +/);
					if (!args.length) {
						await trySendMessage(channel, 'You didn\'t specify a star rating');
					} else if (isNaN(parseFloat(args[0]))) {
						await trySendMessage(channel, `"${args[0]}" is not a valid star rating`);
					} else if (parseFloat(args[0]) > 10 || parseFloat(args[0]) < 3.5) {
						await trySendMessage(channel, 'The star rating should not be higher than 10 or lower than 3.5');
					} else {
						fmStarRating = parseFloat(args[0]);
						modUpdate = true;
					}
				} else if (msg.message.toLowerCase().startsWith('!password')) {
					let args = msg.message.slice(9).trim().split(/ +/);

					if (args[0]) {
						lobby.setPassword(args[0]);
						await trySendMessage(channel, `Updated the password to ${args[0]}`);
					} else {
						await trySendMessage(channel, '!mp password');
						await trySendMessage(channel, 'Removed the password');
					}
				} else if (msg.message.toLowerCase().startsWith('!condition')) {
					winCondition = '0';

					if (msg.message.toLowerCase().includes('v2')) {
						winCondition = '3';
					} else if (msg.message.toLowerCase().includes('acc')) {
						winCondition = '1';
					}

					await trySendMessage(channel, `!mp set 0 ${winCondition}`);
					await trySendMessage(channel, 'The condition has been adapted.');
				}

				if (modUpdate) {
					let matchName = 'ETX Autohost';

					//Get the mods that should be played

					if (mods.includes('NM')) {
						matchName = matchName + ` | ${nmStarRating.toFixed(1)} NM`;
					}
					if (mods.includes('HD')) {
						matchName = matchName + ` | ${hdStarRating.toFixed(1)} HD`;
					}
					if (mods.includes('HR')) {
						matchName = matchName + ` | ${hrStarRating.toFixed(1)} HR`;
					}
					if (mods.includes('DT')) {
						matchName = matchName + ` | ${dtStarRating.toFixed(1)} DT`;
					}
					if (mods.includes('FM')) {
						matchName = matchName + ` | ${fmStarRating.toFixed(1)} FM`;
					}

					await trySendMessage(channel, `!mp name ${matchName}`);
					await trySendMessage(channel, 'Adapted the star rating. The changes will take place next map. Use !skip to update now.');
				}
			}
		});

		let noPlayerJoined = true;

		setTimeout(async () => {
			if (noPlayerJoined) {
				await lobby.closeLobby();
				await channel.leave();

				//Remove the channel property from the bancho object to avoid trying to rejoin
				delete bancho.channels[`#mp_${lobby.id}`];

				bancho.autoHosts = bancho.autoHosts.filter((id) => id !== parseInt(lobby.id));

				// Restart if there are no more auto hosts and the bot is marked for update
				restartIfPossible(bancho);

				return;
			}
		}, 600000);

		lobby.on('playerJoined', async (obj) => {
			noPlayerJoined = false;

			if (discordUser.osuUserId === obj.player.user.id.toString()) {
				await trySendMessage(channel, '!commands - Sends the list of commands.');
				await trySendMessage(channel, '!abort - Aborts the currently playing map.');
				await trySendMessage(channel, '!condition - Allows you to change the win condition. (Score/Scorev2/Accuracy)');
				await trySendMessage(channel, '!password - Allows you to change the password.');
				await trySendMessage(channel, '!skip - Skips the currently selected map.');
				await trySendMessage(channel, '!timeout - Increases the timer to 5 minutes.');
				await trySendMessage(channel, '!mods - Allows you to change the played mods. (Ex: "NM,HR,DT")');
				await trySendMessage(channel, '!sr - Allows you to change the SR of all mods (Ex: "!sr 5.6")');
				await trySendMessage(channel, '!nm - Allows you to change the NM SR (Ex: "!nm 5.6")');
				await trySendMessage(channel, '!hd - Allows you to change the HD SR (Ex: "!hd 5.6")');
				await trySendMessage(channel, '!hr - Allows you to change the HR SR (Ex: "!hr 5.6")');
				await trySendMessage(channel, '!dt - Allows you to change the DT SR (Ex: "!dt 5.6")');
				await trySendMessage(channel, '!fm - Allows you to change the FM SR (Ex: "!fm 5.6")');
				let nextModPool = getNextModPool(true);

				let beatmap = await getPoolBeatmap(nextModPool, nmStarRating, hdStarRating, hrStarRating, dtStarRating, fmStarRating, avoidMaps);
				let tries = 0;
				while (lobby._beatmapId != beatmap.beatmapId) {
					if (tries % 5 === 0 && tries) {
						beatmap = await getPoolBeatmap(nextModPool, nmStarRating, hdStarRating, hrStarRating, dtStarRating, fmStarRating, avoidMaps);
					}

					await trySendMessage(channel, '!mp abort');
					await trySendMessage(channel, `!mp map ${beatmap.beatmapId}`);
					await new Promise(resolve => setTimeout(resolve, 5000));
					await lobby.updateSettings();
					tries++;
				}

				if (winCondition === '3') {
					while (nextModPool === 'FM' && !lobby.freemod //There is no FreeMod combination otherwise
						|| nextModPool !== 'FM' && lobby.freemod
						|| nextModPool !== 'NM' && nextModPool !== 'FM' && !lobby.mods
						|| nextModPool === 'NM' && lobby.mods && lobby.mods.length !== 1 //Only NM has only one mod
						|| nextModPool === 'HD' && lobby.mods && lobby.mods.length < 2
						|| nextModPool === 'HD' && lobby.mods && lobby.mods[1].shortMod !== 'hd'
						|| nextModPool === 'HR' && lobby.mods && lobby.mods.length < 2
						|| nextModPool === 'HR' && lobby.mods && lobby.mods[1].shortMod !== 'hr'
						|| nextModPool === 'DT' && lobby.mods && lobby.mods.length < 2
						|| nextModPool === 'DT' && lobby.mods && lobby.mods[1].shortMod !== 'dt'
					) {
						if (nextModPool === 'FM') {
							await trySendMessage(channel, '!mp mods FreeMod');
						} else {
							await trySendMessage(channel, `!mp mods ${nextModPool} NF`);
						}

						await new Promise(resolve => setTimeout(resolve, 5000));
						await lobby.updateSettings();
					}
				} else {
					while (nextModPool === 'FM' && !lobby.freemod //There is no FreeMod combination otherwise
						|| nextModPool !== 'FM' && lobby.freemod
						|| nextModPool !== 'NM' && nextModPool !== 'FM' && !lobby.mods
						|| nextModPool === 'NM' && lobby.mods && lobby.mods.length //Only NM has only one mod
						|| nextModPool === 'HD' && lobby.mods && lobby.mods.length < 1
						|| nextModPool === 'HD' && lobby.mods && lobby.mods[0].shortMod !== 'hd'
						|| nextModPool === 'HR' && lobby.mods && lobby.mods.length < 1
						|| nextModPool === 'HR' && lobby.mods && lobby.mods[0].shortMod !== 'hr'
						|| nextModPool === 'DT' && lobby.mods && lobby.mods.length < 1
						|| nextModPool === 'DT' && lobby.mods && lobby.mods[0].shortMod !== 'dt'
					) {
						if (nextModPool === 'FM') {
							await trySendMessage(channel, '!mp mods FreeMod');
						} else {
							await trySendMessage(channel, `!mp mods ${nextModPool}`);
						}

						await new Promise(resolve => setTimeout(resolve, 5000));
					}
				}

				await trySendMessage(channel, '!mp timer 120');
			}
		});

		lobby.on('playerLeft', async () => {
			await lobby.updateSettings();

			let noPlayersLeft = true;

			for (let i = 0; i < 16; i++) {
				let player = lobby.slots[i];
				if (player) {
					noPlayersLeft = false;
					break;
				}
			}

			if (noPlayersLeft) {
				await lobby.closeLobby();
				await channel.leave();

				//Remove the channel property from the bancho object to avoid trying to rejoin
				delete bancho.channels[`#mp_${lobby.id}`];

				bancho.autoHosts = bancho.autoHosts.filter((id) => id !== parseInt(lobby.id));

				// Restart if there are no more auto hosts and the bot is marked for update
				restartIfPossible(bancho);

				return;
			}
		});

		lobby.on('allPlayersReady', async () => {
			await lobby.updateSettings();

			let playerHasNoMap = false;
			for (let i = 0; i < 16; i++) {
				let player = lobby.slots[i];
				if (player && player.state === require('bancho.js').BanchoLobbyPlayerStates.NoMap) {
					playerHasNoMap = true;
				}
			}
			if (!playerHasNoMap) {
				await trySendMessage(channel, '!mp start 5');
			}
		});

		lobby.on('matchFinished', async (results) => {
			let nextModPool = getNextModPool(true);

			let beatmap = await getPoolBeatmap(nextModPool, nmStarRating, hdStarRating, hrStarRating, dtStarRating, fmStarRating, avoidMaps);
			let tries = 0;
			while (lobby._beatmapId != beatmap.beatmapId) {
				if (tries % 5 === 0 && tries) {
					beatmap = await getPoolBeatmap(nextModPool, nmStarRating, hdStarRating, hrStarRating, dtStarRating, fmStarRating, avoidMaps);
				}

				await trySendMessage(channel, '!mp abort');
				await trySendMessage(channel, `!mp map ${beatmap.beatmapId}`);
				await new Promise(resolve => setTimeout(resolve, 5000));
				await lobby.updateSettings();
				tries++;
			}

			if (winCondition === '3') {
				while (nextModPool === 'FM' && !lobby.freemod //There is no FreeMod combination otherwise
					|| nextModPool !== 'FM' && lobby.freemod
					|| nextModPool !== 'NM' && nextModPool !== 'FM' && !lobby.mods
					|| nextModPool === 'NM' && lobby.mods && lobby.mods.length !== 1 //Only NM has only one mod
					|| nextModPool === 'HD' && lobby.mods && lobby.mods.length < 2
					|| nextModPool === 'HD' && lobby.mods && lobby.mods[1].shortMod !== 'hd'
					|| nextModPool === 'HR' && lobby.mods && lobby.mods.length < 2
					|| nextModPool === 'HR' && lobby.mods && lobby.mods[1].shortMod !== 'hr'
					|| nextModPool === 'DT' && lobby.mods && lobby.mods.length < 2
					|| nextModPool === 'DT' && lobby.mods && lobby.mods[1].shortMod !== 'dt'
				) {
					if (nextModPool === 'FM') {
						await trySendMessage(channel, '!mp mods FreeMod');
					} else {
						await trySendMessage(channel, `!mp mods ${nextModPool} NF`);
					}

					await new Promise(resolve => setTimeout(resolve, 5000));
					await lobby.updateSettings();
				}
			} else {
				while (nextModPool === 'FM' && !lobby.freemod //There is no FreeMod combination otherwise
					|| nextModPool !== 'FM' && lobby.freemod
					|| nextModPool !== 'NM' && nextModPool !== 'FM' && !lobby.mods
					|| nextModPool === 'NM' && lobby.mods && lobby.mods.length //Only NM has only one mod
					|| nextModPool === 'HD' && lobby.mods && lobby.mods.length < 1
					|| nextModPool === 'HD' && lobby.mods && lobby.mods[0].shortMod !== 'hd'
					|| nextModPool === 'HR' && lobby.mods && lobby.mods.length < 1
					|| nextModPool === 'HR' && lobby.mods && lobby.mods[0].shortMod !== 'hr'
					|| nextModPool === 'DT' && lobby.mods && lobby.mods.length < 1
					|| nextModPool === 'DT' && lobby.mods && lobby.mods[0].shortMod !== 'dt'
				) {
					if (nextModPool === 'FM') {
						await trySendMessage(channel, '!mp mods FreeMod');
					} else {
						await trySendMessage(channel, `!mp mods ${nextModPool}`);
					}

					await new Promise(resolve => setTimeout(resolve, 5000));
				}
			}

			await trySendMessage(channel, '!mp timer 120');
		});

		function getNextModPool(remove) {
			let modPool = null;

			if (remove) {
				let index = Math.floor(Math.random() * currentPotentialMods.length);
				modPool = currentPotentialMods[index];
				currentPotentialMods.splice(index, 1);
			}

			currentPotentialMods.push(mods[poolIterator % mods.length]);
			poolIterator++;

			return modPool;
		}
	},
};

async function getPoolBeatmap(modPool, nmStarRating, hdStarRating, hrStarRating, dtStarRating, fmStarRating, avoidMaps) {
	let userStarRating = nmStarRating;
	if (modPool === 'HD') {
		userStarRating = hdStarRating;
	} else if (modPool === 'HR') {
		userStarRating = hrStarRating;
	} else if (modPool === 'DT') {
		userStarRating = dtStarRating;
	} else if (modPool === 'FM') {
		userStarRating = fmStarRating;
	}

	let beatmap = await getNextMap(modPool, userStarRating - 0.125, userStarRating + 0.125, false, avoidMaps);

	avoidMaps.push(beatmap.beatmapId);

	return beatmap;
}