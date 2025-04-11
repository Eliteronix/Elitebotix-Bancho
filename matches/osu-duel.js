const { DBElitebotixOsuMultiGameScores, DBElitebotixProcessQueue, DBElitebotixOsuMultiMatches } = require('../dbObjects');
const { logMatchCreation, updateQueueChannels, addMatchMessage, restartIfPossible, reconnectToBanchoAndChannels, trySendMessage } = require('../utils');
const { getUserDuelStarRating, saveOsuMultiScores, getNextMap, humanReadable } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const osu = require('node-osu');
const { osuFilterWords } = require('../config.json');
const { Op } = require('sequelize');

module.exports = {
	async execute(bancho, interaction, averageStarRating, lowerBound, upperBound, bestOf, onlyRanked, users, queued) {
		if (interaction) {
			await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'interactionResponse', additions: `${interaction};Duel has been accepted. Getting necessary data...`, priority: 1, date: new Date() });
		}

		// Get the maps to avoid
		// Remove all maps played in the last 3 months
		// Remove all maps that have been played but not by all players
		let beatmapIds = [];
		let beatmaps = [];

		let avoidMaps = [];
		let threeMonthsAgo = new Date();
		threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

		const playerScores = await DBElitebotixOsuMultiGameScores.findAll({
			attributes: ['osuUserId', 'beatmapId', 'gameStartDate'],
			where: {
				osuUserId: {
					[Op.in]: users.map(user => user.osuUserId),
				},
				tourneyMatch: true,
				mode: 0,
				warmup: {
					[Op.not]: true,
				}
			}
		});

		for (let i = 0; i < users.length; i++) {
			const currentPlayerScores = playerScores.filter(score => score.osuUserId == users[i].osuUserId);

			for (let j = 0; j < currentPlayerScores.length; j++) {
				if (currentPlayerScores[j].gameStartDate > threeMonthsAgo && !avoidMaps.includes(currentPlayerScores[j].beatmapId)) {
					avoidMaps.push(currentPlayerScores[j].beatmapId);
				}

				//TODO: Just noticed different issue with maps played multiple times because it will count as multiple people having played them
				//      Will have to remove duplicates
				if (beatmapIds.includes(currentPlayerScores[j].beatmapId)) {
					beatmaps[beatmapIds.indexOf(currentPlayerScores[j].beatmapId)].count++;
				} else {
					beatmapIds.push(currentPlayerScores[j].beatmapId);
					beatmaps.push({ beatmapId: currentPlayerScores[j].beatmapId, count: 1 });
				}
			}
		}

		if (users.length === 2) {
			// Remove all maps that have not been played by all players
			for (let i = 0; i < beatmaps.length; i++) {
				if (beatmaps[i].count < users.length && !avoidMaps.includes(beatmaps[i].beatmapId)) {
					avoidMaps.push(beatmaps[i].beatmapId);
				}
			}
		}

		// Set up the modpools
		let modPools = [];

		//Fill as much as needed in groups
		while (modPools.length < bestOf - 1) {
			let modsToAdd = ['NM', 'HD', 'HR', 'DT', 'FreeMod'];
			shuffle(modsToAdd);
			modsToAdd.push('NM');

			while (modsToAdd.length) {
				modPools.push(modsToAdd.shift());
			}
		}

		//Remove everything that is too much
		while (modPools.length > bestOf - 1) {
			modPools.splice(modPools.length - 1, 1);
		}

		//Add TieBreaker
		modPools.push('FreeMod');

		//Set up the lobby
		let channel = null;

		let team1 = [];
		let team2 = [];
		let teamname1 = '';
		let teamname2 = '';

		for (let i = 0; i < users.length; i++) {
			let teamSize = users.length / 2;
			let perTeamIterator = i % teamSize;

			if (i < teamSize) {
				team1.push(users[i]);
				teamname1 += users[i].osuName.substring(Math.floor(users[i].osuName.length / teamSize * perTeamIterator), Math.floor(users[i].osuName.length / teamSize * perTeamIterator) + Math.floor(users[i].osuName.length / teamSize) + 1);
			} else {
				team2.push(users[i]);
				teamname2 += users[i].osuName.substring(Math.floor(users[i].osuName.length / teamSize * perTeamIterator), Math.floor(users[i].osuName.length / teamSize * perTeamIterator) + Math.floor(users[i].osuName.length / teamSize) + 1);
			}
		}

		if (interaction) {
			await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'interactionResponse', additions: `${interaction};Creating match lobby for ${teamname1} vs ${teamname2}`, priority: 1, date: new Date() });
		}

		for (let i = 0; i < 5; i++) {
			try {
				await reconnectToBanchoAndChannels(bancho);

				// console.log('Duel Match: Creating match');
				if (users.length === 2) {
					// console.log(`ETX: (${teamname1}) vs (${teamname2})`)
					channel = await bancho.createLobby(`ETX: (${teamname1}) vs (${teamname2})`);
				} else {
					// console.log(`ETX Teams: (${teamname1}) vs (${teamname2})`)
					channel = await bancho.createLobby(`ETX Teams: (${teamname1}) vs (${teamname2})`);
				}
				bancho.duels.push(parseInt(channel.lobby.id));
				// console.log('Duel Match: Created match');
				break;
			} catch (error) {
				// console.error(i, error);
				if (i === 4) {
					console.error(error);
					if (interaction) {
						return await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'interactionResponse', additions: `${interaction};I am having issues creating the lobby and the match has been aborted.\nPlease try again later.`, priority: 1, date: new Date() });
					} else {
						return console.error('I am having issues creating a queued lobby and the match has been aborted.');
					}
				} else {
					await new Promise(resolve => setTimeout(resolve, 10000));
				}
			}
		}

		let lobbyStatus = 'Checking online status';

		let usersToCheck = [];
		let usersNotOnline = [];
		let usersOnline = [];

		channel.on('message', async (msg) => {
			addMatchMessage(lobby.id, matchMessages, msg.user.ircUsername, msg.message);

			if (usersToCheck.length && msg.user.ircUsername === 'BanchoBot') {
				if (msg.message === 'The user is currently not online.') {
					usersNotOnline.push(usersToCheck.shift());
				} else if (msg.message.includes('is in') || msg.message === 'The user\'s location could not be determined.') {
					usersOnline.push(usersToCheck.shift());
				}
			}
		});

		const lobby = channel.lobby;
		logMatchCreation(lobby.name, lobby.id);

		const password = Math.random().toString(36).substring(8);

		let matchMessages = [];
		await lobby.setPassword(password);
		await trySendMessage(channel, '!mp addref Eliteronix');
		await trySendMessage(channel, '!mp map 975342 0');
		if (users.length > 2) {
			await trySendMessage(channel, `!mp set 2 3 ${users.length + 1}`);
		} else {
			await trySendMessage(channel, `!mp set 0 3 ${users.length + 1}`);
		}
		await trySendMessage(channel, '!mp lock');

		if (queued) {
			for (let i = 0; i < users.length; i++) {
				usersToCheck.push(users[i]);
			}
		}

		while (usersToCheck.length) {
			await trySendMessage(channel, `!where ${usersToCheck[0].osuName.replaceAll(' ', '_')}`);
			await new Promise(resolve => setTimeout(resolve, 5000));
		}

		if (usersNotOnline.length) {
			lobby.closeLobby();

			for (let i = 0; i < usersOnline.length; i++) {
				await DBElitebotixProcessQueue.create({
					guildId: 'none',
					task: 'duelQueue1v1',
					additions: `${usersOnline[i].osuUserId};${usersOnline[i].osuDuelStarRating};0.5`,
					date: new Date(),
					priority: 9
				});
			}

			updateQueueChannels();
			return;
		}

		lobbyStatus = 'Joining phase';
		let mapIndex = 0;

		for (let i = 0; i < users.length; i++) {
			await trySendMessage(channel, `!mp invite #${users[i].osuUserId}`);
			await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'messageUser', additions: `${users[i].userId};${interaction};Your match has been created. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\`;[Duel] <@${users[i].userId}>, it seems like I can't DM you in Discord. Please enable DMs so that I can keep you up to date with the match procedure!`, priority: 1, date: new Date() });
		}

		// let pingMessage = null;
		if (interaction) {
			await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'interactionResponse', additions: `${interaction};<@${users.map(user => user.userId).join('>, <@')}> your match has been created. You have been invited ingame by \`${process.env.OSUNAME}\` and also got a DM as a backup. <https://osu.ppy.sh/mp/${lobby.id}>`, priority: 1, date: new Date() });
			// pingMessage = await interaction.channel.send(`<@${users.map(user => user.userId).join('>, <@')}>`);
			// await pingMessage.delete();
		}
		//Start the timer to close the lobby if not everyone joined by then
		await trySendMessage(channel, '!mp timer 300');

		let playerIds = users.map(user => user.osuUserId);
		let scores = [0, 0];

		let joinedUsers = [];

		let currentMapSelected = false;

		let waitedForMapdownload = false;

		//Add discord messages and also ingame invites for the timers
		channel.on('message', async (msg) => {
			if (msg.user.ircUsername === 'BanchoBot' && msg.message === 'Countdown finished') {
				//Banchobot countdown finished
				if (lobbyStatus === 'Joining phase') {
					if (queued) {
						//Requeue everyone who joined automatically
						joinedUsers.forEach(async (joinedUser) => {
							let user = users.find(user => user.osuUserId === joinedUser);

							//Requeue
							await DBElitebotixProcessQueue.create({
								guildId: 'none',
								task: 'duelQueue1v1',
								additions: `${user.osuUserId};${user.osuDuelStarRating};0.5`,
								date: new Date(),
								priority: 9
							});

							updateQueueChannels();

							//Message about requeueing
							const IRCUser = bancho.getUser(user.osuName);
							trySendMessage(IRCUser, 'You have automatically been requeued for a 1v1 duel. You will be notified when a match is found.');
						});
					}

					//Not everyone joined and the lobby will be closed
					await trySendMessage(channel, 'The lobby will be closed as not everyone joined.');
					await new Promise(resolve => setTimeout(resolve, 60000));
					await lobby.closeLobby();
					await channel.leave();

					//Remove the channel property from the bancho object to avoid trying to rejoin
					delete bancho.channels[`#mp_${lobby.id}`];

					bancho.duels = bancho.duels.filter((id) => id !== parseInt(lobby.id));

					// Restart if there are no more auto hosts and the bot is marked for update
					restartIfPossible(bancho);

					return;
				} else if (lobbyStatus === 'Waiting for start') {
					let playerHasNoMap = false;
					for (let i = 0; i < 16; i++) {
						let player = lobby.slots[i];
						if (player && player.state === require('bancho.js').BanchoLobbyPlayerStates.NoMap) {
							playerHasNoMap = true;
						}
					}

					if (waitedForMapdownload || !playerHasNoMap) {
						//just start; we waited another minute already
						waitedForMapdownload = false;
						await trySendMessage(channel, '!mp start 5');
						await new Promise(resolve => setTimeout(resolve, 3000));
						await lobby.updateSettings();
						lobbyStatus === 'Map being played';
					} else {
						waitedForMapdownload = true;
						await trySendMessage(channel, 'A player is missing the map. Waiting only 1 minute longer.');
						await trySendMessage(channel, '!mp timer 60');
					}
				}
			}
		});

		lobby.on('playerJoined', async (obj) => {
			orderMatchPlayers(lobby, channel, [...users]);

			//Add to an array of joined users for requeueing
			if (!joinedUsers.includes(obj.player.user.id.toString())) {
				joinedUsers.push(obj.player.user.id.toString());
			}

			if (!playerIds.includes(obj.player.user.id.toString())) {
				trySendMessage(channel, `!mp kick #${obj.player.user.id}`);
			} else if (lobbyStatus === 'Joining phase') {
				let allPlayersJoined = true;
				for (let i = 0; i < users.length && allPlayersJoined; i++) {
					if (!lobby.playersById[users[i].osuUserId.toString()]) {
						allPlayersJoined = false;
					}
				}
				if (allPlayersJoined) {
					lobbyStatus = 'Waiting for start';

					await trySendMessage(channel, `Average star rating of the mappool: ${Math.round(averageStarRating * 100) / 100}`);

					await trySendMessage(channel, 'Looking for a map...');

					let nextMap = null;
					let tries = 0;
					while (tries === 0 || lobby._beatmapId != nextMap.beatmapId) {
						if (tries % 5 === 0) {
							if (bestOf === 1) {
								nextMap = await getNextMap('TieBreaker', lowerBound, upperBound, onlyRanked, avoidMaps);
							} else {
								nextMap = await getNextMap(modPools[mapIndex], lowerBound, upperBound, onlyRanked, avoidMaps);
							}
							avoidMaps.push(nextMap.beatmapId);
						}

						await trySendMessage(channel, '!mp abort');
						await trySendMessage(channel, `!mp map ${nextMap.beatmapId}`);
						await new Promise(resolve => setTimeout(resolve, 5000));
						await lobby.updateSettings();
						tries++;
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
						await trySendMessage(channel, `!mp mods ${modPools[mapIndex]} ${noFail}`);
						await new Promise(resolve => setTimeout(resolve, 5000));
					}

					currentMapSelected = true;

					(async () => {
						let mapInfo = await getOsuMapInfo(nextMap);
						await trySendMessage(channel, mapInfo);
					})();

					if (bestOf === 1) {
						await trySendMessage(channel, 'Valid Mods: HD, HR, EZ (x1.7) | NM will be just as achieved.');
					} else if (modPools[mapIndex] === 'FreeMod') {
						await trySendMessage(channel, 'Valid Mods: HD, HR, EZ (x1.7) | NM will be 0.5x of the score achieved.');
					}
					await trySendMessage(channel, 'Everyone please ready up!');
					await trySendMessage(channel, '!mp timer 120');
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
			if (currentMapSelected && lobbyStatus === 'Waiting for start' && playersInLobby === users.length) {
				await trySendMessage(channel, '!mp start 5');
				await new Promise(resolve => setTimeout(resolve, 3000));
				await lobby.updateSettings();
				lobbyStatus === 'Map being played';
			} else if (!currentMapSelected && lobbyStatus === 'Waiting for start' && playersInLobby === users.length) {
				await trySendMessage(channel, 'Give me a moment, I am still searching for the best map ;w;');
			}
		});

		lobby.on('matchFinished', async (results) => {
			currentMapSelected = false;
			if (modPools[mapIndex] === 'FreeMod') {
				for (let i = 0; i < results.length; i++) {
					//Increase the score by 1.7 if EZ was played
					if (results[i].player.mods) {
						for (let j = 0; j < results[i].player.mods.length; j++) {
							if (results[i].player.mods[j].enumValue === 2) {
								results[i].score = results[i].score * 1.7;
							}
						}
					}
				}
			}

			if (modPools[mapIndex] === 'FreeMod' && mapIndex < bestOf - 1) {
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

			//Sort the results descending
			results.sort((a, b) => {
				return b.score - a.score;
			});

			let scoreTeam1 = 0;
			let scoreTeam2 = 0;

			//If the player is in the first team add to team 1, otherwise add to team 2
			//Create a helper array with the first half of the players
			let firstTeam = team1.map(user => user.osuUserId);

			for (let i = 0; i < results.length; i++) {
				if (firstTeam.includes(results[i].player.user.id.toString())) {
					scoreTeam1 += parseFloat(results[i].score);
				} else {
					scoreTeam2 += parseFloat(results[i].score);
				}
			}

			if (results.length) {
				let winner = teamname1;

				if (scoreTeam1 < scoreTeam2) {
					winner = teamname2;
				}

				scoreTeam1 = Math.round(scoreTeam1);
				scoreTeam2 = Math.round(scoreTeam2);

				await trySendMessage(channel, `Bo${bestOf} | ${teamname1}: ${humanReadable(scoreTeam1)} | ${teamname2}: ${humanReadable(scoreTeam2)} | Difference: ${humanReadable(Math.abs(scoreTeam1 - scoreTeam2))} | Winner: ${winner}`);
			} else {
				await lobby.closeLobby();
				await channel.leave();

				//Remove the channel property from the bancho object to avoid trying to rejoin
				delete bancho.channels[`#mp_${lobby.id}`];

				bancho.duels = bancho.duels.filter((id) => id !== parseInt(lobby.id));

				const osuApi = new osu.Api(process.env.OSUTOKENV1, {
					// baseUrl: sets the base api url (default: https://osu.ppy.sh/api)
					notFoundAsError: true, // Throw an error on not found instead of returning nothing. (default: true)
					completeScores: false, // When fetching scores also fetch the beatmap they are for (Allows getting accuracy) (default: false)
					parseNumeric: false // Parse numeric values into numbers/floats, excluding ids
				});

				osuApi.getMatch({ mp: lobby.id })
					.then(async (match) => {
						saveOsuMultiScores(match);
					})
					.catch(() => {
						//Nothing
					});

				// Restart if there are no more auto hosts and the bot is marked for update
				restartIfPossible(bancho);

				return;
			}

			//Increase the score of the player at the top of the list
			if (scoreTeam1 > scoreTeam2) {
				scores[0]++;
			} else {
				scores[1]++;
			}
			await trySendMessage(channel, `Score: ${teamname1} | ${scores[0]} - ${scores[1]} | ${teamname2}`);

			if (scores[0] < (bestOf + 1) / 2 && scores[1] < (bestOf + 1) / 2) {
				mapIndex++;
				lobbyStatus = 'Waiting for start';

				await trySendMessage(channel, 'Looking for a map...');

				let nextMap = null;
				let tries = 0;
				while (tries === 0 || lobby._beatmapId != nextMap.beatmapId) {
					if (tries % 5 === 0) {
						if (scores[0] + scores[1] === bestOf - 1) {
							nextMap = await getNextMap('TieBreaker', lowerBound, upperBound, onlyRanked, avoidMaps);
						} else {
							nextMap = await getNextMap(modPools[mapIndex], lowerBound, upperBound, onlyRanked, avoidMaps);
						}

						avoidMaps.push(nextMap.beatmapId);
					}

					await trySendMessage(channel, '!mp abort');
					await trySendMessage(channel, `!mp map ${nextMap.beatmapId}`);
					await new Promise(resolve => setTimeout(resolve, 5000));
					await lobby.updateSettings();
					tries++;
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
					await trySendMessage(channel, `!mp mods ${modPools[mapIndex]} ${noFail}`);
					await new Promise(resolve => setTimeout(resolve, 5000));
					await lobby.updateSettings();
				}

				currentMapSelected = true;

				(async () => {
					let mapInfo = await getOsuMapInfo(nextMap);
					await trySendMessage(channel, mapInfo);
				})();

				await trySendMessage(channel, 'Everyone please ready up!');
				if (modPools[mapIndex] === 'FreeMod' && mapIndex < bestOf - 1) {
					await trySendMessage(channel, 'Valid Mods: HD, HR, EZ (x1.7) | NM will be 0.5x of the score achieved.');
				} else if (modPools[mapIndex] === 'FreeMod' && mapIndex === bestOf - 1) {
					await trySendMessage(channel, 'Valid Mods: HD, HR, EZ (x1.7) | NM will be just as achieved.');
				}
				await trySendMessage(channel, '!mp timer 120');
			} else {
				lobbyStatus = 'Lobby finished';

				if (scores[0] === (bestOf + 1) / 2) {
					await trySendMessage(channel, `Congratulations ${teamname1} for winning the match!`);
				} else {
					await trySendMessage(channel, `Congratulations ${teamname2} for winning the match!`);
				}
				await trySendMessage(channel, 'Thank you for playing! The lobby will automatically close in one minute.');
				await new Promise(resolve => setTimeout(resolve, 5000));

				const osuApi = new osu.Api(process.env.OSUTOKENV1, {
					// baseUrl: sets the base api url (default: https://osu.ppy.sh/api)
					notFoundAsError: true, // Throw an error on not found instead of returning nothing. (default: true)
					completeScores: false, // When fetching scores also fetch the beatmap they are for (Allows getting accuracy) (default: false)
					parseNumeric: false // Parse numeric values into numbers/floats, excluding ids
				});

				osuApi.getMatch({ mp: lobby.id })
					.then(async (match) => {
						await saveOsuMultiScores(match);

						for (let i = 0; i < users.length; i++) {
							let userDuelStarRating = await getUserDuelStarRating({ osuUserId: users[i].osuUserId });
							let messages = ['Your SR has been updated!'];
							if (Math.round(users[i].osuDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.total * 1000) / 1000) {
								messages.push(`SR: ${Math.round(users[i].osuDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.total * 1000) / 1000}`);
							}
							if (Math.round(users[i].osuNoModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.noMod * 1000) / 1000) {
								messages.push(`NM: ${Math.round(users[i].osuNoModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.noMod * 1000) / 1000}`);
							}
							if (Math.round(users[i].osuHiddenDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hidden * 1000) / 1000) {
								messages.push(`HD: ${Math.round(users[i].osuHiddenDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hidden * 1000) / 1000}`);
							}
							if (Math.round(users[i].osuHardRockDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.hardRock * 1000) / 1000) {
								messages.push(`HR: ${Math.round(users[i].osuHardRockDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.hardRock * 1000) / 1000}`);
							}
							if (Math.round(users[i].osuDoubleTimeDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.doubleTime * 1000) / 1000) {
								messages.push(`DT: ${Math.round(users[i].osuDoubleTimeDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.doubleTime * 1000) / 1000}`);
							}
							if (Math.round(users[i].osuFreeModDuelStarRating * 1000) / 1000 !== Math.round(userDuelStarRating.freeMod * 1000) / 1000) {
								messages.push(`FM: ${Math.round(users[i].osuFreeModDuelStarRating * 1000) / 1000} -> ${Math.round(userDuelStarRating.freeMod * 1000) / 1000}`);
							}
							if (messages.length > 1) {
								const IRCUser = await bancho.getUser(users[i].osuName);
								for (let i = 0; i < messages.length; i++) {
									await trySendMessage(IRCUser, messages[i]);
								}
							}
						}
					})
					.catch(() => {
						//Nothing
					});

				await new Promise(resolve => setTimeout(resolve, 55000));
				await lobby.closeLobby();
				await channel.leave();

				//Remove the channel property from the bancho object to avoid trying to rejoin
				delete bancho.channels[`#mp_${lobby.id}`];

				bancho.duels = bancho.duels.filter((id) => id !== parseInt(lobby.id));

				// Restart if there are no more auto hosts and the bot is marked for update
				restartIfPossible(bancho);

				return;
			}
		});
	}
};

async function orderMatchPlayers(lobby, channel, players) {
	for (let i = 0; i < players.length; i++) {
		players[i].slot = i;
		let slot = lobby._slots.find(slot => slot && slot.user._id.toString() === players[i].osuUserId);

		//Check if the players are in the correct teams
		if (players.length > 2) {
			let expectedTeam = 'Red';

			if (i >= players.length / 2) {
				expectedTeam = 'Blue';
			}

			if (slot && slot.team !== expectedTeam) {
				trySendMessage(channel, `!mp team #${players[i].osuUserId} ${expectedTeam}`);
			}
		}
	}

	//Move players to their slots
	let initialPlayerAmount = players.length;
	let movedSomeone = true;
	let hasEmptySlots = true;
	while (players.length && hasEmptySlots) {
		if (!movedSomeone) {
			//Move someone to last slot if that is empty
			await trySendMessage(channel, `!mp move #${players[0].osuUserId} ${initialPlayerAmount + 1}`);
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		movedSomeone = false;

		//Collect a list of empty slots
		let emptySlots = [];
		for (let i = 0; i < initialPlayerAmount + 1; i++) {
			if (lobby._slots[i] === null) {
				emptySlots.push(i);
			}
		}

		if (emptySlots.length === 0) {
			hasEmptySlots = false;
			continue;
		}

		//Move players to the correct slots
		for (let i = 0; i < players.length; i++) {
			let slotIndex = null;
			for (let j = 0; j < initialPlayerAmount + 1; j++) {
				if (lobby._slots[j] && lobby._slots[j].user._id.toString() === players[i].osuUserId) {
					slotIndex = j;
				}
			}

			if (slotIndex === null) {
				players.splice(i, 1);
				i--;
				continue;
			}

			if (players[i].slot !== slotIndex && emptySlots.includes(players[i].slot)) {
				await trySendMessage(channel, `!mp move #${players[i].osuUserId} ${players[i].slot + 1}`);
				await new Promise(resolve => setTimeout(resolve, 2000));
				emptySlots.splice(emptySlots.indexOf(players[i].slot), 1);
				emptySlots.push(slotIndex);
				movedSomeone = true;
			} else if (players[i].slot === slotIndex) {
				players.splice(i, 1);
				i--;
				continue;
			}
		}
	}
}

async function getOsuMapInfo(dbBeatmap) {
	const mapScores = await DBElitebotixOsuMultiGameScores.findAll({
		attributes: ['matchId'],
		where: {
			beatmapId: dbBeatmap.beatmapId,
			tourneyMatch: true,
			warmup: {
				[Op.not]: true
			}
		}
	});

	const matches = await DBElitebotixOsuMultiMatches.findAll({
		attributes: ['matchName'],
		where: {
			matchId: {
				[Op.in]: mapScores.map(score => score.matchId)
			},
			tourneyMatch: true,
			matchName: {
				[Op.notLike]: 'MOTD:%',
			},
		}
	});

	let tournaments = [];

	for (let i = 0; i < matches.length; i++) {
		let acronym = matches[i].matchName.replace(/:.+/gm, '');

		if (tournaments.indexOf(acronym) === -1) {
			tournaments.push(acronym);
		}
	}

	let more = 0;

	for (let i = 0; i < tournaments.length; i++) {
		for (let j = 0; j < osuFilterWords.length; j++) {
			if (tournaments[i].toLowerCase().includes(osuFilterWords[j])) {
				tournaments.splice(i, 1);
				i--;
				more++;
				break;
			}
		}
	}

	let tournamentString = `https://osu.ppy.sh/b/${dbBeatmap.beatmapId} | https://beatconnect.io/b/${dbBeatmap.beatmapsetId} | Map played ${mapScores.length} times in: ${tournaments.join(', ')}`;

	if (more > 0) {
		tournamentString += ` and ${more} more tournaments`;
	}

	return tournamentString;
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