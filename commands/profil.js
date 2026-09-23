import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getUserStats } from '../utils/balance.js';
import { getUserRoleEmojis } from '../utils/roles.js';

const EMOJI_COIN = '<:magikcoin:1545128700985614336>';

/**
 * Configuration de la commande Slash /profil
 */
export const data = new SlashCommandBuilder()
  .setName('profil')
  .setDescription('Affiche ton solde et tes statistiques de jeu')
  .addUserOption((option) =>
    option
      .setName('utilisateur')
      .setDescription('Mentionner un utilisateur')
      .setRequired(false),
  );

/**
 * Exécute la commande /profil
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('pg').Pool} pool
 */
export async function execute(interaction, pool) {
  const target = interaction.options.getUser('utilisateur') || interaction.user;

  await interaction.deferReply();

  try {
    const stats = await getUserStats(target.id, pool);

    let displayName = target.username;
    let member = null;

    if (interaction.guild) {
      member =
        interaction.options.getMember('utilisateur') ||
        (target.id === interaction.user.id ? interaction.member : null) ||
        (await interaction.guild.members.fetch(target.id).catch(() => null));

      if (member) displayName = member.displayName;
    }

    const isSelf = target.id === interaction.user.id;
    const winRate =
      stats.gamesPlayed > 0
        ? ((stats.gamesWin / stats.gamesPlayed) * 100).toFixed(1)
        : '0.0';

    const embed = new EmbedBuilder()
      .setTitle(
        isSelf ? '💳 Mon profil & solde' : `💳 Profil de ${displayName}`,
      )
      .setThumbnail(target.displayAvatarURL())
      .setColor('#165416')
      .addFields(
        {
          name: '💰 Solde actuel',
          value: `**${stats.balance}** ${EMOJI_COIN}`,
          inline: false,
        },
        {
          name: '🎮 Parties jouées',
          value: `**${stats.gamesPlayed}**`,
          inline: true,
        },
        {
          name: '🏆 Victoires',
          value: `**${stats.gamesWin}**`,
          inline: true,
        },
        {
          name: '💀 Défaites',
          value: `**${stats.gamesLoose}**`,
          inline: true,
        },
        {
          name: '🤝 Égalités',
          value: `**${stats.gamesTied ?? 0}**`,
          inline: true,
        },
        {
          name: '📊 Taux de réussite',
          value: `**${winRate}%** de victoires`,
          inline: false,
        },
      );

    // Récupération des emojis associés aux rôles (classes & métiers)
    if (member) {
      const roleEmojis = getUserRoleEmojis(member);
      const fields = [];

      if (roleEmojis.classes.length > 0) {
        fields.push(`**Classes :** ${roleEmojis.classes.join(' ')}`);
      }
      if (roleEmojis.jobs.length > 0) {
        fields.push(`**Métiers :** ${roleEmojis.jobs.join(' ')}`);
      }

      if (fields.length > 0) {
        embed.addFields({
          name: '🎭 Spécialités',
          value: fields.join('\n'),
          inline: false,
        });
      }
    }

    // Récupération des distinctions depuis la BDD
    const { rows: distinctionsRows } = await pool.query(
      'SELECT emoji_id FROM distinctions WHERE user_id = $1',
      [target.id],
    );

    if (distinctionsRows.length > 0) {
      const emojisList = distinctionsRows.map((row) => row.emoji_id).join(' ');

      embed.addFields({
        name: '🏅 Distinctions',
        value: emojisList,
        inline: false,
      });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Erreur lors de la commande profil :', error);
    await interaction.editReply({
      content: '❌ Impossible de récupérer le solde et les statistiques.',
    });
  }
}
