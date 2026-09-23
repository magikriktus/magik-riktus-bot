/**
 * Table de correspondance entre ID de rôle, nom, emoji et type
 */
export const ROLE_EMOJIS = {
  // --- MÉTIERS (Emojis d'application Bot) ---
  '1404225438448091157': {
    name: 'Chasseur',
    emoji: '<:chasseur:1549836813718523904>',
    type: 'job',
  },
  '1404225177084100719': {
    name: 'Alchimiste',
    emoji: '<:alchimiste:1549836807040934041>',
    type: 'job',
  },
  '1404226535631884451': {
    name: 'Paysan',
    emoji: '<:paysan:1549836829870792846>',
    type: 'job',
  },
  '1404225327021953086': {
    name: 'Bûcheron',
    emoji: '<:bucheron:1549836812212764814>',
    type: 'job',
  },
  '1404225479073992896': {
    name: 'Pêcheur',
    emoji: '<:pecheur:1549836831649169569>',
    type: 'job',
  },
  '1404226095695401082': {
    name: 'Mineur',
    emoji: '<:mineur:1549836828675281017>',
    type: 'job',
  },
  '1404225545771679916': {
    name: 'Bricoleur',
    emoji: '<:bricoleur:1549836810140520509>',
    type: 'job',
  },
  '1404225645516423250': {
    name: 'Tailleur',
    emoji: '<:tailleur:1549836835549610136>',
    type: 'job',
  },
  1404226053035131100: {
    name: 'Cordonnier',
    emoji: '<:cordonnier:1549836816922706091>',
    type: 'job',
  },
  '1404225885732737135': {
    name: 'Bijoutier',
    emoji: '<:bijoutier:1549836808940945418>',
    type: 'job',
  },
  '1404225854812455044': {
    name: 'Façonneur',
    emoji: '<:faconneur:1549836822601932870>',
    type: 'job',
  },
  '1404226001642323968': {
    name: 'Forgeron',
    emoji: '<:forgeron:1549836826213097473>',
    type: 'job',
  },
  '1404225935460401214': {
    name: 'Sculpteur',
    emoji: '<:sculpteur:1549836834295648266>',
    type: 'job',
  },
  '1492881166020120586': {
    name: 'Éleveur',
    emoji: '<:eleveur:1549836819946930207>',
    type: 'job',
  },
  '1404225727842357481': {
    name: 'Costumage',
    emoji: '<:costumage:1549836818462015598>',
    type: 'job',
  },
  '1404225684024459344': {
    name: 'Cordomage',
    emoji: '<:cordomage:1549836815572410570>',
    type: 'job',
  },
  '1404226295046606940': {
    name: 'Joaillomage',
    emoji: '<:joaillomage:1549836827442159676>',
    type: 'job',
  },
  '1404225772008378452': {
    name: 'Façomage',
    emoji: '<:facomage:1549836821251362907>',
    type: 'job',
  },
  '1404226140759130254': {
    name: 'Forgemage',
    emoji: '<:forgemage:1549836824715985056>',
    type: 'job',
  },
  '1404226241447333888': {
    name: 'Sculptemage',
    emoji: '<:sculptemage:1549836832903135353>',
    type: 'job',
  },

  // --- CLASSES (Emojis Custom Discord Serveur) ---
  '1439029282369441935': { name: 'Féca', emoji: 'feca', type: 'class' },
  '1439029381740888065': { name: 'Osamodas', emoji: 'osa', type: 'class' },
  '1439029423042068640': { name: 'Énutrof', emoji: 'enu', type: 'class' },
  '1439029488796172339': { name: 'Sram', emoji: 'sram', type: 'class' },
  '1439029522384162868': { name: 'Xélor', emoji: 'xel', type: 'class' },
  '1439029548355158108': { name: 'Écaflip', emoji: 'eca', type: 'class' },
  '1439029614960709753': { name: 'Éniripsa', emoji: 'eni', type: 'class' },
  '1439029662335631450': { name: 'Iop', emoji: 'iop', type: 'class' },
  '1439029697424920627': { name: 'Crâ', emoji: 'cra', type: 'class' },
  '1439029723031277588': { name: 'Sadida', emoji: 'sadi', type: 'class' },
  '1439029754874429661': { name: 'Sacrieur', emoji: 'sacri', type: 'class' },
  '1439029778228183151': { name: 'Pandawa', emoji: 'panda', type: 'class' },
  '1439029819655327846': { name: 'Roublard', emoji: 'roub', type: 'class' },
  '1439029849703317664': { name: 'Zobal', emoji: 'zobal', type: 'class' },
  '1439029874517082133': { name: 'Steamer', emoji: 'steam', type: 'class' },
  '1439029899531780237': { name: 'Éliotrope', emoji: 'elio', type: 'class' },
  '1439029924995272714': { name: 'Huppermage', emoji: 'hupper', type: 'class' },
  '1439029958209962034': { name: 'Ouginak', emoji: 'ougi', type: 'class' },
  '1439029993857482784': { name: 'Forgelance', emoji: 'forge', type: 'class' },
};

/**
 * Extrait les emojis correspondant aux rôles d'un membre
 * @param {import('discord.js').GuildMember} member
 * @returns {{ classes: string[], jobs: string[], all: string[] }}
 */
export function getUserRoleEmojis(member) {
  if (!member || !member.roles) return { classes: [], jobs: [], all: [] };

  const classes = [];
  const jobs = [];

  for (const [roleId, config] of Object.entries(ROLE_EMOJIS)) {
    if (member.roles.cache.has(roleId)) {
      let emojiStr = config.emoji;

      if (config.type === 'class') {
        const customEmoji = member.guild?.emojis.cache.find(
          (e) => e.name === config.emoji,
        );
        emojiStr = customEmoji ? customEmoji.toString() : `:${config.emoji}:`;
        classes.push(emojiStr);
      } else {
        jobs.push(emojiStr);
      }
    }
  }

  return {
    classes,
    jobs,
    all: [...classes, ...jobs],
  };
}
