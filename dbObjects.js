const Sequelize = require('sequelize');

const elitebotixProcessQueue = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: `${process.env.ELITEBOTIXROOTPATH}/databases/processQueue.sqlite`,
	retry: {
		max: 25, // Maximum retry 15 times
		backoffBase: 100, // Initial backoff duration in ms. Default: 100,
		backoffExponent: 1.14, // Exponent to increase backoff each try. Default: 1.1
	},
	pool: {
		max: 7,
	}
});

const elitebotixDiscordUsers = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: `${process.env.ELITEBOTIXROOTPATH}/databases/discordUsers.sqlite`,
	retry: {
		max: 25, // Maximum retry 15 times
		backoffBase: 100, // Initial backoff duration in ms. Default: 100,
		backoffExponent: 1.14, // Exponent to increase backoff each try. Default: 1.1
	},
	pool: {
		max: 7,
	}
});

const DBElitebotixProcessQueue = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBProcessQueue`)(elitebotixProcessQueue, Sequelize.DataTypes);
const DBElitebotixDiscordUsers = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBDiscordUsers`)(elitebotixDiscordUsers, Sequelize.DataTypes);

module.exports = {
	DBElitebotixProcessQueue,
	DBElitebotixDiscordUsers,
};
