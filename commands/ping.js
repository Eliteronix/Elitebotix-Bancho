const { trySendMessage } = require('../utils');
const { DBElitebotixDiscordUsers, DBElitebotixProcessQueue } = require('../dbObjects');

module.exports = {
	name: 'ping',
	help: '!ping - Get your ping to Bancho',
	tag: 'general',
    async execute(bancho, message) {
        let discordUser = await DBElitebotixDiscordUsers.findOne({
            attributes: ['osuUserId', 'userId'],
            where: {
                osuUserId: message.user.id,
                osuVerified: true
            }
        });
        
        if (!discordUser || !discordUser.userId) {
            return await trySendMessage(message.user, `Please connect and verify your account with the bot on discord as a backup by using: '/osu-link connect username:${message.user.username}' [https://discord.gg/Asz5Gfe Discord]`);
        }

        let now = new Date();
        const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const pongMessage = `Pong! [${timestamp}] command sent`;

        await trySendMessage(message.user, pongMessage);

        await DBElitebotixProcessQueue.create({
            guildId: 'none',
            task: 'messageUser',
            additions: `${discordUser.userId};;${pongMessage}`,
            date: now,
            priority: 1,
        });
    },
};