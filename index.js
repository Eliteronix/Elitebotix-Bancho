//Log message upon starting the bot
console.log('Bot is starting...');

//require the dotenv node module
require('dotenv').config();

//Get gotBanchoPrivateMessage
const gotBanchoPrivateMessage = require('./gotBanchoPrivateMessage');

const Banchojs = require('bancho.js');
// eslint-disable-next-line no-undef
const bancho = new Banchojs.BanchoClient({ username: process.env.OSUNAME, password: process.env.OSUIRC, apiKey: process.env.OSUTOKENV1, botAccount: returnBoolean(process.env.BOTACCOUNT) });

bancho.connect().then(() => console.log('Connected to Bancho'));

bancho.lastUserMaps = {};
bancho.sentRequests = [];
bancho.autoHosts = [];

//Listen to messages
bancho.on('PM', async (message) => {
	gotBanchoPrivateMessage(bancho, message);
});

function returnBoolean(value) {
	if (value === 'false') return false;
	if (value === 'true') return true;
	return value;
}