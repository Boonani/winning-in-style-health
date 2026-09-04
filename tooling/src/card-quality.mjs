import { hasTag, isPermanent } from './taxonomy.mjs';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const unique = (values) => [...new Set(values.filter(Boolean))];

const isInstant = (card) => /\bInstant\b/i.test(card.type);
const isSorcery = (card) => /\bSorcery\b/i.test(card.type);
const isCreature = (card) => /\bCreature\b/i.test(card.type);
const hasFlash = (card) =>
  card.keywords.includes('Flash') ||
  /^Flash\b/im.test(card.oracleText) ||
  hasTag(card, 'flash');

const isRemoval = (card) =>
  hasTag(card, 'removal', 'spot-removal', 'removal-*', 'counterspell*') ||
  /(?:destroy|exile|counter) target/i.test(card.oracleText);
const isSweeper = (card) =>
  hasTag(card, 'sweeper', 'board-wipe') ||
  /(?:destroy|exile) all (?:artifacts|creatures|nonland permanents|permanents)/i.test(card.oracleText);
const isDraw = (card) => hasTag(card, 'draw', 'pure-draw', 'card-advantage', 'cantrip', 'draw-engine', 'repeatable-draw');
const isRepeatableAdvantage = (card) => hasTag(card, 'repeatable-card-advantage', 'repeatable-draw', 'draw-engine');
const isModal = (card) => hasTag(card, 'modal', 'charm') || /choose (?:one|two|three)/i.test(card.oracleText);
const makesMultipleBodies = (card) => hasTag(card, 'multiple-bodies', 'repeatable-creature-tokens', 'repeatable-token-generator');
const isProtection = (card) => hasTag(card, 'protects-creature', 'protection', 'indestructible-granter', 'hexproof-granter');
const isPump = (card) =>
  hasTag(card, 'combat-trick', 'pump', 'gives-pp-counters', 'power-boost', 'double-strike-granter') ||
  /gets? \+[X0-9*]+\/\+[X0-9*]+/i.test(card.oracleText);
const isTempoInteraction = (card) => isRemoval(card) || hasTag(card, 'bounce', 'tap-down', 'fight', 'burn', 'removal-bounce');
const isFixingLand = (card) => card.isLand && (card.colors.length > 1 || hasTag(card, 'mana-fixing', 'dual-land', 'fetchland'));

function explicitDrawCount(card) {
  const matches = [...card.oracleText.matchAll(/draw (a|one|two|three|four|five|six|seven|\d+) cards?/gi)];
  const values = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  return matches.reduce((max, match) => Math.max(max, Number(match[1]) || values[match[1].toLowerCase()] || 0), 0);
}

function advantageEstimate(card) {
  const permanent = isPermanent(card) && !card.isLand;
  const drawCount = explicitDrawCount(card);
  let average = 0;
  let best = 0;
  const evidence = [];

  if (isSweeper(card)) {
    average = Math.max(average, 1);
    best = Math.max(best, 4);
    evidence.push('mass removal');
  } else if (isRemoval(card)) {
    average = Math.max(average, permanent ? 1 : 0);
    best = Math.max(best, permanent ? 1 : 0);
    evidence.push(permanent ? 'interaction attached to a permanent' : 'one-for-one interaction');
  }

  if (drawCount > 0) {
    const netDraw = permanent ? drawCount : Math.max(0, drawCount - 1);
    average = Math.max(average, Math.min(3, netDraw));
    best = Math.max(best, Math.min(4, netDraw));
    evidence.push(drawCount === 1 ? 'replaces itself' : `draws up to ${drawCount} cards`);
  } else if (hasTag(card, 'cantrip')) {
    average = Math.max(average, permanent ? 1 : 0);
    best = Math.max(best, permanent ? 1 : 0);
    evidence.push('cantrip');
  }

  if (isRepeatableAdvantage(card)) {
    average = Math.max(average, 2);
    best = Math.max(best, 4);
    evidence.push('repeatable card advantage');
  }
  if (makesMultipleBodies(card)) {
    average = Math.max(average, 1);
    best = Math.max(best, 2);
    evidence.push('multiple bodies');
  }
  if (hasTag(card, 'multi-removal', 'two-for-one', 'three-for-one')) {
    const consumesAnotherPermanent = /then sacrifice it|sacrifice (?:a|another|that) (?:creature|permanent|artifact)/i.test(card.oracleText);
    average = Math.max(average, consumesAnotherPermanent ? 0 : 1);
    best = Math.max(best, consumesAnotherPermanent ? 1 : 2);
    evidence.push('multiple targets or effects');
  }
  if (hasTag(card, 'discard-opponent-multiple', 'mass-discard', 'recursion-multiple')) {
    average = Math.max(average, 1);
    best = Math.max(best, 3);
    evidence.push('multiple-card exchange');
  }
  if (isModal(card) && /choose two/i.test(card.oracleText)) {
    best = Math.max(best, 1);
    evidence.push('two-mode flexibility');
  }

  average = clamp(Math.round(average), -1, 4);
  best = clamp(Math.max(average, Math.round(best)), -1, 4);
  return { average, best, evidence: unique(evidence) };
}

