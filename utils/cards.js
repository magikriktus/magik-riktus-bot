export const CARD_BACK = '<:carte_dos:1550218531910721626>';

// Deck complet de 52 cartes associées à leurs emojis
export const DECK = [
  // As
  { name: 'A', value: 11, emoji: '<:carte_as_pique:1550218529209319576>' },
  { name: 'A', value: 11, emoji: '<:carte_as_coeur:1550218527644975214>' },
  { name: 'A', value: 11, emoji: '<:carte_as_carreau:1550218526248402984>' },
  { name: 'A', value: 11, emoji: '<:carte_as_trefle:1550218530169954366>' },
  // Rois
  { name: 'K', value: 10, emoji: '<:carte_k_pique:1550218540240609310>' },
  { name: 'K', value: 10, emoji: '<:carte_k_coeur:1550218472095744050>' },
  { name: 'K', value: 10, emoji: '<:carte_k_carreau:1550218538982182972>' },
  { name: 'K', value: 10, emoji: '<:carte_k_trefle:1550218541654089840>' },
  // Dames
  { name: 'Q', value: 10, emoji: '<:carte_q_pique:1550218475211849788>' },
  { name: 'Q', value: 10, emoji: '<:carte_q_coeur:1550218473295061152>' },
  { name: 'Q', value: 10, emoji: '<:carte_q_carreau:1550218542903722057>' },
  { name: 'Q', value: 10, emoji: '<:carte_q_trefle:1550218543880999064>' },
  // Valets
  { name: 'J', value: 10, emoji: '<:carte_j_pique:1550218536163606639>' },
  { name: 'J', value: 10, emoji: '<:carte_j_coeur:1550218535060635849>' },
  { name: 'J', value: 10, emoji: '<:carte_j_carreau:1550218533349363833>' },
  { name: 'J', value: 10, emoji: '<:carte_j_trefle:1550218537786675220>' },
  // 10
  { name: '10', value: 10, emoji: '<:carte_10_pique:1550218522964263072>' },
  { name: '10', value: 10, emoji: '<:carte_10_coeur:1550218521051402281>' },
  { name: '10', value: 10, emoji: '<:carte_10_carreau:1550218519860224160>' },
  { name: '10', value: 10, emoji: '<:carte_10_trefle:1550218524880928910>' },
  // 9
  { name: '9', value: 9, emoji: '<:carte_9_pique:1550218517159219240>' },
  { name: '9', value: 9, emoji: '<:carte_9_coeur:1550218470766018601>' },
  { name: '9', value: 9, emoji: '<:carte_9_carreau:1550218515930423356>' },
  { name: '9', value: 9, emoji: '<:carte_9_trefle:1550218518635610193>' },
  // 8
  { name: '8', value: 8, emoji: '<:carte_8_pique:1550218513380155393>' },
  { name: '8', value: 8, emoji: '<:carte_8_coeur:1550218512058941511>' },
  { name: '8', value: 8, emoji: '<:carte_8_carreau:1550218510460919848>' },
  { name: '8', value: 8, emoji: '<:carte_8_trefle:1550218514676060201>' },
  // 7
  { name: '7', value: 7, emoji: '<:carte_7_pique:1550218507629895690>' },
  { name: '7', value: 7, emoji: '<:carte_7_coeur:1550218505876672674>' },
  { name: '7', value: 7, emoji: '<:carte_7_carreau:1550218503842300068>' },
  { name: '7', value: 7, emoji: '<:carte_7_trefle:1550218509135384676>' },
  // 6
  { name: '6', value: 6, emoji: '<:carte_6_pique:1550218501157822575>' },
  { name: '6', value: 6, emoji: '<:carte_6_coeur:1550218499731755048>' },
  { name: '6', value: 6, emoji: '<:carte_6_carreau:1550218498444099674>' },
  { name: '6', value: 6, emoji: '<:carte_6_trefle:1550218502349127811>' },
  // 5
  { name: '5', value: 5, emoji: '<:carte_5_pique:1550218495868928152>' },
  { name: '5', value: 5, emoji: '<:carte_5_coeur:1550218494526754837>' },
  { name: '5', value: 5, emoji: '<:carte_5_carreau:1550218492878262342>' },
  { name: '5', value: 5, emoji: '<:carte_5_trefle:1550218497185816596>' },
  // 4
  { name: '4', value: 4, emoji: '<:carte_4_pique:1550218490256826389>' },
  { name: '4', value: 4, emoji: '<:carte_4_coeur:1550218488818434208>' },
  { name: '4', value: 4, emoji: '<:carte_4_carreau:1550218487639707779>' },
  { name: '4', value: 4, emoji: '<:carte_4_trefle:1550218491519312053>' },
  // 3
  { name: '3', value: 3, emoji: '<:carte_3_pique:1550218485194293368>' },
  { name: '3', value: 3, emoji: '<:carte_3_coeur:1550218483915292692>' },
  { name: '3', value: 3, emoji: '<:carte_3_carreau:1550218482358952006>' },
  { name: '3', value: 3, emoji: '<:carte_3_trefle:1550218486532538368>' },
  // 2
  { name: '2', value: 2, emoji: '<:carte_2_pique:1550218479599226970>' },
  { name: '2', value: 2, emoji: '<:carte_2_coeur:1550218478063984762>' },
  { name: '2', value: 2, emoji: '<:carte_2_carreau:1550218476889837748>' },
  { name: '2', value: 2, emoji: '<:carte_2_trefle:1550218481008644196>' },
];

export function drawCard() {
  return DECK[Math.floor(Math.random() * DECK.length)];
}

export function calculateScore(cards) {
  let score = cards.reduce((sum, card) => sum + card.value, 0);
  let aces = cards.filter((card) => card.name === 'A').length;

  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

export function formatHand(cards) {
  return cards.map((c) => c.emoji).join(' ');
}
