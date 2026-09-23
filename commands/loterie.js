import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import {
  addBalance,
  canPlayAndIncrement,
  getBalance,
  incrementGamesLoose,
  incrementGamesPlayed,
  incrementGamesTied,
  incrementGamesWin,
  removeBalance,
} from '../utils/balance.js';
import {
  addToJackpot,
  getJackpot,
  removeFromJackpot,
  resetJackpot,
} from '../utils/jackpot.js';

const EMOJI_COIN = '<:magikcoin:1545128700985614336>';
const INITIAL_JACKPOT_AMOUNT = 1000; // Montant minimum du Jackpot
const MAX_JACKPOT_MULTIPLIER = 100; // Cap du Jackpot à 100x la mise du joueur

// Table des tirages
const PRIZE_TABLE = [
  {
    label: '🎉 JACKPOT PROGRESSIF !',
    multiplier: 'JACKPOT',
    chance: 1,
    color: '#FFD700',
  },
  { label: '🔥 Super Gain !', multiplier: 2, chance: 9, color: '#4CAF50' },
  { label: '✨ Beau Gain !', multiplier: 1.4, chance: 10, color: '#8BC34A' },
  { label: '👍 Petit Gain', multiplier: 1.2, chance: 15, color: '#CDDC39' },
  { label: '🤝 Mise Remboursée', multiplier: 1, chance: 30, color: '#FFC107' },
  {
    label: '📉 Perte Partielle',
    multiplier: 0.5,
    chance: 15,
    color: '#FF9800',
  },
  {
    label: '💀 Un incroyable rien !',
    multiplier: 0,
    chance: 20,
    color: '#FF4D4D',
  },
];

function drawPrize() {
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const prize of PRIZE_TABLE) {
    cumulative += prize.chance;
    if (rand < cumulative) {
      return prize;
    }
  }
  return PRIZE_TABLE[PRIZE_TABLE.length - 1];
}

export const data = new SlashCommandBuilder()
  .setName('loterie')
  .setDescription(
    'Achète un ticket de loterie instantané et tente de décrocher le Jackpot progressif !',
  )
  .addIntegerOption((option) =>
    option
      .setName('mise')
      .setDescription('Le prix du ticket de loterie')
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

  // 2. Vérification du solde du joueur
  const userBalance = await getBalance(userId, pool);

  if (userBalance < betAmount) {
    return interaction.editReply(
      `❌ Solde insuffisant ! Tu as **${userBalance}** ${EMOJI_COIN} mais le ticket coûte **${betAmount}** ${EMOJI_COIN}.`,
    );
  }

  // 3. Enregistrement de la partie jouée
  await incrementGamesPlayed(userId, pool, interaction.user.username);

  // 4. Déduction de la mise
  await removeBalance(userId, betAmount, pool);

  // Tirage au sort
  const prize = drawPrize();

  let winnings = 0;
  let multiplierDisplay = '';
  let jackpotWon = false;

  if (prize.multiplier === 'JACKPOT') {
    jackpotWon = true;
    const currentJackpot = await getJackpot(pool);
    const maxWinAllowed = betAmount * MAX_JACKPOT_MULTIPLIER;

    // Le gain est plafonné à MAX_JACKPOT_MULTIPLIER x la mise
    winnings = Math.min(currentJackpot, maxWinAllowed);
    multiplierDisplay = `🏆 JACKPOT (Plafond ×${MAX_JACKPOT_MULTIPLIER}) 🏆`;

    if (winnings >= currentJackpot) {
      // Si le joueur a vidé tout le Jackpot
      await resetJackpot(INITIAL_JACKPOT_AMOUNT, pool);
    } else {
      // Si la mise était trop petite pour tout rafler, on ne retire que ce qu'il a gagné
      await removeFromJackpot(winnings, pool);
    }

    // Un Jackpot est une victoire
    await incrementGamesWin(userId, pool);
  } else {
    winnings = Math.floor(betAmount * prize.multiplier);
    multiplierDisplay = `×${prize.multiplier}`;

    // Calcul de l'argent perdu et alimentation du Jackpot (50%)
    const lostAmount = betAmount - winnings;
    if (lostAmount > 0) {
      const jackpotShare = Math.floor(lostAmount * 0.5);
      await addToJackpot(jackpotShare, pool);
    }

    // Incrémentation victoires/défaites/égalités selon le multiplicateur
    if (prize.multiplier > 1) {
      await incrementGamesWin(userId, pool);
    } else if (prize.multiplier < 1) {
      await incrementGamesLoose(userId, pool);
    } else {
      // Si multiplier === 1 (Mise remboursée), enregistrement de l'égalité
      await incrementGamesTied(userId, pool);
    }
  }

  // Crédit des gains
  if (winnings > 0) {
    await addBalance(userId, winnings, pool, interaction.user.username);
  }

  const finalBalance = await getBalance(userId, pool);
  const updatedJackpot = await getJackpot(pool);

  const embed = new EmbedBuilder()
    .setTitle(`🎟️ Loterie : ${prize.label}`)
    .setColor(prize.color)
    .addFields(
      {
        name: '🎫 Prix du ticket',
        value: `**${betAmount}** ${EMOJI_COIN}`,
        inline: true,
      },
      {
        name: '💰 Multiplicateur',
        value: `**${multiplierDisplay}**`,
        inline: true,
      },
      {
        name: '🎁 Gain final',
        value: `**${winnings}** ${EMOJI_COIN}`,
        inline: true,
      },
      {
        name: '💳 Solde restant',
        value: `**${finalBalance}** ${EMOJI_COIN}`,
        inline: true,
      },
      {
        name: '🎰 Cagnotte Jackpot restante',
        value: `**${updatedJackpot}** ${EMOJI_COIN}`,
        inline: true,
      },
    )
    .setFooter({
      text: `Ticket gratté par ${interaction.user.displayName} | Partie ${quota.playedToday}/12 aujourd'hui`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  await interaction.editReply({
    content:
      '🎟️ **Ticket gratté !** Le résultat de ta loterie a été publié dans le salon.',
  });

  // Message avec mention spéciale en cas de Jackpot décroché !
  const contentMsg = jackpotWon
    ? `🚨 **INCROYABLE ! <@${userId}> A DÉCROCHÉ ${winnings}** ${EMOJI_COIN} SUR LE JACKPOT ! 🚨`
    : `🎟️ **Loterie de ${interaction.user}**`;

  return interaction.channel.send({
    content: contentMsg,
    embeds: [embed],
  });
}
