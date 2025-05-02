const osu = require('node-osu');
const { pause, logMatchCreation, addMatchMessage, reconnectToBanchoAndChannels, trySendMessage } = require('../utils.js');
const { saveOsuMultiScores } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const { DBElitebotixProcessQueue } = require('../dbObjects.js');

module.exports = {
	knockoutLobby: async function (bancho, interaction, mappool, players, users, scoreversion) {

		let playerIds = [];
		for (let i = 0; i < players.length; i++) {
			playerIds.push(players[i].osuUserId);
		}

		let mapIndex = 1;
		//Increases knockoutmap number to start/continue with harder maps
		while (12 - players.length > mapIndex) {
			mapIndex++;
		}

		let doubleTime = '';
		if (mapIndex === 4 || mapIndex === 8) {
			doubleTime = ' DT';
		}

		//Calculate start and end date for custom MOTDs
		let plannedStartDate = new Date();
		let startIndex = 1;
		//set startIndex to something else if below 11 players (below all maps played)
		if (players.length < 11) {
			startIndex = 12 - players.length;
		}

		let gameLength = 180;

		//Calculate match time
		for (let i = startIndex; i < mappool.length; i++) {
			gameLength = gameLength + 120 + parseInt(mappool[i].length.total);
		}

		let plannedEndDate = new Date();
		plannedEndDate.setUTCFullYear(plannedStartDate.getUTCFullYear());
		plannedEndDate.setUTCMonth(plannedStartDate.getUTCMonth());
		plannedEndDate.setUTCDate(plannedStartDate.getUTCDate());
		plannedEndDate.setUTCHours(plannedStartDate.getUTCHours());
		plannedEndDate.setUTCMinutes(plannedStartDate.getUTCMinutes());
		plannedEndDate.setUTCSeconds(0);
		plannedEndDate.setUTCSeconds(gameLength);

		let lobbyStatus = 'Joining phase';

		let channel;

		for (let i = 0; i < 5; i++) {
			try {
				await reconnectToBanchoAndChannels(bancho);

				channel = await bancho.createLobby(`MOTD: (Custom) vs (Knockout Lobby)`);
				bancho.knockoutLobbies.push(parseInt(channel.lobby.id));
				break;
			} catch (error) {
				if (i === 2) {
					return await DBElitebotixProcessQueue.create({ guildId: 'None', task: 'interactionResponse', additions: `${interaction};I am having issues creating the lobby and the match has been aborted.\nPlease try again later.`, priority: 1, date: new Date() });
				} else {
					await pause(10000);
				}
			}
		}

		channel.on('message', async (msg) => {
			addMatchMessage(lobby.id, matchMessages, msg.user.ircUsername, msg.message);
		});

		const lobby = channel.lobby;
		logMatchCreation(lobby.name, lobby.id);

		const password = Math.random().toString(36).substring(8);

		let matchMessages = [];
		await lobby.setPassword(password);
		await trySendMessage(channel, '!mp addref Eliteronix');
		await trySendMessage(channel, '!mp lock');
		await trySendMessage(channel, `!mp set 0 ${scoreversion} ${players.length}`);
		await pause(60000);

		while (lobby._beatmapId != mappool[mapIndex].id) {
			await trySendMessage(channel, '!mp abort');
			await trySendMessage(channel, `!mp map ${mappool[mapIndex].id} 0`);
			await pause(5000);
		}

		//Check mods and set them if needed
		if (mapIndex === 4 || mapIndex === 8) {
			while (!lobby.mods || lobby.mods && lobby.mods.length === 0 || lobby.mods && lobby.mods[0].shortMod !== 'dt') {
				await trySendMessage(channel, `!mp mods FreeMod${doubleTime}`);
				await pause(5000);
			}
		} else {
			while (lobby.mods || lobby.mods && lobby.mods.length !== 0) {
				await trySendMessage(channel, `!mp mods FreeMod${doubleTime}`);
				await pause(5000);
			}
		}

		for (let i = 0; i < users.length; i++) {
			await trySendMessage(channel, `!mp invite #${players[i].osuUserId}`);
			await DBElitebotixProcessQueue.create({
				guildId: 'None',
				task: 'messageUser',
				additions: `${users[i].userId};${interaction};Your Knockoutlobby has been created. <https://osu.ppy.sh/mp/${lobby.id}>\nPlease join it using the sent invite ingame.\nIf you did not receive an invite search for the lobby \`${lobby.name}\` and enter the password \`${password}\`;[Knockout Lobby] <@${users[i].userId}>, it seems like I can't DM you in Discord. Please enable DMs so that I can keep you up to date with the match procedure!`,
				priority: 1,
				date: new Date()
			});
		}

		await trySendMessage(channel, '!mp timer 180');
		let timer = new Date();
		timer.setMinutes(timer.getMinutes() + 4);

		let waitedForMapdownload = false;

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
						//Calculate the amount of knockouts needed
						let knockoutNumber = calculateKnockoutNumber(players, mapIndex);
						await trySendMessage(channel, `${knockoutNumber} player(s) will be knocked out.`);
						await trySendMessage(channel, '!mp timer 60');
					}
				} else if (lobbyStatus === 'Waiting for start') {
					await lobby.updateSettings();

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
						await trySendMessage(channel, '!mp start 10');
						lobbyStatus === 'Map being played';
					} else {
						waitedForMapdownload = true;
						await trySendMessage(channel, 'A player is missing the map. Waiting only 1 minute longer.');
						await trySendMessage(channel, '!mp timer 60');
					}

				}
			} else if (timer < now && lobbyStatus === 'Joining phase') {
				lobbyStatus = 'Waiting for start';

				await trySendMessage(channel, 'Everyone please ready up!');
				//Calculate the amount of knockouts needed
				let knockoutNumber = calculateKnockoutNumber(players, mapIndex);
				await trySendMessage(channel, `${knockoutNumber} player(s) will be knocked out.`);
				await trySendMessage(channel, '!mp timer 60');
			}
		});

		lobby.on('playerJoined', async (obj) => {
			if (!playerIds.includes(obj.player.user.id.toString())) {
				trySendMessage(channel, `!mp kick #${obj.player.user.id}`);
			} else if (lobbyStatus === 'Joining phase') {
				let allPlayersJoined = true;
				for (let i = 0; i < players.length && allPlayersJoined; i++) {
					if (!lobby.playersById[players[i].osuUserId.toString()]) {
						allPlayersJoined = false;
					}
				}
				if (allPlayersJoined) {
					lobbyStatus = 'Waiting for start';

					await trySendMessage(channel, 'Everyone please ready up!');
					//Calculate the amount of knockouts needed
					let knockoutNumber = calculateKnockoutNumber(players, mapIndex);
					await trySendMessage(channel, `${knockoutNumber} player(s) will be knocked out.`);
					await trySendMessage(channel, '!mp timer 60');
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
			if (lobbyStatus === 'Waiting for start' && playersInLobby === players.length) {
				await trySendMessage(channel, '!mp start 10');

				lobbyStatus === 'Map being played';
			}
		});
		lobby.on('matchFinished', async (results) => {
			for (let i = 0; i < results.length; i++) {
				process.send(`osuuser ${results[i].player.user.id}}`);
			}

			//Calculate the amount of knockouts needed
			let knockoutNumber = calculateKnockoutNumber(players, mapIndex);

			let knockedOutPlayers = 0;
			let knockedOutPlayerNames = '';
			let knockedOutPlayerIds = [];
			//Remove players that didn't play
			for (let i = 0; i < players.length; i++) {
				let submittedScore = false;
				for (let j = 0; j < results.length; j++) {
					if (results[j].player.user.id.toString() === players[i].osuUserId) {
						submittedScore = true;
					}
				}

				if (!submittedScore) {
					knockedOutPlayers++;
					knockedOutPlayerIds.push(players[i].osuUserId);
					if (knockedOutPlayerNames === '') {
						knockedOutPlayerNames = `${players[i].osuName}`;
					} else {
						knockedOutPlayerNames = `${knockedOutPlayerNames}, ${players[i].osuName}`;
					}

					players.splice(i, 1);
					users.splice(i, 1);
					i--;
				}
			}

			results.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

			const playersUsers = sortPlayersByResultsBanchojs(results, players, users);

			players = playersUsers[0];
			users = playersUsers[1];

			playerIds = [];
			for (let i = 0; i < players.length; i++) {
				playerIds.push(players[i].osuUserId);
			}

			//Remove as many players as needed if there weren't enough players inactive
			if (knockedOutPlayers < knockoutNumber) {
				for (let i = 0; i < players.length && knockedOutPlayers < knockoutNumber; i++) {
					if (knockedOutPlayerNames === '') {
						knockedOutPlayerNames = `\`${players[i].osuName}\``;
					} else {
						knockedOutPlayerNames = `${knockedOutPlayerNames}, \`${players[i].osuName}\``;
					}
					knockedOutPlayers++;
					knockedOutPlayerIds.push(players[i].osuUserId);
					results.splice(i, 1);
					players.splice(i, 1);
					users.splice(i, 1);
					i--;
				}
			}

			await trySendMessage(channel, `Knocked out players this round: ${knockedOutPlayerNames}`);
			await pause(15000);

			for (let i = 0; i < knockedOutPlayerIds.length; i++) {
				await trySendMessage(channel, `!mp kick #${knockedOutPlayerIds[i]}`);
			}

			if (players.length === 1) {
				lobbyStatus = 'Lobby finished';

				await trySendMessage(channel, `Congratulations ${players[0].osuName}! You won the knockout lobby. Feel free to sign up for another round!`);

				await pause(15000);

				await lobby.closeLobby();
				await channel.leave();

				//Remove the channel property from the bancho object to avoid trying to rejoin
				delete bancho.channels[`#mp_${lobby.id}`];

				bancho.knockoutLobbies = bancho.knockoutLobbies.filter((id) => id !== parseInt(lobby.id));

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
			} else if (players.length === 0) {
				lobbyStatus = 'Lobby finished';
				await lobby.closeLobby();
				await channel.leave();

				//Remove the channel property from the bancho object to avoid trying to rejoin
				delete bancho.channels[`#mp_${lobby.id}`];

				bancho.knockoutLobbies = bancho.knockoutLobbies.filter((id) => id !== parseInt(lobby.id));

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
			} else {
				movePlayersIntoFirstSlots(channel, lobby, players, scoreversion);
				mapIndex++;

				let skipped = false;
				//Increases knockoutmap number to start/continue with harder maps and give more points
				while (12 - players.length > mapIndex) {
					mapIndex++;
					skipped = true;
				}

				if (skipped) {
					await trySendMessage(channel, 'One or more maps have been skipped due to a lower amount of players.');
				}

				doubleTime = '';
				if (mapIndex === 4 || mapIndex === 8) {
					doubleTime = ' DT';
				}

				while (lobby._beatmapId != mappool[mapIndex].id) {
					await trySendMessage(channel, '!mp abort');
					await trySendMessage(channel, `!mp map ${mappool[mapIndex].id} 0`);
					await pause(5000);
				}

				//Check mods and set them if needed
				if (mapIndex === 4 || mapIndex === 8) {
					while (!lobby.mods || lobby.mods && lobby.mods.length === 0 || lobby.mods && lobby.mods[0].shortMod !== 'dt') {
						await trySendMessage(channel, `!mp mods FreeMod${doubleTime}`);
						await pause(5000);
					}
				} else {
					while (lobby.mods || lobby.mods && lobby.mods.length !== 0) {
						await trySendMessage(channel, `!mp mods FreeMod${doubleTime}`);
						await pause(5000);
					}
				}

				lobbyStatus = 'Waiting for start';
				//Calculate the amount of knockouts needed
				let knockoutNumber = calculateKnockoutNumber(players, mapIndex);
				await trySendMessage(channel, `${knockoutNumber} player(s) will be knocked out.`);
				await trySendMessage(channel, '!mp timer 60');

				isFirstRound = false;
			}
		});
	}
};

