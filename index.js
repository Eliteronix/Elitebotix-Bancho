//Log message upon starting the bot
console.log('Bot is starting...');

//require the dotenv node module
require('dotenv').config();

//Get gotBanchoPrivateMessage
const gotBanchoPrivateMessage = require('./gotBanchoPrivateMessage');

const Banchojs = require('bancho.js');
// eslint-disable-next-line no-undef
const bancho = new Banchojs.BanchoClient({ username: process.env.OSUNAME, password: process.env.OSUIRC, apiKey: process.env.OSUTOKENV1 });

if (process.env.SERVER === 'Live') {
	bancho.connect();
}

bancho.lastUserMaps = new Discord.Collection();

//Listen to messages
bancho.on('PM', async (message) => {
	gotBanchoPrivateMessage(bancho, message);
});