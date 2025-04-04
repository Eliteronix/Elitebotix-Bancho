//Log message upon starting the bot
console.log('Bot is starting...');

//require the dotenv node module
require('dotenv').config();

//Get gotBanchoPrivateMessage
const gotBanchoPrivateMessage = require('./gotBanchoPrivateMessage');

const Banchojs = require('bancho.js');
const { reconnectToBanchoAndChannels, twitchConnect, updateTwitchNames } = require('./utils');

// eslint-disable-next-line no-undef
const bancho = new Banchojs.BanchoClient({ username: process.env.OSUNAME, password: process.env.OSUIRC, apiKey: process.env.OSUTOKENV1, botAccount: returnBoolean(process.env.BOTACCOUNT) });

bancho.connect().then(() => console.log('Connected to Bancho'));

twitchConnect(bancho).then(twitch => {
	bancho.twitchClient = twitch;
});

bancho.lastUserMaps = {};
bancho.autoHosts = [];

//Listen to messages
bancho.on('PM', async (message) => {
	gotBanchoPrivateMessage(bancho, message);
});

bancho.on('error', async (error) => {
	if (error.message === 'Timeout reached') {
		console.error('Timeout reached, reconnecting...');
	} else {
		console.error('Bancho error index.js:', error);
	}

	await reconnectToBanchoAndChannels(bancho);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled rejection, index.js:', reason);
});

setTimeout(() => {
	// eslint-disable-next-line no-console
	console.log('Starting regular tasks...');

	updateTwitchNames(bancho);
}, 60000);

function returnBoolean(value) {
	if (value === 'false') return false;
	if (value === 'true') return true;
	return value;
}