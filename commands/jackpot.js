import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getJackpot } from '../utils/jackpot.js';

const EMOJI_COIN = '<:magikcoin:1545128700985614336>';

export const data = new SlashCommandBuilder()
  .setName('jackpot')
  .setDescription('Consulte le montant actuel du Jackpot de la guilde');

/**
 * Exécute la commande /jackpot
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('pg').Pool} pool
 */
export async function execute(interaction, pool) {
  await interaction.deferReply();

  try {
    const jackpotAmount = await getJackpot(pool);

    const embed = new EmbedBuilder()
      .setTitle('🎰 Jackpot de la Guilde')
      .setDescription(
        `Le Jackpot s'élève actuellement à :\n\n# **${jackpotAmount}** ${EMOJI_COIN}\n\n*Une partie des pertes du casino vient alimenter ce Jackpot !*`,
      )
      .setColor('#FFD700')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Erreur lors de la commande jackpot :', error);
    await interaction.editReply({
      content: '❌ Impossible de récupérer le montant du Jackpot.',
    });
  }
}
