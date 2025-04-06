const autohost = require('../matches/autohost.js');

module.exports = {
	name: 'autohost',
	help: '!autohost <password> - Autohosts a lobby with tournament maps',
	tag: 'general',
	async execute(bancho, message, args) {
		autohost.execute(bancho, message.user.id, { password: args[0] });
	},
};