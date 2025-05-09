const { DBElitebotixDiscordUsers, DBElitebotixProcessQueue } = require('../dbObjects');
const { getUserDuelStarRating } = require(`${process.env.ELITEBOTIXROOTPATH}/utils`);
const { updateQueueChannels, trySendMessage } = require('../utils');

module.exports = {
	name: 'play',
	alias: ['play1v1', 'queue1v1'],
	help: '!play / !play1v1 / !queue1v1 - Queue up for 1v1 matches',
	tag: 'general',
	async execute(bancho, message) {
		let discordUser = await DBElitebotixDiscordUsers.findOne({
			attributes: ['osuUserId'],
			where: {
				osuUserId: message.user.id,
				osuVerified: true
			}
		});

		if (!discordUser) {
			return await trySendMessage(message.user, `Please connect and verify your account with the bot on discord as a backup by using: '/osu-link connect username:${message.user.username}' [https://discord.gg/Asz5Gfe Discord]`);
		}

		let existingQueueTasks = await DBElitebotixProcessQueue.findAll({
			attributes: ['additions'],
			where: {
				task: 'duelQueue1v1',
			},
		});

		for (let i = 0; i < existingQueueTasks.length; i++) {
			const osuUserId = existingQueueTasks[i].additions.split(';')[0];

			if (osuUserId === discordUser.osuUserId) {
				let ownRating = parseFloat(existingQueueTasks[i].additions.split(';')[1]);
				let tasksInReach = existingQueueTasks.filter((task) => {
					return Math.abs(ownRating - parseFloat(task.additions.split(';')[1])) < 1;
				});

				return await trySendMessage(message.user, `You are already in the queue for a 1v1 duel. There are ${existingQueueTasks.length - 1} opponents in the queue (${tasksInReach.length - 1} in reach).`);
			}
		}

		let ownStarRating = 5;
		try {
			await trySendMessage(message.user, 'Processing duel rating...');
			ownStarRating = await getUserDuelStarRating({ osuUserId: discordUser.osuUserId });

			ownStarRating = ownStarRating.total;
		} catch (e) {
			if (e !== 'No standard plays') {
				console.error('gotBanchoPrivateMessage.js | process duel rating for queue' + e);
			}
		}

		//Check again in case the user spammed the command
		existingQueueTasks = await DBElitebotixProcessQueue.findAll({
			attributes: ['additions'],
			where: {
				task: 'duelQueue1v1',
			},
		});

		for (let i = 0; i < existingQueueTasks.length; i++) {
			const osuUserId = existingQueueTasks[i].additions.split(';')[0];

			if (osuUserId === discordUser.osuUserId) {
				let ownRating = parseFloat(existingQueueTasks[i].additions.split(';')[1]);
				let tasksInReach = existingQueueTasks.filter((task) => {
					return Math.abs(ownRating - parseFloat(task.additions.split(';')[1])) < 1;
				});

				return await trySendMessage(message.user, `You are already in the queue for a 1v1 duel. There are ${existingQueueTasks.length - 1} opponents in the queue (${tasksInReach.length - 1} in reach).`);
			}
		}

		await DBElitebotixProcessQueue.create({
			guildId: 'none',
			task: 'duelQueue1v1',
			additions: `${discordUser.osuUserId};${ownStarRating};0.125`,
			date: new Date(),
			priority: 9
		});

		await updateQueueChannels();

		let tasksInReach = existingQueueTasks.filter((task) => {
			return Math.abs(ownStarRating - parseFloat(task.additions.split(';')[1])) < 1;
		});

		return await trySendMessage(message.user, `You are now queued up for a 1v1 duel. There are ${existingQueueTasks.length} opponents in the queue (${tasksInReach.length} in reach).`);

	},
};