module.exports = {
	name: 'np',
	help: '/ /np - Get the pp values for the current beatmap with the current mods',
	async execute(bancho, message, args) {
		await message.user.sendMessage('/ /np - Get the pp values for the current beatmap with the current mods');
	},
};