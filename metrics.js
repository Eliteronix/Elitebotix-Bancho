const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add default labels to all metrics
register.setDefaultLabels({
	app: 'elitebotix-bancho'
});

// Enable default Node.js metrics
client.collectDefaultMetrics({ register });

// Define metrics
const osuApiRequests = new client.Counter({
	name: 'osu_api_requests',
	help: 'osu! API requests',
});
register.registerMetric(osuApiRequests);

const uniqueOsuUsersInTheLastMinute = new client.Gauge({
	name: 'unique_osu_users_in_the_last_minute',
	help: 'Unique osu users in the last minute',
});
register.registerMetric(uniqueOsuUsersInTheLastMinute);

const uniqueOsuUsersInTheLastHour = new client.Gauge({
	name: 'unique_osu_users_in_the_last_hour',
	help: 'Unique osu users in the last hour',
});
register.registerMetric(uniqueOsuUsersInTheLastHour);

const uniqueOsuUsersInTheLastDay = new client.Gauge({
	name: 'unique_osu_users_in_the_last_day',
	help: 'Unique osu users in the last day',
});
register.registerMetric(uniqueOsuUsersInTheLastDay);

const uniqueOsuUsersInTheLastWeek = new client.Gauge({
	name: 'unique_osu_users_in_the_last_week',
	help: 'Unique osu users in the last week',
});
register.registerMetric(uniqueOsuUsersInTheLastWeek);

const uniqueOsuUsers = new client.Gauge({
	name: 'unique_osu_users',
	help: 'Unique osu users',
});
register.registerMetric(uniqueOsuUsers);

const elitebotixProcessQueueAccesses = new client.Gauge({
	name: 'database_elitebotix_processQueue',
	help: 'Database elitebotix-processQueue accessed',
});
register.registerMetric(elitebotixProcessQueueAccesses);

const elitebotixBanchoProcessQueueAccesses = new client.Gauge({
	name: 'database_elitebotix_bancho_processQueue',
	help: 'Database elitebotix-bancho-processQueue accessed',
});
register.registerMetric(elitebotixBanchoProcessQueueAccesses);

const discordUsersAccesses = new client.Gauge({
	name: 'database_discordUsers',
	help: 'Database discordUsers accessed',
});
register.registerMetric(discordUsersAccesses);

const multiMatchesAccesses = new client.Gauge({
	name: 'database_multiMatches',
	help: 'Database multiMatches accessed',
});
register.registerMetric(multiMatchesAccesses);

const multiGameScoresAccesses = new client.Gauge({
	name: 'database_multiGameScores',
	help: 'Database multiGameScores accessed',
});
register.registerMetric(multiGameScoresAccesses);

const beatmapsAccesses = new client.Gauge({
	name: 'database_beatmaps',
	help: 'Database beatmaps accessed',
});
register.registerMetric(beatmapsAccesses);

// Export everything you need
module.exports = {
	client,
	register,
	osuApiRequests,
	uniqueOsuUsersInTheLastMinute,
	uniqueOsuUsersInTheLastHour,
	uniqueOsuUsersInTheLastDay,
	uniqueOsuUsersInTheLastWeek,
	uniqueOsuUsers,
	elitebotixProcessQueueAccesses,
	elitebotixBanchoProcessQueueAccesses,
	discordUsersAccesses,
	multiMatchesAccesses,
	multiGameScoresAccesses,
	beatmapsAccesses,
};