function dependencyEstimate(card) {
  let score = 0;
  const reasons = [];
  if (card.oracleTags.some((tag) => tag.startsWith('typal-'))) {
    score += 2;
    reasons.push('needs a creature type concentration');
  }
  if (card.oracleTags.some((tag) => tag.startsWith('synergy-') || tag.endsWith('-matters'))) {
    score += 1;
    reasons.push('rewards a specific deck resource');
  }
  if (hasTag(card, 'build-around', 'build-around-me', 'parasitic', 'commander')) {
    score += 2;
    reasons.push('build-around text');
  }
  if (/for each (?:artifact|enchantment|creature card|card type)|if you control (?:three|four|five|six|an artifact|an enchantment)/i.test(card.oracleText)) {
    score += 1;
    reasons.push('board-state requirement');
  }
  return { score: clamp(score, 0, 4), reasons: unique(reasons) };
}

function combatEstimate(card) {
  const instant = isInstant(card);
  const flash = hasFlash(card);
  if (!instant && !flash) {
    return { speed: 'Sorcery speed', combatSpeed: false, role: 'Not a combat-speed card', effectiveness: 'None', score: 0 };
  }

  let score = 1;
  const roles = [];
  if (isTempoInteraction(card)) {
    score += 2;
    roles.push('removal or tempo interaction');
  }
  if (isPump(card)) {
    score += 2;
    roles.push('changes combat math');
  }
  if (isProtection(card)) {
    score += 2;
    roles.push('protects a combatant');
  }
  if (flash && isCreature(card)) {
    score += 1;
    roles.push('flash blocker');
  }
  if (makesMultipleBodies(card)) {
    score += 1;
    roles.push('adds blockers or attackers');
  }
  const effectiveness = score >= 5 ? 'High' : score >= 3 ? 'Medium' : 'Low';
  return {
    speed: instant ? 'Instant' : 'Flash',
    combatSpeed: true,
    role: roles.length ? unique(roles).join('; ') : 'combat-window utility or bluff',
    effectiveness,
    score: clamp(score, 0, 6),
  };
}

function averageCaseText(card, advantage, combat) {
  if (isRepeatableAdvantage(card)) return 'If it survives or you can keep paying its cost, it should produce multiple extra cards; the average falls sharply when answered immediately.';
  if (isSweeper(card)) return 'Usually trades for more than one opposing permanent, but your own permanents and awkward board states reduce the net gain.';
  if (advantage.average >= 2) return 'Normally produces multiple pieces of material or cards without needing a narrow partner.';
  if (advantage.average === 1) return 'Normally leaves you about one material resource ahead after accounting for the card spent.';
  if (isRemoval(card)) return 'Usually trades one card for one opposing card. Its strength comes from mana efficiency, target quality, and timing rather than raw card advantage.';
  if (combat.combatSpeed) return 'Usually offers instant-speed flexibility; its material exchange is neutral unless the combat situation creates an extra trade.';
  if (card.isLand) return 'Normally supplies mana rather than card advantage; fixing, speed, and utility determine its standalone quality.';
  return 'Usually converts one card into one lasting effect or permanent. Its value depends on rate, resilience, and matchup.';
}

function bestCaseText(card, advantage, combat) {
  if (isSweeper(card)) return 'Its ceiling is a one-sided or nearly one-sided wipe: trading one card for four or more opposing permanents (+4 or better).';
  if (isRepeatableAdvantage(card)) return 'Left unanswered, repeated activations or triggers can generate four or more extra cards and take over the game.';
  if (hasTag(card, 'multi-removal') || (isModal(card) && /choose two/i.test(card.oracleText))) return 'The best modes or targets create a two-for-one, or combine a neutral exchange with a decisive combat or tempo swing.';
  if (advantage.best >= 2) return `The ceiling is roughly +${advantage.best} material when every component produces a relevant resource.`;
  if (advantage.best === 1) return 'At its ceiling it leaves a relevant permanent or extra card after performing its main job, about +1 material.';
  if (isRemoval(card)) return 'The ceiling is still card-neutral, but removing a much more expensive or irreplaceable threat can produce a major mana and tempo win.';
  if (combat.combatSpeed) return 'The ceiling comes from perfect timing: changing combat, protecting a threat, or forcing the opponent to spend mana inefficiently.';
  if (card.isLand) return 'Its ceiling is excellent fixing or a useful spell-like activation without occupying a nonland slot.';
  return 'The ceiling is its printed effect at full relevance, with any synergy text active and no meaningful drawback.';
}

