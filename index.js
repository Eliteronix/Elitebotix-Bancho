//Log message upon starting the bot
// eslint-disable-next-line no-console
console.log('Bot is starting...');

//require the dotenv node module
require('dotenv').config();

const originalConsoleError = console.error;
const { totalErrorCount } = require('./metrics.js');

console.error = function (...args) {
	totalErrorCount.inc();
	originalConsoleError.apply(console, args);
};

//Get gotBanchoPrivateMessage
const gotBanchoPrivateMessage = require('./gotBanchoPrivateMessage');

const Banchojs = require('bancho.js');
const { reconnectToBanchoAndChannels, twitchConnect, updateTwitchNames, executeNextProcessQueueTask } = require('./utils');

const http = require('http');
const url = require('url');
const { register } = require('./metrics.js');

// Define the HTTP server
const server = http.createServer(async (req, res) => {
	// Retrieve route from request object
	const route = url.parse(req.url).pathname;

	if (route === '/metrics') {
		// Return all metrics the Prometheus exposition format
		res.setHeader('Content-Type', register.contentType);
		res.end(await register.metrics());
	}
});

// Start the HTTP server which exposes the metrics on http://localhost:8082/metrics
server.listen(8082);

const bancho = new Banchojs.BanchoClient({ username: process.env.OSUNAME, password: process.env.OSUIRC, apiKey: process.env.OSUTOKENV1, botAccount: returnBoolean(process.env.BOTACCOUNT) });

bancho.connect().then(() => {
	// eslint-disable-next-line no-console
	console.log('Connected to Bancho');

	setTimeout(() => {
		executeProcessQueue(bancho);
	}, 60000);
});

twitchConnect(bancho).then(twitch => {
	bancho.twitchClient = twitch;
});

bancho.lastUserMaps = {};
bancho.duels = [];
bancho.autoHosts = [];
bancho.tourneyMatchReferees = [];
bancho.knockoutLobbies = [];

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

process.on('unhandledRejection', (reason) => {
	console.error('Unhandled rejection, index.js:', reason);
});

setTimeout(() => {
	// eslint-disable-next-line no-console
	console.log('Starting regular tasks...');

	updateTwitchNames(bancho);
}, 60000);

// Set update to 1 after 23 hours to make it restart
setTimeout(() => {
	bancho.update = 1;
}, 82800000);

function returnBoolean(value) {
	if (value === 'false') return false;
	if (value === 'true') return true;
	return value;
}

async function executeProcessQueue(bancho) {
	try {
		await executeNextProcessQueueTask(bancho);
	} catch (e) {
		console.error('index.js | executeNextProcessQueueTask' + e);
	}

	setTimeout(() => {
		executeProcessQueue(bancho);
	}, 1000);
}