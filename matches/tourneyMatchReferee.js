const { DBElitebotixProcessQueue, DBElitebotixDiscordUsers, DBElitebotixOsuBeatmaps } = require('../dbObjects');
const { logMatchCreation, addMatchMessage, reconnectToBanchoAndChannels, trySendMessage, updateCurrentMatchesChannel, restartIfPossible, updateUniqueOsuUsers } = require('../utils');
const osu = require('node-osu');
const { pause, saveOsuMultiScores } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const { osuApiRequests } = require('../metrics.js');

module.exports = {
	async execute(bancho, processQueueEntry) {
		// console.log('tourneyMatchReferee');
		let args = processQueueEntry.additions.split(';');

		let channel;

		for (let i = 0; i < 5; i++) {
			try {
				reconnectToBanchoAndChannels(bancho);

				channel = await bancho.createLobby(args[5]);

				bancho.tourneyMatchReferees.push(parseInt(channel.lobby.id));

				let tourneyMatch = 0;
				if (args[5].toLowerCase().match(/.+:.+vs.+/g)) {
					tourneyMatch = 1;
				}

				DBElitebotixProcessQueue.create({ guildId: 'None', task: 'importMatch', additions: `${channel.lobby.id};${tourneyMatch};${new Date().getTime()};${args[5]}`, priority: 1, date: new Date() });
				updateCurrentMatchesChannel();

				processQueueEntry.destroy();
				break;
			} catch (error) {
				if (i === 4) {
					console.error(error);
					processQueueEntry.destroy();

					let players = args[3].replaceAll('|', ',').split(',');
					let dbPlayers = [];
					for (let j = 0; j < players.length; j++) {
						const dbDiscordUser = await DBElitebotixDiscordUsers.findOne({
							attributes: ['id', 'osuName'],
							where: {
								id: players[j]
							}
						});
						dbPlayers.push(dbDiscordUser);
					}

					// Sort players by id desc
					dbPlayers.sort((a, b) => (a.id > b.id) ? 1 : -1);

					players = args[3];
					for (let j = 0; j < dbPlayers.length; j++) {
						players = players.replace(dbPlayers[j].dataValues.id, dbPlayers[j].dataValues.osuName);
					}

					await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'messageUser', additions: `${args[0]};;I am having issues creating the lobby and the match has been aborted.\nMatch: \`${args[5]}\`\nScheduled players: ${players}\nMappool: ${args[6]}`, priority: 1, date: new Date() });

					await DBElitebotixProcessQueue.create({
						guildId: 'None',
						task: 'messageChannel',
						additions: `${args[1]};;I am having issues creating the lobby and the match has been aborted.\nMatch: \`${args[5]}\`\nScheduled players: ${players}\nMappool: ${args[6]}`,
						priority: 1,
						date: new Date()
					});
					return;
				} else {
					await pause(10000);
				}
			}
		}

		let teams = args[3].split('|');
		let playerIds = [];
		let discordIds = [];
		for (let i = 0; i < teams.length; i++) {
			teams[i] = teams[i].split(',');
			for (let j = 0; j < teams[i].length; j++) {
				const dbDiscordUser = await DBElitebotixDiscordUsers.findOne({
					attributes: ['osuUserId', 'userId', 'osuName'],
					where: {
						id: teams[i][j]
					}
				});

				playerIds.push(dbDiscordUser.osuUserId);
				discordIds.push(dbDiscordUser.userId);

				// const user = await client.users.fetch(dbDiscordUser.userId); //TODO: This
				// dbDiscordUser.user = user;

				teams[i][j] = dbDiscordUser;
			}
		}

		let matchMessages = [];

		channel.on('message', async (msg) => {
			updateUniqueOsuUsers(msg.user.id);

			addMatchMessage(lobby.id, matchMessages, msg.user.ircUsername, msg.message);
		});

		const lobby = channel.lobby;
		logMatchCreation(lobby.name, lobby.id);

		const password = Math.random().toString(36).substring(8);

		await lobby.setPassword(password);
		await trySendMessage(channel, '!mp addref Eliteronix');
		await trySendMessage(channel, '!mp map 975342 0');
		await trySendMessage(channel, `!mp set 0 ${args[7]} ${playerIds.length}`);
		let lobbyStatus = 'Joining phase';
		let mapIndex = 0;
		let maps = args[2].split(',');
		let mappoolReadable = args[6].split(',');
		let dbMaps = [];

		for (let i = 0; i < maps.length; i++) {
			const dbOsuBeatmap = await DBElitebotixOsuBeatmaps.findOne({
				attributes: ['beatmapId', 'mods'],
				where: {
					id: maps[i]
				}
			});

			if (mappoolReadable[i].toUpperCase().includes('FM')) {
				dbOsuBeatmap.freeMod = true;
			}

			dbMaps.push(dbOsuBeatmap);
		}

		//Send the MP to the scheduler
		try {
			let players = args[3].replaceAll('|', ',').split(',');
			let dbPlayers = [];
			for (let j = 0; j < players.length; j++) {
				const dbDiscordUser = await DBElitebotixDiscordUsers.findOne({
					attributes: ['id', 'osuName'],
					where: {
						id: players[j]
					}
				});
				dbPlayers.push(dbDiscordUser);
			}

			// Sort players by id desc
			dbPlayers.sort((a, b) => (a.id > b.id) ? 1 : -1);

			players = args[3];
			for (let j = 0; j < dbPlayers.length; j++) {
				players = players.replace(dbPlayers[j].dataValues.id, dbPlayers[j].dataValues.osuName);
			}

			await DBElitebotixProcessQueue.create({
				guildId: 'None',
				task: 'messageUser',
				additions: `${args[0]};;The scheduled Qualifier match has started. <https://osu.ppy.sh/mp/${lobby.id}>\nMatch: \`${args[5]}\`\nScheduled players: ${players}\nMappool: ${args[6]}`,
				priority: 1,
				date: new Date()
			});
			// eslint-disable-next-line no-unused-vars
		} catch (e) {
			//Nothing
		}

		for (let i = 0; i < teams.length; i++) {
			for (let j = 0; j < teams[i].length; j++) {
				await trySendMessage(channel, `!mp invite #${teams[i][j].osuUserId}`); //TODO: This
				await DBElitebotixProcessQueue.create({
					guildId: 'None',
					task: 'messageUserOrChannel',
					additions: `${teams[i][j].userId};${args[1]};Your match has been created. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\`;<@${teams[i][j].userId}>, it seems like I can't DM you. Please enable DMs so that I can keep you up to date with the match procedure!`,
					priority: 1,
					date: new Date()
				});
			}
		}

		await DBElitebotixProcessQueue.create({
			guildId: 'None',
			task: 'messageChannel',
			additions: `${args[1]};<@${discordIds.join('>, <@')}> your match has been created. You have been invited ingame by \`${process.env.OSUNAME}\` and also got a DM as a backup.`,
			priority: 1,
			date: new Date()
		});

		//Add timers to 10 minutes after the match and also during the scheduled time send another message
		let matchStartingTime = new Date();
		matchStartingTime.setUTCFullYear(processQueueEntry.date.getUTCFullYear());
		matchStartingTime.setUTCMonth(processQueueEntry.date.getUTCMonth());
		matchStartingTime.setUTCDate(processQueueEntry.date.getUTCDate());
		matchStartingTime.setUTCHours(processQueueEntry.date.getUTCHours());
		matchStartingTime.setUTCMinutes(processQueueEntry.date.getUTCMinutes());
		matchStartingTime.setUTCSeconds(processQueueEntry.date.getUTCSeconds());
		matchStartingTime.setUTCMinutes(processQueueEntry.date.getUTCMinutes() + 10);
		let secondRoundOfInvitesSent = false;

		let forfeitTimer = new Date();
		forfeitTimer.setUTCFullYear(processQueueEntry.date.getUTCFullYear());
		forfeitTimer.setUTCMonth(processQueueEntry.date.getUTCMonth());
		forfeitTimer.setUTCDate(processQueueEntry.date.getUTCDate());
		forfeitTimer.setUTCHours(processQueueEntry.date.getUTCHours());
		forfeitTimer.setUTCMinutes(processQueueEntry.date.getUTCMinutes());
		forfeitTimer.setUTCSeconds(processQueueEntry.date.getUTCSeconds());
		forfeitTimer.setUTCMinutes(processQueueEntry.date.getUTCMinutes() + 20);
		let currentTime = new Date();
		let secondsUntilForfeit = Math.round((forfeitTimer - currentTime) / 1000) + 30;
		await trySendMessage(channel, `!mp timer ${secondsUntilForfeit}`);
		let noFail = 0;
		if (args[4] === 'true') {
			noFail = 1;
		}

		let teamsThatDontSeemToForfeit = [];

		//Add discord messages and also ingame invites for the timers
		channel.on('message', async (msg) => {
			let now = new Date();
			if (msg.user.ircUsername === 'BanchoBot' && msg.message === 'Countdown finished') {
				//Banchobot countdown finished
				if (lobbyStatus === 'Joining phase') {
					await lobby.updateSettings();
					let allPlayersReady = true;
					for (let i = 0; i < 16; i++) {
						let player = lobby.slots[i];
						if (player && player.state !== require('bancho.js').BanchoLobbyPlayerStates.Ready) {
							allPlayersReady = false;
						}
					}

					if (allPlayersReady) {
						await trySendMessage(channel, '!mp start 10');

						lobbyStatus === 'Map being played';
					} else {
						lobbyStatus = 'Waiting for start';

						await trySendMessage(channel, 'Everyone please ready up!');
						await trySendMessage(channel, '!mp timer 120');
					}
				} else if (lobbyStatus === 'Waiting for start') {
					await trySendMessage(channel, '!mp start 10');

					lobbyStatus === 'Map being played';
				}
			} else if (forfeitTimer < now && lobbyStatus === 'Joining phase') {
				let noPlayers = true;
				for (let i = 0; i < 16; i++) {
					if (lobby.slots[i] !== null) {
						noPlayers = false;
					}
				}

				if (noPlayers) {
					lobbyStatus = 'Aborted';
					await trySendMessage(channel, '!mp close');

					let players = args[3].replaceAll('|', ',').split(',');
					let dbPlayers = [];
					for (let j = 0; j < players.length; j++) {
						const dbDiscordUser = await DBElitebotixDiscordUsers.findOne({
							attributes: ['id', 'osuName'],
							where: {
								id: players[j]
							}
						});
						dbPlayers.push(dbDiscordUser);
					}

					// Sort players by id desc
					dbPlayers.sort((a, b) => (a.id > b.id) ? 1 : -1);

					players = args[3];
					for (let j = 0; j < dbPlayers.length; j++) {
						players = players.replace(dbPlayers[j].dataValues.id, dbPlayers[j].dataValues.osuName);
					}

					await DBElitebotixProcessQueue.create({
						guildId: 'None',
						task: 'messageUser',
						additions: `${args[0]};;The scheduled Qualifier has been aborted because no one showed up. <https://osu.ppy.sh/mp/${lobby.id}>\nMatch: \`${args[5]}\`\nScheduled players: ${players}\nMappool: ${args[6]}`,
						priority: 1,
						date: new Date()
					});

					await lobby.closeLobby();
					await channel.leave();

					//Remove the channel property from the bancho object to avoid trying to rejoin
					delete bancho.channels[`#mp_${lobby.id}`];

					bancho.tourneyMatchReferees = bancho.tourneyMatchReferees.filter((id) => id !== parseInt(lobby.id));

					// Restart if there are no more auto hosts and the bot is marked for update
					restartIfPossible(bancho);

					return;
				}

				lobbyStatus = 'Waiting for start';

				let tries = 0;
				while (lobby._beatmapId != dbMaps[mapIndex].beatmapId && tries < 25) {
					await trySendMessage(channel, '!mp abort');
					await trySendMessage(channel, `!mp map ${dbMaps[mapIndex].beatmapId}`);
					await pause(5000);
					await lobby.updateSettings();
					tries++;
				}
				//Check mods and set them if needed
				let modBits = 0;
				if (lobby.mods) {
					for (let i = 0; i < lobby.mods.length; i++) {
						modBits += lobby.mods[i].enumValue;
					}
				}
				while (parseInt(dbMaps[mapIndex].mods) + noFail !== modBits) {
					await trySendMessage(channel, `!mp mods ${parseInt(dbMaps[mapIndex].mods) + noFail}`);
					await pause(5000);
					modBits = 0;
					if (lobby.mods) {
						for (let i = 0; i < lobby.mods.length; i++) {
							modBits += lobby.mods[i].enumValue;
						}
					}
				}

				if (dbMaps[mapIndex].freeMod) {
					await trySendMessage(channel, `!mp mods ${parseInt(dbMaps[mapIndex].mods) + noFail} freemod`);
					await trySendMessage(channel, args[8]);
				}

				await trySendMessage(channel, 'Everyone please ready up!');
				await trySendMessage(channel, '!mp timer 120');
			} else if (matchStartingTime < now && !secondRoundOfInvitesSent && lobbyStatus === 'Joining phase') {
				secondRoundOfInvitesSent = true;
				await lobby.updateSettings();
				for (let i = 0; i < teams.length; i++) {
					//Check if there are enough players in the lobby from the team
					let playersInLobby = 0;
					for (let j = 0; j < teams[i].length; j++) {
						if (lobby.playersById[teams[i][j].osuUserId.toString()]) {
							playersInLobby++;
						}
					}

					//If not enough players in the lobby invite the missing players
					if (playersInLobby < parseInt(args[9])) {
						for (let j = 0; j < teams[i].length; j++) {
							if (!lobby.playersById[teams[i][j].osuUserId.toString()]) {
								await trySendMessage(channel, `!mp invite #${teams[i][j].osuUserId}`);

								await DBElitebotixProcessQueue.create({
									guildId: 'None',
									task: 'messageUserOrChannel',
									additions: `${teams[i][j].userId};${args[1]};Your match is about to start. Please join as soon as possible. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\`;<@${teams[i][j].userId}>, it seems like I can't DM you. Please enable DMs so that I can keep you up to date with the match procedure!`,
									priority: 1,
									date: new Date()
								});

								await DBElitebotixProcessQueue.create({
									guildId: 'None',
									task: 'messageChannel',
									additions: `${args[1]};<@${teams[i][j].userId}> The lobby is about to start. I've sent you another invite.`,
									priority: 1,
									date: new Date()
								});
							}
						}
					}
				}
			}
		});

		lobby.on('playerJoined', async (obj) => {
			updateUniqueOsuUsers(obj.player.user.id);

			if (!playerIds.includes(obj.player.user.id.toString())) {
				trySendMessage(channel, `!mp kick #${obj.player.user.id}`);
			} else if (lobbyStatus === 'Joining phase') {
				await lobby.updateSettings();
				let allTeamsJoined = true;
				for (let i = 0; i < teams.length && allTeamsJoined; i++) {
					let playersInLobby = 0;
					for (let j = 0; j < teams[i].length; j++) {
						if (lobby.playersById[teams[i][j].osuUserId.toString()]) {
							playersInLobby++;
						}
					}

					if (playersInLobby < parseInt(args[9])) {
						allTeamsJoined = false;
					}
				}

				if (allTeamsJoined) {
					lobbyStatus = 'Waiting for start';

					let tries = 0;
					while (lobby._beatmapId != dbMaps[mapIndex].beatmapId && tries < 25) {
						await trySendMessage(channel, '!mp abort');
						await trySendMessage(channel, `!mp map ${dbMaps[mapIndex].beatmapId}`);
						await pause(5000);
						tries++;
					}
					//Check mods and set them if needed
					let modBits = 0;
					if (lobby.mods) {
						for (let i = 0; i < lobby.mods.length; i++) {
							modBits += lobby.mods[i].enumValue;
						}
					}
					while (parseInt(dbMaps[mapIndex].mods) + noFail !== modBits) {
						await trySendMessage(channel, `!mp mods ${parseInt(dbMaps[mapIndex].mods) + noFail}`);
						await pause(5000);
						modBits = 0;
						if (lobby.mods) {
							for (let i = 0; i < lobby.mods.length; i++) {
								modBits += lobby.mods[i].enumValue;
							}
						}
					}

					if (dbMaps[mapIndex].freeMod) {
						await trySendMessage(channel, `!mp mods ${parseInt(dbMaps[mapIndex].mods) + noFail} freemod`);
						await trySendMessage(channel, args[8]);
					}

					await trySendMessage(channel, 'Everyone please ready up!');
					await trySendMessage(channel, '!mp timer 120');
				}
			}

			//Add all players that belong into the lobby and have joined once already here
			for (let i = 0; i < teams.length; i++) {
				let playersInLobby = 0;
				for (let j = 0; j < teams[i].length; j++) {
					if (lobby.playersById[teams[i][j].osuUserId.toString()]) {
						playersInLobby++;
					}
				}

				if (playersInLobby >= parseInt(args[9])) {
					if (!teamsThatDontSeemToForfeit.includes(teams[i].join(','))) {
						teamsThatDontSeemToForfeit.push(teams[i].join(','));
					}
				}
			}
		});

		lobby.on('allPlayersReady', async () => {
			await lobby.updateSettings();
			let teamsInLobby = 0;
			for (let i = 0; i < teams.length; i++) {
				let playersInLobby = 0;
				for (let j = 0; j < teams[i].length; j++) {
					if (lobby.playersById[teams[i][j].osuUserId.toString()]) {
						playersInLobby++;
					}
				}

				if (playersInLobby >= parseInt(args[9])) {
					teamsInLobby++;
				}
			}

			//Check that all players are in the lobby that previously joined
			if (lobbyStatus === 'Waiting for start' && teamsInLobby >= teamsThatDontSeemToForfeit.length) {
				await trySendMessage(channel, '!mp start 10');

				lobbyStatus === 'Map being played';
			}
		});

		// eslint-disable-next-line no-unused-vars
		lobby.on('matchFinished', async (results) => {
			mapIndex++;
			if (mapIndex < dbMaps.length) {
				lobbyStatus = 'Waiting for start';

				let tries = 0;
				while (lobby._beatmapId != dbMaps[mapIndex].beatmapId && tries < 25) {
					await trySendMessage(channel, '!mp abort');
					await trySendMessage(channel, `!mp map ${dbMaps[mapIndex].beatmapId}`);
					await pause(5000);
					await lobby.updateSettings();
					tries++;
				}
				//Check mods and set them if needed
				let modBits = 0;
				if (lobby.mods) {
					for (let i = 0; i < lobby.mods.length; i++) {
						modBits += lobby.mods[i].enumValue;
					}
				}
				while (parseInt(dbMaps[mapIndex].mods) + noFail !== modBits) {
					await trySendMessage(channel, `!mp mods ${parseInt(dbMaps[mapIndex].mods) + noFail}`);
					await pause(5000);
					await lobby.updateSettings();
					modBits = 0;
					if (lobby.mods) {
						for (let i = 0; i < lobby.mods.length; i++) {
							modBits += lobby.mods[i].enumValue;
						}
					}
				}

				if (dbMaps[mapIndex].freeMod) {
					await trySendMessage(channel, `!mp mods ${parseInt(dbMaps[mapIndex].mods) + noFail} freemod`);
					await trySendMessage(channel, args[8]);
				}

				await trySendMessage(channel, 'Everyone please ready up!');
				await trySendMessage(channel, '!mp timer 120');
			} else {
				lobbyStatus = 'Lobby finished';

				await trySendMessage(channel, 'Thank you everyone for playing! The lobby will automatically close in one minute.');
				await pause(60000);
				await trySendMessage(channel, '!mp close');
				const osuApi = new osu.Api(process.env.OSUTOKENV1, {
					// baseUrl: sets the base api url (default: https://osu.ppy.sh/api)
					notFoundAsError: true, // Throw an error on not found instead of returning nothing. (default: true)
					completeScores: false, // When fetching scores also fetch the beatmap they are for (Allows getting accuracy) (default: false)
					parseNumeric: false // Parse numeric values into numbers/floats, excluding ids
				});

				osuApiRequests.inc();
				osuApi.getMatch({ mp: lobby.id })
					.then(async (match) => {
						saveOsuMultiScores(match);
					})
					.catch(() => {
						//Nothing
					});

				let players = args[3].replaceAll('|', ',').split(',');
				let dbPlayers = [];
				for (let j = 0; j < players.length; j++) {
					const dbDiscordUser = await DBElitebotixDiscordUsers.findOne({
						attributes: ['id', 'osuName'],
						where: {
							id: players[j]
						}
					});
					dbPlayers.push(dbDiscordUser);
				}

				// Sort players by id desc
				dbPlayers.sort((a, b) => (a.id > b.id) ? 1 : -1);

				players = args[3];
				for (let j = 0; j < dbPlayers.length; j++) {
					players = players.replace(dbPlayers[j].dataValues.id, dbPlayers[j].dataValues.osuName);
				}

				await DBElitebotixProcessQueue.create({
					guildId: 'None',
					task: 'messageUserWithMatchlog',
					additions: `${args[0]};The scheduled Qualifier match has finished. <https://osu.ppy.sh/mp/${lobby.id}>\nMatch: \`${args[5]}\`\nScheduled players: ${players}\nMappool: ${args[6]};${process.env.ELITEBOTIXBANCHOROOTPATH}/matchLogs/${channel.lobby.id}.txt;${channel.lobby.id}.txt`,
					priority: 1,
					date: new Date()
				});

				await lobby.closeLobby();
				await channel.leave();

				//Remove the channel property from the bancho object to avoid trying to rejoin
				delete bancho.channels[`#mp_${lobby.id}`];

				bancho.tourneyMatchReferees = bancho.tourneyMatchReferees.filter((id) => id !== parseInt(lobby.id));

				// Restart if there are no more auto hosts and the bot is marked for update
				restartIfPossible(bancho);

				return;
			}
		});
	},
};