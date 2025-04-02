const autohost = require('./matches/autohost.js');

module.exports = {
	name: 'autohost',
	help: '!autohost <password> - Autohosts a lobby with tournament maps',
	async execute(bancho, message, args) {
		await message.user.fetchFromAPI();
		autohost.execute(bancho, message.user.id, { password: args[0] });
	},
};