function sortPlayersByResultsBanchojs(results, playersInput, usersInput) {
	let playersOutput = [];
	let usersOutput = [];

	for (let i = 0; i < results.length; i++) {
		for (let j = 0; j < playersInput.length; j++) {
			if (results[i].player.user.id.toString() === playersInput[j].osuUserId) {
				playersOutput.push(playersInput[j]);
				usersOutput.push(usersInput[j]);
				//Close inner loop
				j = playersInput.length;
			}
		}
	}

	let output = [];
	output.push(playersOutput);
	output.push(usersOutput);

	return output;
}

async function movePlayersIntoFirstSlots(channel, lobby, players, scoreversion) {
	await lobby.updateSettings();

	let spotToFillNext = 0;
	for (let i = 0; i < 16; i++) {
		if (lobby.slots[i] && i === spotToFillNext) {
			spotToFillNext++;
		} else if (lobby.slots[i] && i !== spotToFillNext) {
			await trySendMessage(channel, `!mp move #${lobby.slots[i].user.id} ${spotToFillNext + 1}`);
			spotToFillNext++;
		}
	}

	await pause(10000);

	await trySendMessage(channel, `!mp set 0 ${scoreversion} ${players.length}`);
}

function calculateKnockoutNumber(players, mapIndex) {
	//Set array for how many players should get through maximum
	let expectedPlayers = [];
	expectedPlayers.push(16); //Map [0] Qualifiers -> 16
	expectedPlayers.push(14); //Map [1] 16 -> 14
	expectedPlayers.push(12); //Map [2] 14 -> 12
	expectedPlayers.push(10); //Map [3] 12 -> 10
	expectedPlayers.push(8); //Map [4] 10 -> 8 --DT
	expectedPlayers.push(6); //Map [5] 8 -> 6
	expectedPlayers.push(5); //Map [6] 6 -> 5
	expectedPlayers.push(4); //Map [7] 5 -> 4
	expectedPlayers.push(3); //Map [8] 4 -> 3 --DT
	expectedPlayers.push(2); //Map [9] 3 -> 2
	expectedPlayers.push(1); //Map [10] 2 -> 1

	//Calculate the amount of knockouts needed
	let knockoutNumber = expectedPlayers[mapIndex - 1] - expectedPlayers[mapIndex];
	//Set the amount to 1 if less players are in the lobby
	if (players.length < expectedPlayers[mapIndex - 1]) {
		knockoutNumber = 1;
	}

	return knockoutNumber;
}