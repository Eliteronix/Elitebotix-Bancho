const pg = require('pg');
pg.types.setTypeParser(20, val => parseInt(val, 10));

const Sequelize = require('sequelize');
require('dotenv').config();
const { elitebotixBanchoProcessQueueAccesses } = require('./metrics');

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

const elitebotixPostgres = new Sequelize('elitebotix', 'elitebotix', process.env.POSTGRESQLPASSWORD, {
	dialect: 'postgres',
	host: 'localhost',
	port: 5432,
	logging: async () => {
		if (process.shardId !== undefined) {
			process.send('DB postgres');
		}
	},
	pool: {
		max: 10,
		min: 2,
		acquire: 30000,
		idle: 10000,
	},
});

elitebotixPostgres.authenticate()
	// eslint-disable-next-line no-console
	.then(() => console.log('✅ Connected to database'))
	.catch(err => console.error('❌ Failed to connect to database:', err));

const DBProcessQueue = require(`${process.env.ELITEBOTIXBANCHOROOTPATH}/models/DBProcessQueue`)(processQueue, Sequelize.DataTypes);

const DBElitebotixProcessQueue = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBProcessQueue`)(elitebotixPostgres, Sequelize.DataTypes);
const DBElitebotixDiscordUsers = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBDiscordUsers`)(elitebotixPostgres, Sequelize.DataTypes);
const DBElitebotixOsuMultiMatches = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBOsuMultiMatches`)(elitebotixPostgres, Sequelize.DataTypes);
const DBElitebotixOsuMultiGameScores = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBOsuMultiGameScores`)(elitebotixPostgres, Sequelize.DataTypes);
const DBElitebotixOsuBeatmaps = require(`${process.env.ELITEBOTIXROOTPATH}/models/DBOsuBeatmaps`)(elitebotixPostgres, Sequelize.DataTypes);

module.exports = {
	DBProcessQueue,
	DBElitebotixProcessQueue,
	DBElitebotixDiscordUsers,
	DBElitebotixOsuMultiMatches,
	DBElitebotixOsuMultiGameScores,
	DBElitebotixOsuBeatmaps,
};
