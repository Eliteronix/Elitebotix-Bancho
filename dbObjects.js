const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
	retry: {
		max: 10, // Maximum rety 3 times
		backoffBase: 100, // Initial backoff duration in ms. Default: 100,
		backoffExponent: 1.14, // Exponent to increase backoff each try. Default: 1.1
	},
});

const DBGuilds = require('./models/DBGuilds')(sequelize, Sequelize.DataTypes);
const DBDiscordUsers = require('./models/DBDiscordUsers')(sequelize, Sequelize.DataTypes);
const DBMOTDPoints = require('./models/DBMOTDPoints')(sequelize, Sequelize.DataTypes);
const DBOsuMultiScores = require('./models/DBOsuMultiScores')(sequelize, Sequelize.DataTypes);
const DBOsuBeatmaps = require('./models/DBOsuBeatmaps')(sequelize, Sequelize.DataTypes);
const DBDuelRatingHistory = require('./models/DBDuelRatingHistory')(sequelize, Sequelize.DataTypes);

module.exports = { DBGuilds, DBDiscordUsers, DBMOTDPoints, DBOsuMultiScores, DBOsuBeatmaps, DBDuelRatingHistory };
