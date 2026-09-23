import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { scheduleMessage } from '../utils/auto-send.js';
import {
  addBalance,
  getBalance,
  incrementGamesLoose,
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
import { addToJackpot } from '../utils/jackpot.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMOJI_COIN = '<:magikcoin:1545128700985614336>';
const PRESENTATION_CHANNEL_ID = '1272218462756012093';

export default {
  name: Events.InteractionCreate,

  async execute(interaction, client, pool) {
    // --- 1. GESTION DES COMMANDES SLASH ---
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, pool);
      } catch (err) {
        console.error(
          `❌ Erreur lors de l'exécution de /${interaction.commandName} :`,
          err,
        );

        const errorMessage =
          '❌ Une erreur est survenue lors du traitement de la commande.';

        if (interaction.replied || interaction.deferred) {
          await interaction
            .followUp({
              content: errorMessage,
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        } else {
          await interaction
            .reply({
              content: errorMessage,
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      }
      return;
    }

    // --- 2. GESTION DES MODALES ---
    if (interaction.isModalSubmit()) {
      // Modale de programmation de message
      if (interaction.customId === 'msgdate_modal') {
        const content = interaction.fields.getTextInputValue('message_content');
        const date = interaction.fields
          .getTextInputValue('message_date')
          .trim();

        if (!DATE_REGEX.test(date)) {
          return interaction.reply({
            content:
              '❌ Format de date invalide. Utilise le format YYYY-MM-DD (ex: 2026-12-31).',
            flags: MessageFlags.Ephemeral,
          });
        }

        const temp = client.tempData?.get(interaction.user.id);

        if (!temp) {
          return interaction.reply({
            content:
              '❌ Impossible de retrouver les données associées. Réessaie la commande /msgdate.',
            flags: MessageFlags.Ephemeral,
          });
        }

        const { channelId, fileUrl, publicId, roleId } = temp;

        try {
          await scheduleMessage(
            channelId,
            content,
            date,
            fileUrl,
            publicId,
            roleId,
            pool,
          );

          client.tempData.delete(interaction.user.id);

          await interaction.reply({
            content: `✅ Message programmé pour le **${date}** à 00:01.`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (err) {
          console.error('❌ Erreur lors de la programmation du message :', err);
          await interaction.reply({
            content:
              '❌ Une erreur est survenue lors de la programmation du message en base de données.',
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      // Modale de présentation d'un nouveau membre
      if (interaction.customId === 'welcome_modal') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const pseudo = interaction.fields
          .getTextInputValue('pres_pseudo')
          .trim();
        const bio = interaction.fields.getTextInputValue('pres_bio').trim();
        const member = interaction.member;

        // 1. Renommer le membre sur le serveur
        try {
          await member.setNickname(pseudo);
        } catch (err) {
          console.error(
            '❌ Impossible de changer le pseudo (permissions ou rôle supérieur) :',
            err,
          );
        }

        // 2. Récupérer les rôles attribués lors de l'onboarding Discord (hors @everyone)
        const roles = member.roles.cache
          .filter((r) => r.id !== interaction.guild.id)
          .map((r) => `${r}`)
          .join(', ');

        // 3. Création de l'embed de présentation
        const presentationEmbed = new EmbedBuilder()
          .setTitle(`📜 Présentation de ${pseudo}`)
          .setColor('#165416')
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: '👤 Compte Discord', value: `${member}`, inline: true },
            { name: '🎮 Pseudo en jeu', value: `\`${pseudo}\``, inline: true },
            {
              name: '🎭 Rôles / Classes / Métiers',
              value: roles.length > 0 ? roles : 'Aucun rôle sélectionné',
              inline: false,
            },
            { name: '💬 À propos', value: bio, inline: false },
          )
          .setFooter({
            text: `Nouveau membre de Magik Riktus`,
            iconURL: interaction.guild.iconURL(),
          })
          .setTimestamp();

        // 4. Envoi dans le salon de présentation
        try {
          const presChannel = await interaction.guild.channels.fetch(
            PRESENTATION_CHANNEL_ID,
          );
          if (presChannel) {
            await presChannel.send({ embeds: [presentationEmbed] });
          }
        } catch (err) {
          console.error('❌ Erreur envoi salon présentation :', err);
        }

        // 5. Confirmation au membre
        return interaction.editReply({
          content: `✅ Merci **${pseudo}** ! Ta présentation a été publiée dans le salon dédié et ton pseudo a été mis à jour.`,
        });
      }

      return;
    }

    // --- 3. GESTION DES BOUTONS ---
    if (interaction.isButton()) {
      // Bouton d'accueil fixe
      if (interaction.customId === 'welcome_present_btn') {
        const modal = new ModalBuilder()
          .setCustomId('welcome_modal')
          .setTitle('Présentation de ton personnage');

        const pseudoInput = new TextInputBuilder()
          .setCustomId('pres_pseudo')
          .setLabel('Ton pseudo exact en jeu (Dofus)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Riktus-Master')
          .setRequired(true)
          .setMaxLength(32);

        const bioInput = new TextInputBuilder()
          .setCustomId('pres_bio')
          .setLabel('Une petite présentation (parcours, objectifs…)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Raconte-nous en quelques lignes qui tu es en jeu !')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(pseudoInput),
          new ActionRowBuilder().addComponents(bioInput),
        );

        return interaction.showModal(modal);
      }

      // Boutons Blackjack
      if (interaction.customId.startsWith('bj_')) {
        const game = client.tempData.get(`bj_${interaction.user.id}`);

        if (!game) {
          return interaction.reply({
            content: '❌ Aucune partie active trouvée ou la partie a expiré.',
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.deferUpdate();

        // Utilitaires de fin de partie
        const sendFinalResult = async (
          title,
          description,
          color,
          playerScore,
          dealerScore,
        ) => {
          client.tempData.delete(`bj_${interaction.user.id}`);

          await incrementGamesPlayed(
            interaction.user.id,
            pool,
            interaction.user.username,
          );

          const finalBalance = await getBalance(interaction.user.id, pool);

          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .addFields(
              {
                name: '🃏 Cartes du joueur',
                value: `${formatHand(game.playerHand)} (Total : **${playerScore}**)`,
                inline: true,
              },
              {
                name: '🤖 Croupier',
                value: `${formatHand(game.dealerHand)} (Total : **${dealerScore}**)`,
                inline: true,
              },
              {
                name: '💳 Solde restant',
                value: `**${finalBalance}** ${EMOJI_COIN}`,
                inline: false,
              },
            )
            .setFooter({
              text: `Partie de ${interaction.user.displayName}`,
              iconURL: interaction.user.displayAvatarURL(),
            });

          await interaction.editReply({
            content:
              '🏁 **Partie terminée !** Le résultat a été publié dans le salon.',
            embeds: [],
            components: [],
          });

          await interaction.channel.send({
            content: `🎰 **Résultat du Blackjack de ${interaction.user}**`,
            embeds: [embed],
          });
        };

        // Action: Doubler la mise (Double Down)
        if (interaction.customId === 'bj_double') {
          const currentBalance = await getBalance(interaction.user.id, pool);
          if (currentBalance < game.bet) {
            return interaction.followUp({
              content: "❌ Tu n'as pas assez de pièces pour doubler ta mise !",
              flags: MessageFlags.Ephemeral,
            });
          }

          await removeBalance(interaction.user.id, game.bet, pool);
          game.bet *= 2;

          game.playerHand.push(drawCard());
          const playerScore = calculateScore(game.playerHand);

          if (playerScore > 21) {
            const dealerScore = calculateScore(game.dealerHand);
            await addToJackpot(Math.floor(game.bet * 0.5), pool);
            await incrementGamesLoose(interaction.user.id, pool);

            const lastCard = game.playerHand[game.playerHand.length - 1];
            return sendFinalResult(
              '💥 Éliminé en doublant ! (Bust)',
              `Tu as tiré un ${lastCard.emoji} et dépassé 21 avec un total de **${playerScore}** !\nTu perds ta mise doublée de **${game.bet}** ${EMOJI_COIN}.`,
              '#FF4D4D',
              playerScore,
              dealerScore,
            );
          }

          let dealerScore = calculateScore(game.dealerHand);
          while (dealerScore < 17) {
            game.dealerHand.push(drawCard());
            dealerScore = calculateScore(game.dealerHand);
          }

          if (dealerScore > 21 || playerScore > dealerScore) {
            const winnings = game.bet * 2;
            await addBalance(
              interaction.user.id,
              winnings,
              pool,
              interaction.user.username,
            );
            await incrementGamesWin(interaction.user.id, pool);

            return sendFinalResult(
              '🎉 Victoire Doublée !',
              `Bravo ! Ton risque a payé, tu remportes **${winnings}** ${EMOJI_COIN} !`,
              '#4CAF50',
              playerScore,
              dealerScore,
            );
          } else if (playerScore === dealerScore) {
            await addBalance(
              interaction.user.id,
              game.bet,
              pool,
              interaction.user.username,
            );
            await incrementGamesTied(interaction.user.id, pool);

            return sendFinalResult(
              '🤝 Égalité !',
              `Égalité ! Ta mise doublée de **${game.bet}** ${EMOJI_COIN} t'est restituée.`,
              '#FFC107',
              playerScore,
              dealerScore,
            );
          } else {
            await addToJackpot(Math.floor(game.bet * 0.5), pool);
            await incrementGamesLoose(interaction.user.id, pool);

            return sendFinalResult(
              '💀 Défaite !',
              `Le croupier gagne avec ${dealerScore}. Tu perds ta mise doublée de **${game.bet}** ${EMOJI_COIN}.`,
              '#FF4D4D',
              playerScore,
              dealerScore,
            );
          }
        }

        // Action: Tirer une carte (Hit)
        if (interaction.customId === 'bj_hit') {
          game.playerHand.push(drawCard());
          const playerScore = calculateScore(game.playerHand);

          if (playerScore > 21) {
            const dealerScore = calculateScore(game.dealerHand);
            await addToJackpot(Math.floor(game.bet * 0.5), pool);
            await incrementGamesLoose(interaction.user.id, pool);

            return sendFinalResult(
              '💥 Éliminé ! (Bust)',
              `Tu as dépassé 21 avec un score de **${playerScore}** !\nTu perds ta mise de **${game.bet}** ${EMOJI_COIN}.`,
              '#FF4D4D',
              playerScore,
              dealerScore,
            );
          }

          const embed = new EmbedBuilder()
            .setTitle('🎰 Table de Blackjack')
            .setColor('#2F3136')
            .addFields(
              {
                name: '🃏 Tes cartes',
                value: `${formatHand(game.playerHand)} (Total : **${playerScore}**)`,
                inline: true,
              },
              {
                name: '🤖 Croupier',
                value: `${game.dealerHand[0].emoji} ${CARD_BACK}`,
                inline: true,
              },
              {
                name: '💰 Mise en jeu',
                value: `**${game.bet}** ${EMOJI_COIN}`,
                inline: false,
              },
            );

          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('bj_hit')
              .setLabel('Tirer 🃏')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('bj_stand')
              .setLabel('Rester 🛑')
              .setStyle(ButtonStyle.Success),
          );

          return interaction.editReply({
            embeds: [embed],
            components: [buttons],
          });
        }

        // Action: Rester (Stand)
        if (interaction.customId === 'bj_stand') {
          let dealerScore = calculateScore(game.dealerHand);

          while (dealerScore < 17) {
            game.dealerHand.push(drawCard());
            dealerScore = calculateScore(game.dealerHand);
          }

          const playerScore = calculateScore(game.playerHand);

          if (dealerScore > 21 || playerScore > dealerScore) {
            const winnings = game.bet * 2;
            await addBalance(
              interaction.user.id,
              winnings,
              pool,
              interaction.user.username,
            );
            await incrementGamesWin(interaction.user.id, pool);

            return sendFinalResult(
              '🎉 Victoire !',
              `Tu remportes la partie et gagne **${winnings}** ${EMOJI_COIN} !`,
              '#4CAF50',
              playerScore,
              dealerScore,
            );
          } else if (playerScore === dealerScore) {
            await addBalance(
              interaction.user.id,
              game.bet,
              pool,
              interaction.user.username,
            );
            await incrementGamesTied(interaction.user.id, pool);

            return sendFinalResult(
              '🤝 Égalité !',
              `Égalité parfaite ! Ta mise de **${game.bet}** ${EMOJI_COIN} t'a été restituée.`,
              '#FFC107',
              playerScore,
              dealerScore,
            );
          } else {
            await addToJackpot(Math.floor(game.bet * 0.5), pool);
            await incrementGamesLoose(interaction.user.id, pool);

            return sendFinalResult(
              '💀 Défaite !',
              `Le croupier l'emporte avec ${dealerScore}. Tu perds ta mise de **${game.bet}** ${EMOJI_COIN}.`,
              '#FF4D4D',
              playerScore,
              dealerScore,
            );
          }
        }
      }
    }

    // --- 4. GESTION DE LA ROULETTE (Menu déroulant) ---
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'roulette_type'
    ) {
      const game = client.tempData.get(`roulette_${interaction.user.id}`);

      if (!game) {
        return interaction.reply({
          content:
            '❌ Aucune partie de roulette active trouvée ou le temps a expiré.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const betType = interaction.values[0];

      if (betType === 'number' && game.chosenNumber === null) {
        return interaction.reply({
          content:
            '❌ Tu dois spécifier le numéro sur lequel tu paries dans la commande : `/roulette mise:<montant> numero:<0-36>` !',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferUpdate();

      await incrementGamesPlayed(
        interaction.user.id,
        pool,
        interaction.user.username,
      );

      await removeBalance(interaction.user.id, game.bet, pool);
      client.tempData.delete(`roulette_${interaction.user.id}`);

      const winningNumber = Math.floor(Math.random() * 37);

      const RED_NUMBERS = [
        1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
      ];

      const isRed = RED_NUMBERS.includes(winningNumber);
      const isZero = winningNumber === 0;

      const colorEmoji = isZero ? '🟢' : isRed ? '🔴' : '⚫';
      const colorName = isZero ? 'Vert' : isRed ? 'Rouge' : 'Noir';

      let multiplier = 0;
      let won = false;
      let betLabel = '';

      switch (betType) {
        case 'red':
          betLabel = 'Couleur Rouge 🔴';
          if (isRed) {
            won = true;
            multiplier = 2;
          }
          break;
        case 'black':
          betLabel = 'Couleur Noire ⚫';
          if (!isRed && !isZero) {
            won = true;
            multiplier = 2;
          }
          break;
        case 'even':
          betLabel = 'Numéro Pair 🔢';
          if (winningNumber % 2 === 0 && !isZero) {
            won = true;
            multiplier = 2;
          }
          break;
        case 'odd':
          betLabel = 'Numéro Impair 🔢';
          if (winningNumber % 2 !== 0) {
            won = true;
            multiplier = 2;
          }
          break;
        case 'low':
          betLabel = 'Manque (1-18) 🔽';
          if (winningNumber >= 1 && winningNumber <= 18) {
            won = true;
            multiplier = 2;
          }
          break;
        case 'high':
          betLabel = 'Passe (19-36) 🔼';
          if (winningNumber >= 19 && winningNumber <= 36) {
            won = true;
            multiplier = 2;
          }
          break;
        case 'number':
          betLabel = `Numéro Plein (${game.chosenNumber}) 🎯`;
          if (winningNumber === game.chosenNumber) {
            won = true;
            multiplier = 36;
          }
          break;
      }

      let resultTitle = '';
      let resultMsg = '';
      let embedColor = '';

      if (won) {
        const winnings = game.bet * multiplier;
        await addBalance(
          interaction.user.id,
          winnings,
          pool,
          interaction.user.username,
        );
        await incrementGamesWin(interaction.user.id, pool);

        resultTitle = '🎉 Gagné !';
        embedColor = '#4CAF50';
        resultMsg = `Félicitations ! Ton pari **${betLabel}** est gagnant ! Tu remportes **${winnings}** ${EMOJI_COIN} !`;
      } else {
        await addToJackpot(Math.floor(game.bet * 0.5), pool);
        await incrementGamesLoose(interaction.user.id, pool);

        resultTitle = '💀 Perdu !';
        embedColor = '#FF4D4D';
        resultMsg = `Dommage ! La bille est tombée sur le mauvais numéro. Tu perds ta mise de **${game.bet}** ${EMOJI_COIN}.`;
      }

      const finalBalance = await getBalance(interaction.user.id, pool);

      const embed = new EmbedBuilder()
        .setTitle(resultTitle)
        .setDescription(resultMsg)
        .setColor(embedColor)
        .addFields(
          {
            name: '🎰 Résultat du tirage',
            value: `${colorEmoji} **${winningNumber}** (${colorName})`,
            inline: true,
          },
          {
            name: '🎯 Ton pari',
            value: `${betLabel} (Mise : **${game.bet}** ${EMOJI_COIN})`,
            inline: true,
          },
          {
            name: '💳 Solde restant',
            value: `**${finalBalance}** ${EMOJI_COIN}`,
            inline: false,
          },
        )
        .setFooter({
          text: `Partie de ${interaction.user.displayName}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        content:
          '🏁 **Tirage effectué !** Le résultat a été publié dans le salon.',
        embeds: [],
        components: [],
      });

      return interaction.channel.send({
        content: `🎡 **Roulette de ${interaction.user}**`,
        embeds: [embed],
      });
    }
  },
};
