// Stable semantic fixtures. These are intentionally independent of the live cube so
// a list change cannot silently weaken a taxonomy regression assertion.
export const absentCardFixtures = [
  {
    cardID: 'fixture-everything-pizza', index: 1,
    details: {
      name: 'Everything Pizza', type: 'Artifact — Food', cmc: 2,
      color_identity: ['W', 'U', 'B', 'R', 'G'], keywords: [],
      oracle_text: 'When this artifact enters, search your library for a basic land card, reveal it, put it into your hand, then shuffle.\n{2}{W}{U}{B}{R}{G}, {T}, Sacrifice this artifact: Target player gains 3 life and draws a card. Each of your opponents discards a card. This artifact deals 3 damage to any target. Put three +1/+1 counters on up to one target creature.',
      oracle_tags: ['sacrifice-outlet-artifact', 'sacrifice-outlet', 'synergy-artifact'],
    },
  },
  {
    cardID: 'fixture-goblin-engineer', index: 2,
    details: {
      name: 'Goblin Engineer', type: 'Creature — Goblin Artificer', cmc: 2,
      color_identity: ['R'], power: '1', toughness: '2', keywords: [],
      oracle_text: 'When this creature enters, you may search your library for an artifact card, put it into your graveyard, then shuffle.\n{R}, {T}, Sacrifice an artifact: Return target artifact card with mana value 3 or less from your graveyard to the battlefield.',
      oracle_tags: ['reanimate-artifact', 'recursion-artifact', 'sacrifice-outlet-artifact', 'synergy-artifact'],
    },
  },
  {
    cardID: 'fixture-hellrider', index: 3,
    details: {
      name: 'Hellrider', type: 'Creature — Devil', cmc: 4,
      color_identity: ['R'], power: '3', toughness: '3', keywords: ['Haste'],
      oracle_text: "Haste\nWhenever a creature you control attacks, this creature deals 1 damage to the player or planeswalker it's attacking.",
      oracle_tags: ['attack-trigger', 'attacking-matters'],
    },
  },
  {
    cardID: 'fixture-reckoners-bargain', index: 4,
    details: {
      name: "Reckoner's Bargain", type: 'Instant', cmc: 2,
      color_identity: ['B'], keywords: [],
      oracle_text: "As an additional cost to cast this spell, sacrifice an artifact or creature.\nYou gain life equal to the sacrificed permanent's mana value. Draw two cards.",
      oracle_tags: ['sacrifice-outlet-artifact', 'sacrifice-outlet', 'synergy-artifact'],
    },
  },
];

export const blinkBoundaryFixtures = [
  {
    cardID: 'fixture-opponent-entry', index: 10,
    details: { name: 'Opponent Entry', type: 'Creature — Human Advisor', oracle_text: "Whenever a creature enters under an opponent's control, scry 1.", color_identity: ['W'], power: '2', toughness: '2' },
  },
  {
    cardID: 'fixture-land-entry', index: 11,
    details: { name: 'Land Entry', type: 'Creature — Elemental', oracle_text: 'Whenever a land you control enters, draw a card.', color_identity: ['G'], power: '2', toughness: '2' },
  },
  {
    cardID: 'fixture-cast-entry', index: 12,
    details: { name: 'Cast Entry', type: 'Creature — Wizard', oracle_text: 'Whenever you cast a creature spell, draw a card.', color_identity: ['U'], power: '2', toughness: '2' },
  },
  {
    cardID: 'fixture-own-entry', index: 13,
    details: { name: 'Own Entry', type: 'Creature — Vampire', oracle_text: 'Whenever one or more other creatures with power 2 or less enter under your control, draw a card.', color_identity: ['W'], power: '2', toughness: '2' },
  },
  {
    cardID: 'fixture-flicker', index: 14,
    details: { name: 'Intentional Flicker', type: 'Instant', oracle_text: 'Exile target creature you control, then return that card to the battlefield under its owner\'s control.', color_identity: ['W'] },
  },
  {
    cardID: 'fixture-reanimate', index: 15,
    details: { name: 'Only Reanimate', type: 'Sorcery', oracle_text: 'Return target creature card from your graveyard to the battlefield.', color_identity: ['B'] },
  },
  {
    cardID: 'fixture-copy', index: 16,
    details: { name: 'Only Copy', type: 'Sorcery', oracle_text: "Create a token that's a copy of target creature you control.", color_identity: ['R'] },
  },
  {
    cardID: 'fixture-bounce', index: 17,
    details: { name: 'Only Bounce', type: 'Instant', oracle_text: "Return target creature you control to its owner's hand.", color_identity: ['U'] },
  },
];
