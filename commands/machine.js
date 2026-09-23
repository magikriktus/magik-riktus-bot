import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import {
  addBalance,
  canPlayAndIncrement,
  getBalance,
  incrementGamesLoose,
  incrementGamesPlayed,
  incrementGamesWin,
  removeBalance,
} from '../utils/balance.js';
import { addToJackpot } from '../utils/jackpot.js';
import { ROLE_EMOJIS } from '../utils/roles.js';

const EMOJI_COIN = '<:magikcoin:1545128700985614336>';
const WILD_EMOJI_NAME = 'eca'; // Nom de l'emoji Écaflip servant de Joker

// Liste stricte des 12 classes de base autorisées
const ALLOWED_BASE_CLASSES = [
  'feca',
  'osa',
  'enu',
  'sram',
  'xel',
  'eca',
  'eni',
  'iop',
  'cra',
  'sadi',
  'sacri',
  'panda',
];

// Les 8 combinaisons de lignes gagnantes dans la matrice 3x3 [ligne, colonne]
const WINNING_LINES = [
  // Horizontales
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  // Verticales
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  // Diagonales
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
];

// Vérification stricte si un symbole est le Joker Écaflip (évite les fautes avec 'feca')
function isWildSymbol(symbolString) {
  return new RegExp(`[:_]${WILD_EMOJI_NAME}[:_]`, 'i').test(symbolString);
}

// Extraction automatique des emojis des 12 classes de base
function getClassEmojis(guild) {
  const classEmojis = [];

  for (const config of Object.values(ROLE_EMOJIS)) {
    if (
      config.type === 'class' &&
      ALLOWED_BASE_CLASSES.includes(config.emoji)
    ) {
      const customEmoji = guild?.emojis.cache.find(
        (e) => e.name === config.emoji,
      );
      classEmojis.push(
        customEmoji ? customEmoji.toString() : `:${config.emoji}:`,
      );
    }
  }

  return classEmojis;
}

export const data = new SlashCommandBuilder()
  .setName('machine')
  .setDescription('Joue à la machine à sous 3x3 avec les 12 classes de base !')
  .addIntegerOption((option) =>
    option
      .setName('mise')
      .setDescription('Le montant de pièces à miser')
      .setRequired(true)
      .setMinValue(1),
  );

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('pg').Pool} pool
 */
export async function execute(interaction, pool) {
  const bet = interaction.options.getInteger('mise');
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    // 1. Vérification du quota quotidien de 12 parties
    const quota = await canPlayAndIncrement(
      userId,
      pool,
      interaction.user.username,
    );
    if (!quota.allowed) {
      return await interaction.editReply({
        content: `🛑 **Limite atteinte !** Tu as déjà joué tes **12 parties quotidiennes** aujourd'hui (tous jeux confondus). Reviens demain !`,
      });
    }

    // 2. Vérification du solde du joueur
    const userBalance = await getBalance(userId, pool);
    if (userBalance < bet) {
      return await interaction.editReply({
        content: `❌ Solde insuffisant ! Tu as **${userBalance}** ${EMOJI_COIN} mais tu veux miser **${bet}** ${EMOJI_COIN}.`,
      });
    }

    // 3. Enregistrement de la partie jouée et déduction de la mise
    await incrementGamesPlayed(userId, pool, interaction.user.username);
    await removeBalance(userId, bet, pool);

    // 4. Récupération des symboles (12 classes de base)
    const availableEmojis = getClassEmojis(interaction.guild);

    if (availableEmojis.length === 0) {
      return await interaction.editReply({
        content: '❌ Aucun emoji de classe trouvé sur le serveur.',
      });
    }

    // 5. Génération de la grille 3x3
    const grid = Array.from({ length: 3 }, () =>
      Array.from(
        { length: 3 },
        () =>
          availableEmojis[Math.floor(Math.random() * availableEmojis.length)],
      ),
    );

    // Formate la grille d'affichage
    const displayGrid = grid
      .map((row) => `🎰 ${row.join(' | ')} 🎰`)
      .join('\n');

    // 6. Calcul des lignes gagnantes avec gestion stricte du Joker
    let winningLinesCount = 0;

    for (const line of WINNING_LINES) {
      const symbols = line.map(([r, c]) => grid[r][c]);

      // Filtrage strict pour ignorer uniquement 'eca' et non 'feca'
      const nonWilds = symbols.filter((s) => !isWildSymbol(s));

      // La ligne est gagnante si elle contient au maximum 1 type de symbole hors Jokers
      if (new Set(nonWilds).size <= 1) {
        winningLinesCount++;
      }
    }

    // Vérification du Jackpot (toute la grille alignée ou complétée par des Jokers)
    const allSymbols = grid.flat();
    const allNonWilds = allSymbols.filter((s) => !isWildSymbol(s));
    const isJackpot = new Set(allNonWilds).size <= 1;

    let winAmount = 0;
    let resultMessage = '';

    if (isJackpot) {
      winAmount = bet * 25;
      resultMessage = `💥 **JACKPOT EXCEPTIONNEL !** Toute la grille est alignée ! Tu remportes **+${winAmount}** ${EMOJI_COIN} !`;
      await incrementGamesWin(userId, pool);
    } else if (winningLinesCount > 0) {
      winAmount = bet * (winningLinesCount * 3);
      resultMessage = `🎉 **GAGNÉ !** Tu as aligné **${winningLinesCount} ligne(s)** (avec le bonus Écaflip Joker 🃏) ! Tu remportes **+${winAmount}** ${EMOJI_COIN} !`;
      await incrementGamesWin(userId, pool);
    } else {
      resultMessage = `☠️ **Perdu !** Pas d'alignement réussi. Tu perds **${bet}** ${EMOJI_COIN}.`;
      await incrementGamesLoose(userId, pool);

      // Alimentation de la cagnotte Jackpot (50% de la mise perdue)
      const jackpotShare = Math.floor(bet * 0.5);
      if (jackpotShare > 0) {
        await addToJackpot(jackpotShare, pool);
      }
    }

    // 7. Enregistrement des gains en BDD
    if (winAmount > 0) {
      await addBalance(userId, winAmount, pool, interaction.user.username);
    }

    const finalBalance = await getBalance(userId, pool);

    // 8. Envoi de l'embed de résultat
    const embed = new EmbedBuilder()
      .setTitle('🎰 Machine à sous des Classes 🎰')
      .setDescription(`${displayGrid}\n\n${resultMessage}`)
      .setColor(winAmount > 0 ? '#4CAF50' : '#FF4D4D')
      .addFields({
        name: '💳 Solde restant',
        value: `**${finalBalance}** ${EMOJI_COIN}`,
        inline: false,
      })
      .setFooter({
        text: `Joué par ${interaction.user.username} | Partie ${quota.playedToday}/12 aujourd'hui | 🃏 Écaflip = Joker`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Erreur lors du jeu de slots :', error);
    await interaction.editReply({
      content: '❌ Une erreur est survenue lors de l’exécution du jeu.',
    });
  }
}