export function classifyCardQuality(cards) {
  const rankedElos = cards.map((card) => Number(card.elo)).filter(Number.isFinite).sort((a, b) => a - b);
  const eloPercentile = (elo) => {
    if (!Number.isFinite(Number(elo)) || rankedElos.length < 2) return 0.5;
    let low = 0;
    let high = rankedElos.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (rankedElos[middle] <= Number(elo)) low = middle + 1;
      else high = middle;
    }
    return low / rankedElos.length;
  };

  return new Map(cards.map((card) => {
    const advantage = advantageEstimate(card);
    const dependency = dependencyEstimate(card);
    const combat = combatEstimate(card);
    const percentile = eloPercentile(card.elo);
    const cheapInteraction = isRemoval(card) ? (card.cmc <= 1 ? 14 : card.cmc <= 2 ? 11 : card.cmc <= 3 ? 7 : 2) : 0;
    const flexible = isModal(card) ? 7 : 0;
    const instantValue = combat.combatSpeed ? 4 : 0;
    const fixing = isFixingLand(card) ? 7 : 0;
    const mechanicalScore = clamp(Math.round(
      51 + advantage.average * 7 + advantage.best * 2 + cheapInteraction + flexible + instantValue + fixing - dependency.score * 7,
    ), 0, 100);
    const score = clamp(Math.round(
      34 + percentile * 34 + advantage.average * 7 + advantage.best * 2 + cheapInteraction + flexible + instantValue + fixing - dependency.score * 7,
    ), 0, 100);
    const standaloneTier = score >= 84 ? 'Premium' : score >= 72 ? 'Strong' : score >= 58 ? 'Solid' : score >= 44 ? 'Role-player' : 'Synergy piece';
    const synergyNeed = dependency.score >= 3 ? 'High' : dependency.score >= 1 ? 'Medium' : 'Low';
    const mechanicalGoodOnOwn = synergyNeed !== 'High' && (
      mechanicalScore >= 68 || advantage.average >= 1 || cheapInteraction >= 11 || isSweeper(card) || isFixingLand(card)
    );
    const strengths = unique([
      advantage.average >= 1 && `about +${advantage.average} average material`,
      advantage.best >= 3 && `ceiling of +${advantage.best} material`,
      cheapInteraction >= 11 && 'very mana-efficient interaction',
      flexible && 'multiple useful modes',
      combat.effectiveness === 'High' && 'high-impact at combat speed',
      combat.effectiveness === 'Medium' && 'meaningful combat-speed option',
      isFixingLand(card) && 'mana fixing',
      percentile >= 0.85 && 'high CubeCobra community ELO',
    ]);
    const caveats = unique([
      ...dependency.reasons,
      isSweeper(card) && 'net advantage depends on how many of your own permanents die',
      isRepeatableAdvantage(card) && 'must survive or be activated repeatedly',
      card.cmc >= 6 && !card.isLand && 'high mana commitment',
    ]);
    const goodOnOwn = synergyNeed !== 'High' && (
      score >= 68 || advantage.average >= 1 || cheapInteraction >= 11 || isSweeper(card) || isFixingLand(card)
    );
    const quality = {
      score,
      mechanicalScore,
      standaloneTier,
      goodOnOwn,
      mechanicalGoodOnOwn,
      synergyNeed,
      averageAdvantage: advantage.average,
      bestAdvantage: advantage.best,
      advantageLabel: advantage.average > 0 ? `+${advantage.average}` : String(advantage.average),
      bestAdvantageLabel: advantage.best >= 4 ? '+4 or more' : advantage.best > 0 ? `+${advantage.best}` : String(advantage.best),
      advantageEvidence: advantage.evidence,
      averageCase: averageCaseText(card, advantage, combat),
      bestCase: bestCaseText(card, advantage, combat),
      speed: combat.speed,
      combatSpeed: combat.combatSpeed,
      combatRole: combat.role,
      combatEffectiveness: combat.effectiveness,
      strengths,
      caveats,
      elo: Math.round(Number(card.elo) || 0),
      eloPercentile: Math.round(percentile * 100),
      model: 'Heuristic estimate from rules text, Scryfall tags, mana value, and CubeCobra community ELO; mechanicalScore fixes ELO at the median for maturity-safe review.',
    };
    return [`${card.board}:${card.index}`, quality];
  }));
}
