const { DBElitebotixProcessQueue } = require('../dbObjects');

module.exports = {
	name: 'leave',
	alias: ['leave1v1', 'queue1v1-leave', 'quit', 'exit', 'stop', 'cancel'],
	help: '!leave - Leave the queue for 1v1 matches',
	async execute(bancho, message, args) {
		await message.user.fetchFromAPI();

		let existingQueueTasks = await DBElitebotixProcessQueue.findAll({
			attributes: ['id', 'additions'],
			where: {
				task: 'duelQueue1v1',
			},
		});

		for (let i = 0; i < existingQueueTasks.length; i++) {
			const osuUserId = existingQueueTasks[i].additions.split(';')[0];

			if (osuUserId == message.user.id) {
				await existingQueueTasks[i].destroy();

				await updateQueueChannels();

				return message.user.sendMessage('You have been removed from the queue for a 1v1 duel.');
			}
		}

		return message.user.sendMessage('You are not in the queue for a 1v1 duel.');
	},
};