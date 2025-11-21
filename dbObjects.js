const Sequelize = require('sequelize');
require('dotenv').config();
const { elitebotixProcessQueueAccesses, elitebotixBanchoProcessQueueAccesses, discordUsersAccesses, multiMatchesAccesses, multiGameScoresAccesses, beatmapsAccesses } = require('./metrics');

const elitebotixProcessQueue = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: async () => {
		elitebotixProcessQueueAccesses.inc();
	},
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

const processQueue = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: async () => {
		elitebotixBanchoProcessQueueAccesses.inc();
	},
	storage: `${process.env.ELITEBOTIXBANCHOROOTPATH}/databases/processQueue.sqlite`,
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
	logging: async () => {
		discordUsersAccesses.inc();
	},
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

const elitebotixMultiGameScores = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: async () => {
		multiGameScoresAccesses.inc();
	},
	storage: `${process.env.ELITEBOTIXROOTPATH}/databases/multiGameScores.sqlite`,
	retry: {
		max: 25, // Maximum retry 15 times
		backoffBase: 100, // Initial backoff duration in ms. Default: 100,
		backoffExponent: 1.14, // Exponent to increase backoff each try. Default: 1.1
	},
	pool: {
		max: 7,
	}
});

const elitebotixMultiMatches = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: async () => {
		multiMatchesAccesses.inc();
	},
	storage: `${process.env.ELITEBOTIXROOTPATH}/databases/multiMatches.sqlite`,
	retry: {
		max: 25, // Maximum retry 15 times
		backoffBase: 100, // Initial backoff duration in ms. Default: 100,
		backoffExponent: 1.14, // Exponent to increase backoff each try. Default: 1.1
	},
	pool: {
		max: 7,
	}
});

const elitebotixBeatmaps = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: async () => {
		beatmapsAccesses.inc();
	},
	storage: `${process.env.ELITEBOTIXROOTPATH}/databases/beatmaps.sqlite`,
	retry: {
		max: 25, // Maximum retry 15 times
		backoffBase: 100, // Initial backoff duration in ms. Default: 100,
		backoffExponent: 1.14, // Exponent to increase backoff each try. Default: 1.1
	},
	pool: {
		max: 7,
	}
});

const DBProcessQueue = require(`${process.env.ELITEBOTIXBANCHOROOTPATH}/models/DBProcessQueue`)(processQueue, Sequelize.DataTypes);

const DBElitebotixProcessQueue = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBProcessQueue`)(elitebotixProcessQueue, Sequelize.DataTypes);
const DBElitebotixDiscordUsers = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBDiscordUsers`)(elitebotixDiscordUsers, Sequelize.DataTypes);
const DBElitebotixOsuMultiMatches = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBOsuMultiMatches`)(elitebotixMultiMatches, Sequelize.DataTypes);
const DBElitebotixOsuMultiGameScores = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBOsuMultiGameScores`)(elitebotixMultiGameScores, Sequelize.DataTypes);
const DBElitebotixOsuBeatmaps = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBOsuBeatmaps`)(elitebotixBeatmaps, Sequelize.DataTypes);

module.exports = {
	DBProcessQueue,
	DBElitebotixProcessQueue,
	DBElitebotixDiscordUsers,
	DBElitebotixOsuMultiMatches,
	DBElitebotixOsuMultiGameScores,
	DBElitebotixOsuBeatmaps,
};
