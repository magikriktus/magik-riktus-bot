import { Events, MessageType } from 'discord.js';
import { addBalance } from '../utils/balance.js';

// --- CONFIGURATION MODÉRATION SALONS IMAGES ---
const AUTO_CLEAN_CHANNELS_IMG = [
  '1350937297142419558', // salon "screens"
  '1360338547827282262', // salon "Magik-Rusher"
];

// --- SALON DE NOTIFICATION DES RÉCOMPENSES ---
const REWARD_CHANNEL_ID = '1548605035137736714';

// --- CONFIGURATION SYSTÈME D'ACTIVITÉ ---
const COOLDOWN_SECONDS = 60; // 1 message comptabilisé max toutes les 60s
const MESSAGE_THRESHOLD = 50; // Palier de messages pour la récompense
const MESSAGE_REWARD = 50; // Coins gagnés tous les X messages
const DAYS_THRESHOLD = 7; // Palier de jours d'activité (tous les X jours)
const DAYS_REWARD = 50; // Coins gagnés tous les 7 jours d'activité
const EMOJI_COIN = '<:magikcoin:1545128700985614336>';

// Préfixes de bots courants à ignorer pour les récompenses
const BOT_PREFIXES = ['!', '?', '.', '/', '-', '$', '+', '%', ';'];

export default {
  name: Events.MessageCreate,
  async execute(message, client, pool) {
    if (message.author.bot || !message.guild) return;

    // =========================================================
    // 1. MODÉRATION AUTOMATIQUE DES SALONS D'IMAGES
    // =========================================================
    if (AUTO_CLEAN_CHANNELS_IMG.includes(message.channel.id)) {
      try {
        if (message.type !== MessageType.Default) {
          await message.delete().catch(() => {});
          return;
        }

        if (
          !message.channel.isThread() &&
          !message.content.trim().startsWith('/')
        ) {
          const hasImage = message.attachments.some(
            (att) =>
              att.contentType?.startsWith('image/') ||
              /\.(png|jpe?g|gif|webp)$/i.test(att.name ?? ''),
          );

          if (!hasImage) {
            await message.delete().catch(() => {});
            await message.author
              .send(
                `👋 Salut ${message.author.username}, ton message dans **#${message.channel.name}** a été supprimé car ce salon est réservé aux images (screens, galeries).`,
              )
              .catch(() => {});
            return;
          }
        }
      } catch (err) {
        console.error(
          '❌ Erreur lors de la modération automatique :',
          err.message,
        );
      }
    }

    // =========================================================
    // 2. FILTRAGE POUR LES RÉCOMPENSES D'ACTIVITÉ
    // =========================================================
    const content = message.content.trim();
    if (BOT_PREFIXES.some((prefix) => content.startsWith(prefix))) return;

    const userId = message.author.id;
    const displayName = message.member?.displayName || message.author.username;
    const now = Date.now();

    // Anti-spam (Memory Cooldown)
    if (!client.tempData.has('msg_cooldowns')) {
      client.tempData.set('msg_cooldowns', new Map());
    }
    const cooldowns = client.tempData.get('msg_cooldowns');
    const lastMsgTime = cooldowns.get(userId) || 0;

    if (now - lastMsgTime < COOLDOWN_SECONDS * 1000) return;

    cooldowns.set(userId, now);

    // =========================================================
    // 3. COMPTEURS ET RÉCOMPENSES BDD
    // =========================================================
    try {
      let res = await pool.query(
        'SELECT last_active_date, activity_streak, message_count FROM user_activity WHERE user_id = $1',
        [userId],
      );

      let activity = res.rows[0];

      // Premier message absolu du joueur
      if (!activity) {
        await pool.query(
          'INSERT INTO user_activity (user_id, username, message_count, activity_streak, last_active_date) VALUES ($1, $2, 1, 1, CURRENT_DATE)',
          [userId, message.author.username],
        );
        return;
      }

      // Salon de notification dédié
      const rewardChannel = message.guild.channels.cache.get(REWARD_CHANNEL_ID);

      // Gestion des jours d'activité (cumulatif non consécutif)
      const today = new Date().toISOString().split('T')[0];
      let lastActive = activity.last_active_date
        ? new Date(activity.last_active_date).toISOString().split('T')[0]
        : null;

      let totalDays = activity.activity_streak;
      let newCount = activity.message_count + 1;

      if (lastActive !== today) {
        totalDays += 1;

        // Palier de X jours d'activité atteint
        if (totalDays % DAYS_THRESHOLD === 0) {
          await addBalance(userId, DAYS_REWARD, pool, message.author.username);

          if (rewardChannel) {
            await rewardChannel
              .send(
                `📅 **Félicitations ${displayName} !** Tu as atteint **${totalDays} jours d'activité** sur le serveur. Tu gagnes **+${DAYS_REWARD}** ${EMOJI_COIN} !`,
              )
              .catch(() => {});
          }
        }
      }

      // Gestion du palier de messages
      if (newCount >= MESSAGE_THRESHOLD) {
        newCount = 0;
        await addBalance(userId, MESSAGE_REWARD, pool, message.author.username);

        if (rewardChannel) {
          await rewardChannel
            .send(
              `💬 **Bravo ${displayName} !** Tu as envoyé **${MESSAGE_THRESHOLD} messages** et tu gagnes **+${MESSAGE_REWARD}** ${EMOJI_COIN} !`,
            )
            .catch(() => {});
        }
      }

      // Mise à jour BDD
      await pool.query(
        'UPDATE user_activity SET message_count = $1, activity_streak = $2, last_active_date = CURRENT_DATE, username = $3 WHERE user_id = $4',
        [newCount, totalDays, message.author.username, userId],
      );
    } catch (error) {
      console.error(`❌ Erreur activité messageCreate pour ${userId} :`, error);
    }
  },
};
