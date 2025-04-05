const { DBElitebotixProcessQueue } = require('./dbObjects');

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
	}
};