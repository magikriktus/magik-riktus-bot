import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup-welcome')
  .setDescription("Déploie le message d'accueil avec le bouton de présentation")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Bienvenue sur le serveur !')
    .setDescription(
      'Clique sur le bouton ci-dessous pour remplir ta présentation et accéder au serveur.',
    )
    .setColor('#165416');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('welcome_present_btn')
      .setLabel('Remplir ma présentation')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📝'),
  );

  // On répond d'abord à l'interaction pour éviter le délai d'expiration de 3s
  await interaction.reply({
    content: "✅ Message d'accueil déployé !",
    flags: MessageFlags.Ephemeral,
  });

  // Puis on envoie le message public dans le salon
  await interaction.channel.send({ embeds: [embed], components: [row] });
}
