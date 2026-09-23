import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  addBalance,
  canPlayAndIncrement,
  getBalance,
  incrementGamesPlayed,
  incrementGamesTied,
  incrementGamesWin,
  removeBalance,
} from '../utils/balance.js';
import {
  CARD_BACK,
  calculateScore,
  drawCard,
  formatHand,
} from '../utils/cards.js';

const EMOJI_COIN = '<:magikcoin:1545128700985614336>';

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription(
    'Joue une partie de Blackjack et tente de doubler tes coins !',
  )
  .addIntegerOption((option) =>
    option
      .setName('mise')
      .setDescription('Le montant de coins à miser')
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction, pool) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const betAmount = interaction.options.getInteger('mise');
  const userId = interaction.user.id;

  // 1. Vérification du quota quotidien de 12 parties
  const quota = await canPlayAndIncrement(
    userId,
    pool,
    interaction.user.username,
  );
  if (!quota.allowed) {
    return interaction.editReply(
      `🛑 **Limite atteinte !** Tu as déjà joué tes **12 parties quotidiennes** aujourd'hui (tous jeux confondus). Reviens demain !`,
    );
  }

  // 2. Vérification du solde
  const userBalance = await getBalance(userId, pool);

  if (userBalance < betAmount) {
    return interaction.editReply(
      `❌ Solde insuffisant ! Tu as **${userBalance}** ${EMOJI_COIN} mais tu veux miser **${betAmount}** ${EMOJI_COIN}.`,
    );
  }

  // 3. Enregistrement de la partie et déduction de la mise
  await incrementGamesPlayed(userId, pool, interaction.user.username);

  await removeBalance(userId, betAmount, pool);

  const playerHand = [drawCard(), drawCard()];
  const dealerHand = [drawCard(), drawCard()];

  const playerScore = calculateScore(playerHand);
  const dealerScore = calculateScore(dealerHand);

  if (playerScore === 21) {
    let title = '';
    let desc = '';
    let color = '';

    if (dealerScore === 21) {
      await addBalance(userId, betAmount, pool, interaction.user.username);
      await incrementGamesTied(userId, pool);

      title = '🤝 Égalité (Double Blackjack !)';
      desc = `Vous avez tous les deux un Blackjack naturel ! Ta mise de **${betAmount}** ${EMOJI_COIN} t'est restituée.`;
      color = '#FFC107';
    } else {
      await incrementGamesWin(userId, pool);
      const winnings = Math.floor(betAmount * 2.5);
      await addBalance(userId, winnings, pool, interaction.user.username);
      title = '🔥 BLACKJACK !';
      desc = `Tu as un Blackjack naturel ! Tu remportes **${winnings}** ${EMOJI_COIN} (Payé 3:2) !`;
      color = '#4CAF50';
    }

    const finalBalance = await getBalance(userId, pool);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor(color)
      .addFields(
        {
          name: '🃏 Cartes du joueur',
          value: `${formatHand(playerHand)} (21)`,
          inline: true,
        },
        {
          name: '🤖 Croupier',
          value: `${formatHand(dealerHand)} (Total : ${dealerScore})`,
          inline: true,
        },
        {
          name: '💳 Solde restant',
          value: `**${finalBalance}** ${EMOJI_COIN}`,
          inline: false,
        },
      )
      .setFooter({
        text: `Partie de ${interaction.user.displayName} | Partie ${quota.playedToday}/12 aujourd'hui`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({
      content:
        '🏁 **Partie terminée !** Le résultat a été publié dans le salon.',
    });

    return interaction.channel.send({
      content: `🎰 **Résultat du Blackjack de ${interaction.user}**`,
      embeds: [embed],
    });
  }

  interaction.client.tempData.set(`bj_${userId}`, {
    bet: betAmount,
    playerHand,
    dealerHand,
  });

  const embed = new EmbedBuilder()
    .setTitle('🎰 Table de Blackjack')
    .setColor('#2F3136')
    .addFields(
      {
        name: '🃏 Tes cartes',
        value: `${formatHand(playerHand)} (Total : **${playerScore}**)`,
        inline: true,
      },
      {
        name: '🤖 Croupier',
        value: `${dealerHand[0].emoji} ${CARD_BACK}`,
        inline: true,
      },
      {
        name: '💰 Mise en jeu',
        value: `**${betAmount}** ${EMOJI_COIN}`,
        inline: false,
      },
    )
    .setFooter({
      text: `Partie de ${interaction.user.displayName} | Partie ${quota.playedToday}/12 aujourd'hui`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  const remainingBalance = userBalance - betAmount;

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bj_hit')
      .setLabel('Tirer 🃏')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('bj_stand')
      .setLabel('Rester 🛑')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('bj_double')
      .setLabel('Doubler ✖️2')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(remainingBalance < betAmount),
  );

  return interaction.editReply({ embeds: [embed], components: [buttons] });
}
