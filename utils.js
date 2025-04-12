const { DBElitebotixProcessQueue, DBElitebotixDiscordUsers, DBElitebotixOsuMultiGameScores, DBElitebotixOsuMultiMatches, DBProcessQueue } = require('./dbObjects');
const { Op } = require('sequelize');
const tmi = require('tmi.js');
const { getOsuBeatmap } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

module.exports = {
	async addMatchMessage(matchId, array, user, message) {
		let now = new Date();
		array.push(`${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}:${now.getUTCSeconds().toString().padStart(2, '0')} [${user}]: ${message}`);

		//write the array to a .txt with the name of the matchId in the folder matchLogs
		let matchLog = array.join('\n');
		const fs = require('fs');

		//Check if the matchLogs folder exists and create it if necessary
		if (!fs.existsSync('./matchLogs')) {
			fs.mkdirSync('./matchLogs');
		}

		fs.writeFile(`./matchLogs/${matchId}.txt`, matchLog, function (err) {
			if (err) {
				return console.error(err);
			}
		});
	},
	async logMatchCreation(name, matchId) {
		await DBElitebotixProcessQueue.create({
			guildId: 'none',
			task: 'logMatchCreation',
			additions: `${matchId};${name}`,
			date: new Date(),
			priority: 0
		});
	},
	async updateQueueChannels() {
		await DBElitebotixProcessQueue.create({
			guildId: 'none',
			task: 'updateQueueChannels',
			date: new Date(),
			priority: 0
		});
	},
	async trySendMessage(destination, message) {
		try {
			await destination.sendMessage(message);
		} catch (e) {
			if (e.message === 'Currently disconnected!') {
				console.log('Currently disconnected! Trying to reconnect...', message);
				await module.exports.reconnectToBanchoAndChannels(destination.banchojs);

				await new Promise((resolve) => setTimeout(resolve, 5000));

				console.log('Trying to send message again...', message);
				await module.exports.trySendMessage(destination, message);
			} else {
				console.error('Error sending message to destination: ', e);
			}
		}
	},
	async reconnectToBanchoAndChannels(bancho) {
		try {
			await bancho.connect();

			for (const channel in bancho.channels) {
				await bancho.channels[channel].join();
				await module.exports.trySendMessage(bancho.channels[channel], 'Reconnected after unexpected disconnect. Sorry for the inconvenience!');
				console.log('Joined channel', channel);
			}
		} catch (e) {
			if (e.message !== 'Already connected/connecting') {
				console.error('Error reconnecting: ', e);
			}
		}
	},
	async twitchConnect(bancho) {
		bancho.sentRequests = [];

		let twitchSyncUsers = await DBElitebotixDiscordUsers.findAll({
			attributes: ['twitchName'],
			where: {
				twitchName: {
					[Op.not]: null,
				}
			},
		});

		let twitchChannels = ['lunepie'];

		for (let i = 0; i < twitchSyncUsers.length; i++) {
			twitchChannels.push(twitchSyncUsers[i].twitchName);
		}

		// Define configuration options
		const opts = {
			identity: {
				username: process.env.TWITCH_USERNAME,
				password: process.env.TWITCH_OAUTH_TOKEN
			},
			channels: twitchChannels,
			logger: {
				info: function () {
					return;
				},
				warn: function () {
					return;
				},
				error: function (message) {
					if (message !== 'No response from Twitch.'
						&& message !== 'msg_channel_suspended'
						&& message !== 'Ping timeout.'
						&& message !== 'Could not connect to server. Reconnecting in 1 seconds..') {
						console.error('twitchClient error', message);
					}
				}
			}
		};

		// Create a client with our options
		let twitchClient = new tmi.client(opts);

		// Register our event handlers (defined below)
		twitchClient.on('message', onMessageHandler);
		twitchClient.on('connected', onConnectedHandler);

		// Connect to Twitch:
		await twitchClient.connect();

		// Called every time a message comes in
		async function onMessageHandler(target, context, msg, self) {
			if (self) { return; } // Ignore messages from the bot

			if (msg.toLowerCase().startsWith('!verify') && context.username === target.substring(1)) {
				let content = msg.substring(7).trim();

				if (!content) {
					return;
				}

				if (!content.includes('#')) {
					return;
				}

				let discordName = content.split('#')[0];
				let discordDiscriminator = content.split('#')[1];

				let discordUser = client.users.cache.find(user => user.username === discordName && user.discriminator === discordDiscriminator);

				if (!discordUser) {
					return;
				}

				let dbDiscordUser = await DBElitebotixDiscordUsers.findOne({
					attributes: ['id', 'twitchVerified', 'twitchName'],
					where: {
						userId: discordUser.id,
						twitchName: target.substring(1).toLowerCase(),
					}
				});

				if (!dbDiscordUser) {
					return;
				}

				dbDiscordUser.twitchVerified = true;
				await dbDiscordUser.save();

				twitchClient.say(target.substring(1), 'Your connection has been verified.');

				try {
					await discordUser.send(`Your connection to the twitch account ${dbDiscordUser.twitchName} has been verified!`);
				} catch (e) {
					console.error(e);
				}
				return;
			}

			if (msg.toLowerCase() === '!mp') {
				let discordUser = await DBElitebotixDiscordUsers.findOne({
					attributes: ['osuUserId', 'osuName'],
					where: {
						twitchName: target.substring(1),
						twitchVerified: true,
						twitchOsuMatchCommand: true,
						osuUserId: {
							[Op.ne]: null
						}
					}
				});

				if (!discordUser) {
					return;
				}

				let lastMultiScore = await DBElitebotixOsuMultiGameScores.findOne({
					attributes: ['matchId'],
					where: {
						osuUserId: discordUser.osuUserId
					},
					order: [
						['gameId', 'DESC']
					]
				});

				if (!lastMultiScore) {
					return;
				}

				let lastMultiMatch = await DBElitebotixOsuMultiMatches.findOne({
					attributes: ['matchName', 'matchEndDate'],
					where: {
						matchId: lastMultiScore.matchId
					},
				});

				if (lastMultiMatch.matchEndDate) {
					return twitchClient.say(target.substring(1), `Last match with ${discordUser.osuName}: ${lastMultiMatch.matchName} | https://osu.ppy.sh/mp/${lastMultiScore.matchId}`);
				}

				return twitchClient.say(target.substring(1), `Current match with ${discordUser.osuName}: ${lastMultiMatch.matchName} | https://osu.ppy.sh/mp/${lastMultiScore.matchId}`);
			}

			if (msg.toLowerCase() === '!whatishappiness') {
				return twitchClient.say(target.substring(1), 'Happiness is when Elitebotix rating up widepeepoHappy');
			}

			if (msg.startsWith('!')) { return; } // Ignore other messages starting with !

			if (msg.toLowerCase().includes('https://osu.ppy.sh/community/matches/') || msg.toLowerCase().includes('https://osu.ppy.sh/mp/')) {
				// Get the match ID
				let matchIDRegex = /https:\/\/osu\.ppy\.sh\/community\/matches\/(\d+)/gm;
				let matchID = matchIDRegex.exec(msg);

				if (!matchID) {
					matchIDRegex = /https:\/\/osu\.ppy\.sh\/mp\/(\d+)/gm;
					matchID = matchIDRegex.exec(msg);
				}

				if (!matchID) {
					return;
				}

				matchID = matchID[0].replace(/.*\//gm, '');

				if (isNaN(matchID)) {
					return;
				}

				await DBElitebotixProcessQueue.create({
					guildId: 'None',
					task: 'importMatch',
					additions: `${matchID}`,
					priority: 1,
					date: new Date()
				});

				return;
			}

			const longRegex = /https?:\/\/osu\.ppy\.sh\/beatmapsets\/.+\/\d+/gm;
			const shortRegex = /https?:\/\/osu\.ppy\.sh\/b\/\d+/gm;
			const longMatches = longRegex.exec(msg);
			const shortMatches = shortRegex.exec(msg);

			let map = null;
			if (longMatches) {
				map = longMatches[0];
			} else if (shortMatches) {
				map = shortMatches[0];
			}

			if (!map && msg.includes('https://osu.ppy.sh/beatmapsets/')) {
				let discordUser = await DBElitebotixDiscordUsers.findOne({
					attributes: ['twitchName'],
					where: {
						twitchName: target.substring(1),
						twitchVerified: true,
						twitchOsuMapSync: true,
						osuUserId: {
							[Op.ne]: null
						}
					}
				});

				if (discordUser && context['display-name'].toLowerCase() !== discordUser.twitchName.toLowerCase()) {
					await twitchClient.say(target.substring(1), `${context['display-name']} -> Please select a difficulty of the mapset.`);
				}
				return;
			}

			if (map) {
				map = map.replace(/.+\//gm, '');

				//Get the message without the map link
				let message = msg.replace(longRegex, '').replace(shortRegex, '').trim();

				let discordUser = await DBElitebotixDiscordUsers.findOne({
					attributes: ['twitchName', 'osuName', 'osuUserId'],
					where: {
						twitchName: target.substring(1),
						twitchVerified: true,
						twitchOsuMapSync: true,
						osuUserId: {
							[Op.ne]: null
						}
					}
				});

				if (discordUser && context['display-name'].toLowerCase() !== discordUser.twitchName.toLowerCase()) {
					const IRCUser = await bancho.getUser(discordUser.osuName);

					let prefix = [];
					if (context.mod) {
						prefix.push('MOD');
					}
					if (context.badges && context.badges.vip) {
						prefix.push('VIP');
					}
					if (context.subscriber) {
						prefix.push('SUB');
					}

					if (prefix.length > 0) {
						prefix = `[${prefix.join('/')}] `;
					} else {
						prefix = '';
					}

					let dbBeatmap = await getOsuBeatmap({ beatmapId: map, modBits: 0 });

					if (dbBeatmap) {
						bancho.lastUserMaps[discordUser.osuUserId] = { beatmapId: map, modBits: 0 };

						let mainMessage = `${prefix}${context['display-name']} -> [${dbBeatmap.approvalStatus}] [https://osu.ppy.sh/b/${dbBeatmap.beatmapId} ${dbBeatmap.artist} - ${dbBeatmap.title} [${dbBeatmap.difficulty}]] (mapped by ${dbBeatmap.mapper}) | ${Math.round(dbBeatmap.starRating * 100) / 100}* | ${dbBeatmap.bpm} BPM`;
						await module.exports.trySendMessage(IRCUser, mainMessage);
						if (message) {
							let comment = `${prefix}${context['display-name']} -> Comment: ${message}`;
							await module.exports.trySendMessage(IRCUser, comment);
							bancho.sentRequests.push({ osuUserId: discordUser.osuUserId, main: mainMessage, comment: comment });
						} else {
							bancho.sentRequests.push({ osuUserId: discordUser.osuUserId, main: mainMessage });
						}

						twitchClient.say(target.substring(1), `${context['display-name']} -> [${dbBeatmap.approvalStatus}] ${dbBeatmap.artist} - ${dbBeatmap.title} [${dbBeatmap.difficulty}] (mapped by ${dbBeatmap.mapper}) | ${Math.round(dbBeatmap.starRating * 100) / 100}* | ${dbBeatmap.bpm} BPM`);
					} else {
						twitchClient.say(target.substring(1), `${context['display-name']} -> Map not found.`);
					}
				}

				return;
			}

			const fishhChannels = ['54068428', '640238356', '860369226', '217355740', '82273365', '236370675', '269391990'];
			// Eliteronix, Lunepie, Lunepieoffline, eneques, kaitiri, MaryLiOsu, Laan_c

			if (msg.includes('fishh') && fishhChannels.includes(context['room-id'])) {
				const catches = [
					{ name: 'Joel', weight: 250 },
					{ name: 'Christopher', weight: 250 },
					{ name: 'jol', weight: 250 },
					{ name: 'Noah', weight: 250 },
					{ name: 'Muhammed', weight: 250 },
					{ name: 'Damien', weight: 250 },
					{ name: 'Max', weight: 250 },
					{ name: 'COD', weight: 250 },
					{ name: 'Harold', weight: 250 },
					{ name: 'FishMoley', weight: 250 },
					{ name: 'fishJAM', weight: 100 },
					{ name: 'jellyfishJam', weight: 100 },
					{ name: 'JoelPride', weight: 100 },
					{ name: 'JUSSY', weight: 50 },
					{ name: 'Sharkge', weight: 50 },
					{ name: 'JoelJAM', weight: 25 },
					{ name: 'Joeler', weight: 10 },
					{ name: 'fishShy', weight: 10 },
					{ name: 'PogFish', weight: 10 },
					{ name: 'JoelbutmywindowsXPiscrashing', weight: 10 },
					{ name: 'JoelerRAVE', weight: 10 },
					{ name: 'JoelTeachingHisSonJolHowToSpinWhileWideBorisPassesBy', weight: 10 },
					{ name: 'Robert', weight: 1 }
				];

				let totalWeight = 0;
				for (let i = 0; i < catches.length; i++) {
					totalWeight += catches[i].weight;
				}

				let random = Math.floor(Math.random() * totalWeight);

				let currentWeight = 0;

				for (let i = 0; i < catches.length; i++) {
					currentWeight += catches[i].weight;
					if (random < currentWeight) {
						if (catches[i].name === 'Robert') {
							twitchClient.say(target.substring(1), `${context['display-name']} saved Robert from the water! (Legendary)`);
							return;
						}

						let rarity = 'Common';

						if (catches[i].weight < 25) {
							rarity = 'Epic';
						} else if (catches[i].weight < 100) {
							rarity = 'Rare';
						} else if (catches[i].weight < 250) {
							rarity = 'Uncommon';
						}

						twitchClient.say(target.substring(1), `${context['display-name']} caught ${catches[i].name} ! (${rarity})`);
						return;
					}
				}
			}
		}

		// Called every time the bot connects to Twitch chat
		function onConnectedHandler(addr, port) {
			// eslint-disable-next-line no-console
			console.log(`* Connected to ${addr}:${port}`);
			console.log('Connected to the following channels: ', twitchChannels);
		}

		return twitchClient;
	},
	async updateTwitchNames(bancho) {
		let twitchUsers = await DBElitebotixDiscordUsers.findAll({
			attributes: ['id', 'twitchName', 'twitchId'],
			where: {
				twitchId: {
					[Op.not]: null,
				},
			},
		});

		let response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {
			method: 'POST',
		});

		let json = await response.json();

		let accessToken = json.access_token;

		for (let i = 0; i < twitchUsers.length; i++) {
			await new Promise(resolve => setTimeout(resolve, 5000));
			response = await fetch(`https://api.twitch.tv/helix/users?id=${twitchUsers[i].twitchId}`, {
				headers: {
					'Client-ID': process.env.TWITCH_CLIENT_ID,
					'Authorization': `Bearer ${accessToken}`
				}
			});

			if (response.status === 200) {
				let json = await response.json();
				if (json.data.length > 0) {
					if (twitchUsers[i].twitchName !== json.data[0].login) {
						bancho.twitchClient.join(json.data[0].login);
					}

					twitchUsers[i].twitchName = json.data[0].login;
					twitchUsers[i].twitchId = json.data[0].id;
					await twitchUsers[i].save();
				}
			}
		}
	},
	executeNextProcessQueueTask: async function (bancho) {
		let now = new Date();

		let nextTasks = await DBProcessQueue.findAll({
			where: {
				beingExecuted: false,
				date: {
					[Op.lt]: now
				}
			},
			order: [
				['date', 'ASC'],
			]
		});

		if (nextTasks.length) {
			nextTasks[0].beingExecuted = true;
			await nextTasks[0].save();

			executeFoundTask(bancho, nextTasks[0]);
		}
	},
	restartIfPossible(bancho) {
		if (!bancho.update) {
			return;
		}

		if (bancho.duels.length === 0 && bancho.autoHosts.length === 0 && bancho.tourneyMatchReferees.length === 0) {
			process.exit(0);
		}
	}
};

async function executeFoundTask(bancho, nextTask) {
	try {
		const task = require(`./processQueueTasks/${nextTask.task}.js`);

		await task.execute(bancho, nextTask);
	} catch (e) {
		console.error('Error executing process queue task', e);
		console.error('Process Queue entry:', nextTask);
		nextTask.destroy();
	}
}