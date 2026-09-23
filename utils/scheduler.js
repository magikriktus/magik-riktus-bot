import { EmbedBuilder } from 'discord.js';
import cron from 'node-cron';
import { addBalance, getRanking } from './balance.js';
import cloudinary from './cloudinary.js';

// --- CONFIGURATION ---
const REWARD_CHANNEL_ID = '1548605035137736714';
const MONTHLY_REWARD_AMOUNT = 90;
const EMOJI_COIN = '<:magikcoin:1545128700985614336>';
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Démarre le planificateur de tâches (cron)
 *
 * @param {import('discord.js').Client} client - L'instance du client Discord
 * @param {import('pg').Pool} pool - Le pool de connexion PostgreSQL
 */
export function startScheduler(client, pool) {
  // 1. CRON HORAIRE : Envoi des messages programmés
  cron.schedule(
    '0 * * * *',
    async () => {
      try {
        const now = new Date();
        const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
          .toISOString()
          .split('T')[0];

        const { rows } = await pool.query(
          `SELECT * FROM scheduled_messages WHERE sent = FALSE AND send_at <= $1`,
          [today],
        );

        if (rows.length === 0) return;

        for (const msg of rows) {
          try {
            const channel = await client.channels.fetch(msg.channel_id);

            if (!channel) {
              console.error(
                `❌ Salon introuvable pour le message ID ${msg.id}`,
              );
              continue;
            }

            await channel.send({
              content: msg.role_id
                ? `<@&${msg.role_id}>\u200B\n${msg.content}`
                : msg.content,
              allowedMentions: { parse: ['users', 'roles', 'everyone'] },
              files: msg.file_path ? [msg.file_path] : [],
            });

            if (msg.public_id) {
              try {
                const deleteResult = await cloudinary.api.delete_resources([
                  msg.public_id,
                ]);
                console.log(
                  '🧹 Image Cloudinary supprimée :',
                  deleteResult.deleted,
                );
              } catch (cloudinaryError) {
                console.error(
                  `⚠️ Erreur suppression Cloudinary pour le message #${msg.id} :`,
                  cloudinaryError,
                );
              }
            }

            await pool.query('DELETE FROM scheduled_messages WHERE id = $1', [
              msg.id,
            ]);
          } catch (msgError) {
            console.error(
              `❌ Erreur lors de l'envoi du message programmé #${msg.id} :`,
              msgError,
            );
          }
        }
      } catch (cronError) {
        console.error(
          "❌ Erreur globale lors de l'exécution du cron scheduler :",
          cronError,
        );
      }
    },
    {
      timezone: 'Europe/Paris',
    },
  );

  // 2. CRON QUOTIDIEN (Tous les jours à 09:00) : Ancienneté + Classement quotidien
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('⏰ Exécution de la routine quotidienne de 09:00...');

      try {
        const guildId = process.env.GUILD_ID;
        if (!guildId) return;

        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const rewardChannel = guild.channels.cache.get(REWARD_CHANNEL_ID);

        // A. VÉRIFICATION DES ANNIVERSAIRES D'ANCIENNETÉ
        const members = await guild.members.fetch();
        const now = new Date();

        for (const [memberId, member] of members) {
          if (member.user.bot || !member.joinedAt) continue;

          const joinedDate = member.joinedAt;

          let monthsDiff =
            (now.getFullYear() - joinedDate.getFullYear()) * 12 +
            (now.getMonth() - joinedDate.getMonth());

          if (now.getDate() < joinedDate.getDate()) {
            monthsDiff--;
          }

          if (monthsDiff >= 1 && now.getDate() === joinedDate.getDate()) {
            const res = await pool.query(
              'SELECT last_monthly_reward FROM user_activity WHERE user_id = $1',
              [memberId],
            );

            const lastReward = res.rows[0]?.last_monthly_reward;
            let alreadyRewarded = false;

            if (lastReward) {
              const lastRewardDate = new Date(lastReward);
              if (
                lastRewardDate.getMonth() === now.getMonth() &&
                lastRewardDate.getFullYear() === now.getFullYear()
              ) {
                alreadyRewarded = true;
              }
            }

            if (!alreadyRewarded) {
              await addBalance(
                memberId,
                MONTHLY_REWARD_AMOUNT,
                pool,
                member.user.username,
              );

              await pool.query(
                `INSERT INTO user_activity (user_id, last_monthly_reward)
                 VALUES ($1, NOW())
                 ON CONFLICT (user_id)
                 DO UPDATE SET last_monthly_reward = NOW()`,
                [memberId],
              );

              if (rewardChannel) {
                await rewardChannel
                  .send(
                    `🎂 **Joyeux Anniversaire d'Ancienneté ${member.displayName} !**\nCela fait **${monthsDiff} mois** que tu as rejoint la guilde ! Tu reçois **+${MONTHLY_REWARD_AMOUNT}** ${EMOJI_COIN} pour ta fidélité.`,
                  )
                  .catch(() => {});
              }
            }
          }
        }

        // B. PUBLICATION DU CLASSEMENT QUOTIDIEN DU TOP 10
        if (rewardChannel) {
          const ranking = await getRanking(pool);
          const nonZeroRanking = ranking.filter(
            (row) => Number(row.balance) > 0,
          );

          if (nonZeroRanking.length > 0) {
            const top10 = nonZeroRanking.slice(0, 10);
            const descriptionLines = ['📊 **Voici le classement du jour !**\n'];

            top10.forEach((row, index) => {
              const prefix = MEDALS[index] || `**${index + 1}.**`;
              descriptionLines.push(
                `${prefix} <@${row.user_id}> — **${row.balance}** ${EMOJI_COIN}`,
              );
            });

            const embed = new EmbedBuilder()
              .setTitle('🏆 Top 10 des Joueurs 🏆')
              .setDescription(descriptionLines.join('\n'))
              .setColor('#FFD700')
              .setFooter({
                text: 'Mise à jour quotidienne automatique à 09:00',
              })
              .setTimestamp();

            await rewardChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      } catch (error) {
        console.error(
          '❌ Erreur lors de la routine quotidienne de 09:00 :',
          error,
        );
      }
    },
    {
      timezone: 'Europe/Paris',
    },
  );
}
