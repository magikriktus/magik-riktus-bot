import { Events } from 'discord.js';
import { addBalance } from '../utils/balance.js';

// --- SALON DE NOTIFICATION DES RÉCOMPENSES ---
const REWARD_CHANNEL_ID = '1548605035137736714';

// --- CONFIGURATION ---
const VOICE_THRESHOLD_SECONDS = 3600; // Palier : 1 heure (3600 secondes)
const VOICE_REWARD = 250; // Gains en coins par heure de vocal
const EMOJI_COIN = '<:magikcoin:1545128700985614336>';

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState, client, pool) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const userId = member.id;
    const now = Date.now();

    if (!client.tempData.has('voice_sessions')) {
      client.tempData.set('voice_sessions', new Map());
    }
    const voiceSessions = client.tempData.get('voice_sessions');

    const isAfkChannel = newState.channelId === newState.guild.afkChannelId;
    const isDeaf = newState.deaf || newState.selfDeaf;
    const isValidVoice = newState.channelId && !isAfkChannel && !isDeaf;

    const session = voiceSessions.get(userId);

    // 1. DÉBUT DE SESSION VOCALE
    if (isValidVoice && !session) {
      voiceSessions.set(userId, now);
      return;
    }

    // 2. FIN DE SESSION VOCALE
    if ((!isValidVoice || !newState.channelId) && session) {
      const durationSeconds = Math.floor((now - session) / 1000);
      voiceSessions.delete(userId);

      if (durationSeconds < 10) return;

      try {
        let res = await pool.query(
          'SELECT voice_seconds FROM user_activity WHERE user_id = $1',
          [userId],
        );

        let currentSeconds = res.rows[0]?.voice_seconds || 0;
        let totalSeconds = currentSeconds + durationSeconds;

        if (totalSeconds >= VOICE_THRESHOLD_SECONDS) {
          const rewardsCount = Math.floor(
            totalSeconds / VOICE_THRESHOLD_SECONDS,
          );
          const totalReward = rewardsCount * VOICE_REWARD;
          totalSeconds = totalSeconds % VOICE_THRESHOLD_SECONDS;

          await addBalance(userId, totalReward, pool, member.user.username);

          // Notification envoyée dans le salon dédié
          const rewardChannel =
            member.guild.channels.cache.get(REWARD_CHANNEL_ID);
          if (rewardChannel) {
            const hoursEarned = rewardsCount;
            await rewardChannel
              .send(
                `🎙️ **Bravo <@${userId}> !** Tu as accumulé **${hoursEarned} heure(s)** en vocal et tu gagnes **+${totalReward}** ${EMOJI_COIN} !`,
              )
              .catch(() => {});
          }
        }

        await pool.query(
          `INSERT INTO user_activity (user_id, username, voice_seconds)
   VALUES ($1, $2, $3)
   ON CONFLICT (user_id)
   DO UPDATE SET voice_seconds = $3, username = $2`,
          [userId, member.user.username, totalSeconds],
        );
      } catch (error) {
        console.error(`❌ Erreur voiceStateUpdate pour ${userId} :`, error);
      }
    }
  },
};
