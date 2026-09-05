export const DESIGNED_LANES = [
  { id: 'WU', guild: 'Azorius', name: 'Blink', themes: ['blink'], plan: 'Reuse enter-the-battlefield rewards with exile-and-return effects.', note: 'Intentional blink only. Reanimation, graveyard casting and landfall are separate.', examples: ['Brago, King Eternal', 'Overlord of the Mistmoors', 'Phelia, Exuberant Shepherd'] },
  { id: 'UB', guild: 'Dimir', name: 'Theft', themes: ['opponent-cards', 'theft'], note: 'Theft effects can win on their own. Zero separate theft-reward cards does not mean this deck lacks a finish; its theft engines are classified as enablers.', plan: 'Disrupt their plan, then turn their cards into your advantage.', examples: ['Thief of Sanity', 'Fallen Shinobi', 'Extract Brain'] },
  { id: 'BR', guild: 'Rakdos', name: 'Artifact sacrifice', themes: ['artifacts'], plan: 'Feed artifacts to sacrifice engines and turn them into damage or value.', note: 'Payoffs are the artifact rewards that mention sacrifice, death or leaving play, plus Weapons Manufacturing. Generic artifact rewards are not counted.', examples: ['Weapons Manufacturing', 'Marionette Master', 'Oni-Cult Anvil'] },
  { id: 'RG', guild: 'Gruul', name: 'Power 4+', themes: ['power-four'], plan: 'Establish four power early, then collect the rewards. Ramp supports the bigger finish.', note: 'Enablers here are early four-power inputs at mana value 3 or less, not every large creature. Off-color bodies cannot repair a missing Gruul core.', examples: ['Garruk\'s Uprising', 'Temur Battle Rage', 'Roxanne, Starfall Savant'] },
  { id: 'GW', guild: 'Selesnya', name: 'Counters + go wide', themes: ['pp-counters', 'tokens'], plan: 'Build a board, add counters, then turn many bodies into a finish.', note: 'Two related themes; an input for one is not automatically an input for the other.', examples: ['Bristly Bill, Spine Sower', 'Elspeth, Storm Slayer', 'Wakka, Devoted Guardian'] },
  { id: 'WB', guild: 'Orzhov', name: 'Aristocrats', themes: ['dies'], plan: 'Attack with expendable bodies and profit when they die.', examples: ['Assault Intercessor', 'Sephiroth, Fabled SOLDIER', 'Lingering Souls'] },
  { id: 'UR', guild: 'Izzet', name: 'Noncombat damage', themes: ['noncombat-damage'], plan: 'Turn small damage triggers into a lethal chain with damage rewards.', examples: ['Ghyrson Starn, Kelermorph', 'Vivi Ornitier', 'Solphim, Mayhem Dominus'] },
  { id: 'BG', guild: 'Golgari', name: 'Delirium', themes: ['graveyard-types'], plan: 'Put different card types in your graveyard to unlock stronger effects.', note: 'Delirium support is measured here. Reanimation remains available among other detected themes.', examples: ['Winter, Cynical Opportunist', 'Demolisher Spawn', 'Satyr Wayfinder'] },
  { id: 'WR', guild: 'Boros', name: 'Humans', themes: ['humans'], plan: 'Build a Human army, grow it, and attack before opponents stabilize.', examples: ['Thalia\'s Lieutenant', 'Winota, Joiner of Forces', 'Lightning, Army of One'] },
  { id: 'UG', guild: 'Simic', name: '+1/+1 counters', themes: ['pp-counters'], plan: 'Grow efficient creatures while ramp and card draw keep you ahead.', examples: ['Bristly Bill, Spine Sower', 'Arwen, Weaver of Hope', 'Nadu, Winged Wisdom'] },
];

export function fitsPair(card, pair, includeColorless = true) {
  return card.colors.length ? card.colors.every(color => pair.includes(color)) : includeColorless;
}

export function laneRoles(card, lane) {
  return [...new Set((card.archetypeRoles || []).filter(role => {
    if (!lane.themes.includes(role.archetypeId) || !['payoffs', 'enablers'].includes(role.role)) return false;
    if (lane.id === 'BR' && role.role === 'payoffs') {
      return card.name === 'Weapons Manufacturing' || /sacrific|\bdies?\b|graveyard from the battlefield|leaves? the battlefield/i.test(card.oracleText || '');
    }
    return true;
  }).map(role => role.role))];
}

export function summarizeLane(cards, lane, scope = 'pair', includeColorless = true) {
  const main = cards.filter(card => card.board === 'mainboard');
  const eligible = card => {
    const within = fitsPair(card, lane.id, includeColorless);
    if (!includeColorless && !card.colors.length) return false;
    return scope === 'all' || (scope === 'outside' ? !fitsPair(card, lane.id, true) : within);
  };
  const pools = { payoffs: [], enablers: [], both: [], payoffOnly: [], enablerOnly: [], union: [] };
  for (const card of main) {
    if (!eligible(card)) continue;
    const roles = laneRoles(card, lane);
    if (!roles.length) continue;
    pools.union.push(card.id);
    for (const role of roles) pools[role].push(card.id);
    pools[roles.length === 2 ? 'both' : roles[0] === 'payoffs' ? 'payoffOnly' : 'enablerOnly'].push(card.id);
  }
  const byId = new Map(main.map(card => [card.id, card]));
  const spells = pools.union.map(id => byId.get(id)).filter(card => !card.isLand && !/\bLand\b/.test(card.type));
  const creatures = spells.filter(card => /\bCreature\b/.test(card.type)).length;
  const colors = Object.fromEntries([...(scope === 'pair' ? lane.id : 'WUBRG'), 'C'].map(color => [color, {
    payoffs: pools.payoffs.filter(id => color === 'C' ? !byId.get(id).colors.length : byId.get(id).colors.includes(color)).length,
    enablers: pools.enablers.filter(id => color === 'C' ? !byId.get(id).colors.length : byId.get(id).colors.includes(color)).length,
  }]));
  const pairPool = main.filter(card => fitsPair(card, lane.id, includeColorless)).length;
  return { ...pools, creatures, noncreatures: spells.length - creatures, lands: pools.union.length - spells.length,
    curve: [0, 1, 2, 3, 4, 5, 6].map(mv => spells.filter(card => mv === 6 ? card.cmc >= 6 : card.cmc === mv).length),
    colors, pairPool, scope, includeColorless };
}

export function buildDesignedModel(data) {
  const cards = data.cards.filter(card => card.board === 'mainboard');
  const lanes = DESIGNED_LANES.map(lane => ({ ...lane, colors: lane.id.split(''), pair: summarizeLane(cards, lane),
    outside: summarizeLane(cards, lane, 'outside') }));
  const overlap = lanes.map(a => lanes.map(b => a.pair.union.filter(id => b.pair.union.includes(id))));
  return { lanes, overlap, version: data.cube.version, source: 'Cube Cobra designed pairs; Gruul updated by Oscar. Role membership comes from strict rules, not observed win rates.' };
}
