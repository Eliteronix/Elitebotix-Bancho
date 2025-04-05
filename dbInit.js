// eslint-disable-next-line no-console
console.log('Syncing databases...');
const Sequelize = require('sequelize');

const fs = require('fs');

//Check if the maps folder exists and create it if necessary
if (!fs.existsSync('./databases')) {
	fs.mkdirSync('./databases');
}

const processQueue = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'databases/processQueue.sqlite',
	retry: {
		max: 15, // Maximum retry 15 times
		backoffBase: 100, // Initial backoff duration in ms. Default: 100,
		backoffExponent: 1.14, // Exponent to increase backoff each try. Default: 1.1
	},
});

require('./models/DBProcessQueue')(processQueue, Sequelize.DataTypes);

processQueue.sync({ alter: true })
	.then(async () => {
		// eslint-disable-next-line no-console
		console.log('processQueue database synced');
		processQueue.close();
	})
	.catch(console.error);