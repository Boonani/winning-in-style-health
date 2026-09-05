import { aristocratsFodder, creatureSacrificeOutlet, creatureDeathReward, earlyPowerInput, earlyScalingPower } from './strategic-support.mjs';

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];

const CUBE_RULES_OVERRIDES = new Map([
  ['Agent of the Iron Throne', 'Whenever an artifact or creature you control is put into a graveyard from the battlefield, each opponent loses 1 life.'],
  ['Arcane Signet', '{T}: Add one mana of any color.'],
  ['Path of Ancestry', 'This land enters tapped.\n{T}: Add one mana of any color.'],
]);

export const playableIn = (card, colors) => card.colors.every((color) => colors.includes(color));
export const isType = (card, type) => new RegExp(`\\b${type}\\b`, 'i').test(card.type);
export const isPermanent = (card) => /Artifact|Battle|Creature|Enchantment|Land|Planeswalker/i.test(card.type);
export const isCreature = (card) => isType(card, 'Creature');
export const numericPower = (card) => (/^-?\d+$/.test(card.power) ? Number(card.power) : null);
export const hasTag = (card, ...patterns) => patterns.some((pattern) => {
  if (!pattern.includes('*')) return card.oracleTags.includes(pattern);
  const prefix = pattern.slice(0, pattern.indexOf('*'));
  return card.oracleTags.some((tag) => tag.startsWith(prefix));
});

const oracle = (card) => card.oracleText
  .replace(/\([^()]*\)/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const textMatches = (card, pattern) => pattern.test(oracle(card));
const matchingClause = (card, pattern) => {
  const match = oracle(card).match(pattern);
  return match ? match[0].trim() : '';
};
const explicitReason = (card, pattern) => {
  const clause = matchingClause(card, pattern);
  return clause ? `Explicit rules text: "${clause}"` : 'Explicit rules text matches the strict rule.';
};
const tagged = (card, tags) => tags.some((tag) => card.oracleTags.includes(tag));

const strictRole = (label, ruleId, test, evidence, liveTag = null) => ({
  label,
  ruleId,
  test,
  evidence,
  liveTag: liveTag ?? `Strict: ${label}`,
});
const noRole = (label, ruleId) => strictRole(label, ruleId, () => false, () => 'No generic glue is assigned.');

const artifactTokenPattern = /create [^.]{0,100}(?:artifact|treasure|clue|food|blood|junk|map|gold) tokens?/i;
const artifactPayoffPattern = /(?:when|whenever) [^.\n]{0,120}artifact you control [^.\n]{0,100}(?:enters|leaves|dies|is sacrificed|are sacrificed|is destroyed|are destroyed)|whenever you cast an artifact spell|artifact spells you cast|artifacts you control (?:get|have)|for each [^.\n]{0,50}artifact[^.\n]{0,50}you control|number of artifacts you control|if you control (?:an|two|three|four|five|six|seven|eight|nine|ten|one or more|two or more|three or more) artifacts|affinity for artifacts|\bimprovise\b|\bmetalcraft\b|sacrifice (?:an|another) artifact(?![^.:;\n]{0,60}\bor\b)|tap an untapped artifact you control|tap an artifact token for mana|whenever [^.\n]{0,100}(?:noncreature )?artifact is (?:sacrificed|destroyed)|whenever [^.\n]{0,80}artifact[^.\n]{0,80}you control (?:is|are) put into (?:a|your) graveyard from the battlefield|if one or more artifact tokens would be created under your control/i;
const artifactGluePattern = /search your library for (?:an?|target) artifact|return (?:target )?artifact card from [^.]{0,80}graveyard|copy of (?:target |an? )?artifact/i;

const noncreaturePayoffPattern = /whenever you cast a noncreature spell|if you(?:'ve| have) cast a noncreature spell this turn|\bprowess\b/i;
const enchantmentPayoffPattern = /whenever you cast an enchantment spell|(?:when|whenever) (?:an|another|one or more) enchantments? (?:you control )?enters/i;
const enchantmentGluePattern = /search your library for (?:an?|target) enchantment|return (?:target )?enchantment card from [^.]{0,80}graveyard/i;

const flickerPattern = /exile [^.]{0,140}(?:creature|permanent|card)[^.]{0,100}(?:then return|return (?:it|that card|those cards|them|him|her))[^.]{0,100}(?:to|onto) the battlefield|exile [^.]{0,120}(?:creature|permanent|card)[^.]*\. [^.]{0,100}return (?:it|that card|those cards|them|him|her)[^.]{0,100}(?:to|onto) the battlefield/i;
// Commas are legal inside card names (including Oracle aliases), so only a
// sentence boundary may terminate the trigger subject before "enters".
const etbTriggerPattern = /\bwhen(?:ever)?\b[^.;\n]{0,240}?\benter(?:s)?(?: the battlefield)?\b[^,.;\n]{0,120}(?=,|—)/i;
const opponentControlledEnterPattern = /\b(?:an opponent controls|your opponent controls|your opponents control)\b|\benter(?:s)?\b[^,.;]{0,100}\bunder (?:(?:an|your) opponent(?:'s)?|your opponents') control\b|\bunder the control of (?:an|your) opponent\b/i;
const etbAmplifierPattern = /(?:permanent|artifact|creature)[^.]*(?:entering|enters)[^.]*causes? [^.]*triggered ability[^.]*trigger[^.]*additional time|if [^.]*entering the battlefield causes? [^.]*triggered ability[^.]*that ability triggers? an additional time/i;
const creatureTriggerAmplifierPattern = /if a triggered ability of a creature you control[^.]*triggers, that ability triggers an additional time/i;
const blinkPreparedPattern = /\bthis creature enters prepared\b/i;
const blinkSagaResetPattern = /\bas this saga enters\b/i;
const blinkLeaveRewardPattern = /whenever (?:a|another) [^.]{0,80}(?:you control )?(?:leaves the battlefield|is exiled from the battlefield)/i;
const permanentCopyPattern = /enters as a copy of|enter the battlefield as a copy of|create [^.]{0,140}token (?:that's|that is) a copy of|put [^.]{0,120}token onto the battlefield[^.]{0,100}copy of|copy target (?:artifact|creature|enchantment|permanent|planeswalker) spell/i;
const selfBouncePattern = /return (?:another |target )?[^.]{0,100}you control to its owner's hand/i;
const diesReturnPattern = /(?:when|whenever) [^,.;]{0,120}\bdies\b,?[^.]{0,120}\breturn (?:it|that card|this card)[^.]{0,80}(?:to|onto) the battlefield|return this card from your graveyard to the battlefield/i;

const ppCounterSourcePattern = /put [^.]{0,100}\+1\/\+1 counters?|enters with [^.]{0,80}\+1\/\+1 counters?|return [^.]{0,140}(?:to|onto) the battlefield[^.]{0,100}with (?:a|one or more) \+1\/\+1 counters?|adapt \d|evolve\b|backup \d/i;
const ppCounterPayoffPattern = /for each \+1\/\+1 counter|creatures? you control with (?:a|one or more) \+1\/\+1 counters?|permanents? you control with (?:a|one or more) \+1\/\+1 counters?|remove (?:a|one or more) \+1\/\+1 counters?|if one or more \+1\/\+1 counters? would be put|double the number of \+1\/\+1 counters?|number of \+1\/\+1 counters/i;
const linkedGenericCounterPayoffPattern = /creatures? you control with a counter on (?:it|them)|double the number of each kind of counter/i;
const proliferatePattern = /\bproliferate\b/i;

const tokenSourcePattern = /create [^.]{0,120}tokens?/i;
const tokenPayoffPattern = /tokens you control (?:get|have)|for each (?:creature )?token|number of tokens|whenever [^."]{0,100}(?<!non)token[^."]{0,80}(?:enters|dies|leaves|is created)|one or more tokens? (?:enter|leave|die|are created)|if (?:you would create|one or more tokens would be created)[^.]{0,120}(?:instead|twice)|tokens? [^.]{0,80}(?:would be created|are created) instead|instead create one of each/i;

const graveyardFuelPattern = /\bmill (?:a|one|two|three|four|five|six|seven|eight|nine|ten|x|that many|any number of) cards?|put [^.]{0,100}cards? from (?:your|a|the) library into (?:your|a|the) graveyard|sacrifice (?:another|a) creature/i;
const controlledDiscardPattern = /discard (?:a|one|two|three|four|five|six|seven|eight|nine|ten|one or more|any number of|x|that many) cards?|discard your hand/i;
const discardPayoffPattern = /(?:when|whenever) (?:you|a player|each player) discards?|if you discarded|card was discarded this way|cards? you discard|discarded (?:a|one or more) cards? this turn/i;
const reanimatePattern = /return [^.]{0,120}(?:creature|permanent|artifact|enchantment|planeswalker|land) card[^.]{0,100}from [^.]{0,80}graveyard[^.]{0,100}(?:to|onto) the battlefield|put [^.]{0,120}(?:creature|permanent) card from [^.]{0,80}graveyard[^.]{0,100}(?:to|onto) the battlefield|choose [^.]{0,120}(?:creature|planeswalker|permanent) card[^.]{0,100}graveyard\. put (?:those|the chosen) cards? onto the battlefield|return this card from your graveyard to the battlefield/i;
const graveyardPermanentCastPattern = /(?:cast|play) [^.]{0,140}(?:permanent|creature|artifact|enchantment|planeswalker|land|spells?|cards?)[^.]{0,120}from (?:your|a|the) graveyard|play lands and cast spells from your graveyard/i;
const graveyardCastingPattern = /(?:cast|play) [^.]{0,120}from (?:your|a|the) graveyard|\bflashback\b|\bescape\b|\bmayhem\b/i;

const sacrificeSourcePattern = /sacrifice (?:another|a|an|one or more|any number of|x) [^:.,]{1,100}:|as an additional cost to cast [^.]{0,100}sacrifice|you may sacrifice (?:another|a|an|one or more)/i;
const sacrificePayoffPattern = /(?:when|whenever) [^.]{0,140}(?:is sacrificed|are sacrificed)|(?:when|whenever) (?:you|a player|an opponent|each opponent) sacrifices?|if [^.]{0,100}was sacrificed|one or more [^.]{0,80}are sacrificed|artifact token named [^.]{0,80}with ["“]when this token leaves the battlefield/i;
const diesPayoffPattern = /(?:when|whenever) [^.]{0,140}\b(?:dies|die)\b|if [^.]{0,100}\bdied this turn\b|one or more [^.]{0,80}\bdie\b|(?:when|whenever) [^.]{0,120}(?:is|are) put into (?:a|your) graveyard from the battlefield/i;

const theftPattern = /gain control of [^.]{0,140}(?:creature|permanent|artifact|enchantment|planeswalker)|exchange control of/i;
const theftPayoffPattern = /(?:permanent|creature) you control but don't own|whenever you gain control of/i;
const opponentCardPayoffPattern = /whenever you cast a spell you don't own|whenever you play a card you don't own/i;

const powerFourPattern = /power 4 or greater/i;
const powerScalingPattern = /(?:damage|cards?|mana|tokens?|counters?|\+x\/\+x|costs?)[^.\n]{0,100}equal to [^.\n]{0,60}(?:its|this creature's|that creature's|target creature's|the creature's|greatest|total) power|damage equal to the power|equal to the greatest power|draw cards equal to [^.\n]{0,60}power|where x is (?:the )?(?:greatest|total|its|this creature's|that creature's|target creature's) power|double [^.\n]{0,60}\bpower\b/i;
const variablePowerInputPattern = /(?:this creature's|its|[a-z,' -]+) power (?:is|are) equal to|power and toughness are each equal to/i;
const createsFourPowerPattern = /create [^.]{0,100}(?:4\/4|5\/5|6\/6|7\/7|8\/8|9\/9|10\/10) [^.]{0,50}creature token/i;

const damageSourcePattern = /deals? (?:(?:\d+|x|that much) damage|damage equal to [^.\n]{0,80})/i;
const damagePayoffPattern = /\bnoncombat damage\b/i;
const genericDamageAmplifierPattern = /if [^.\n]{0,140}\bwould deal [^.\n]{0,100}\bdamage\b[^.\n]{0,120}\binstead\b|\bdeals? double that damage\b|\bdouble all damage\b|\bdouble the damage\b|\bdeals? twice that much damage\b/i;

const attackTriggerPattern = /(?:when|whenever) [^.]{0,120}\battacks\b(?! you)/i;
const attackSupportPattern = /additional combat phase|create [^.]{0,100}tapped and attacking|put [^.]{0,100}onto the battlefield tapped and attacking|attacks this turn if able/i;
const attackAmplifierPattern = /if [^.]{0,140}(?:triggered ability[^.]{0,120}(?:attacks|attacking)|(?:attacks|attacking)[^.]{0,120}triggered ability)[^.]{0,120}additional time/i;
const combatDamageTriggerPattern = /deals combat damage to (?:a player|an opponent|one of your opponents)/i;
const combatDamageSupportPattern = /target [^.]{0,80}can't be blocked|creatures you control gain trample|target [^.]{0,80}gains double strike/i;
const combatDamageAmplifierPattern = /if [^.]{0,140}(?:triggered ability[^.]{0,120}combat damage|combat damage[^.]{0,120}triggered ability)[^.]{0,120}additional time/i;

const equipmentPayoffPattern = /(?:equipped|modified) creatures? you control|whenever [^.]{0,100}(?:equipment|equipped)|for each (?:aura (?:and|or) )?equipment|number of equipment|attach (?:an?|target) equipment/i;
const equipmentGluePattern = /search your library for (?:an?|target) (?:aura or )?equipment|equip abilities? you activate cost/i;
const drawSourcePattern = /draws? (?:a|one|two|three|four|five|x|that many|cards? equal to) cards?/i;
const drawPayoffPattern = /second card you've drawn|second card you draw|third card you've drawn|third card you draw|draw your second card|draw two or more cards/i;
const landfallSourcePattern = /you may play an additional land|put [^.]{0,120}land card[^.]{0,80}(?:to|onto) the battlefield|search your library for [^.]{0,120}lands? cards?[^.]{0,160}put (?:it|them|that card|those cards) (?:to|onto) the battlefield|choose [^.]{0,160}land card[\s\S]{0,320}put (?:the )?chosen cards? (?:to|onto) the battlefield|play lands? from (?:your|a) graveyard/i;
const landfallPayoffPattern = /\blandfall\b|whenever (?:a|another) land (?:you control )?enters/i;
const domainLandSearchPattern = /search your library for [^.]{0,120}(?:basic land card|plains[^.]{0,50}island|island[^.]{0,50}swamp|swamp[^.]{0,50}mountain|mountain[^.]{0,50}forest|forest[^.]{0,50}plains)[^.]{0,120}(?:to|onto) the battlefield/i;
const domainLandTypePattern = /lands? you control (?:are|have) (?:every|all) basic land type|is every basic land type/i;
const domainPayoffPattern = /\bdomain\b|(?:for each|number of) basic land types? among lands you control|\bconverge\b|(?:for each|number of) colors? of mana spent|if five colors? of mana were spent|(?:five|number of) colors among permanents you control/i;
const repeatableAnyColorPattern = /\{t\}:\s*add (?:one )?mana of any color/i;
const taxPattern = /spells? [^.]{0,100}cost [^.]{0,80}more to cast|can't cast [^.]{0,80}spells|can't cast more than|can't cast spells|players can't cast|each player can't cast/i;
const graveyardTypesPayoffPattern = /\bdelirium\b|(?:number of|four or more|five or more) card types among cards in [^.]{0,80}graveyard|card types among cards in [^.]{0,80}graveyard[^.]{0,100}(?:get|cost|equal)/i;
const lifegainSourcePattern = /you gain (?:\d+|x|that much) life|you gain life equal to [^.\n]+/i;
const lifegainPayoffPattern = /whenever you gain life|if you gained life|as long as your life total is|if your life total is/i;
const humanPayoffPattern = /(?:other )?humans? you control (?:get|have)|whenever (?:a|another) human (?:you control )?(?:enters|attacks|dies)|for each (?:other )?human(?: you control)?|human spells? you cast|number of humans? you control|as long as you control [^.]{0,40}humans?/i;
const humanGluePattern = /search your library for [^.]{0,80}human|look at [^.]{0,80}cards?[^.]{0,120}human creature card[^.]{0,80}(?:hand|battlefield)/i;

const interactionPattern = /(?:destroy|exile|counter) target|return target [^.]{0,80}(?:opponent|you don't control)|target [^.]{0,80}gets? -[x0-9*]+\/-[x0-9*]+|deals? [^.]{0,80}damage to (?:any target|target creature|target planeswalker)|target opponent discards?|each opponent sacrifices?|fight target|tap target [^.]{0,60}(?:creature|permanent)|can't attack or block/i;
const valuePattern = /draw (?:a|one|two|three|four|five|six|seven|x|that many) cards?|create [^.]{0,100}tokens?|return [^.]{0,100}card from [^.]{0,80}graveyard to (?:your hand|the battlefield)|search your library for|you may (?:cast|play) [^.]{0,100}(?:exiled|from your graveyard)|look at the top [^.]{0,80}put [^.]{0,80}into your hand/i;

const explicitRole = (label, ruleId, pattern, liveTag = null, extraTest = () => true) =>
  strictRole(label, ruleId, (card) => extraTest(card) && textMatches(card, pattern), (card) => explicitReason(card, pattern), liveTag);

const controlledDiscardClause = (card) => {
  const cycling = card.keywords.find((keyword) => /cycling$/i.test(keyword));
  if (cycling) return `${cycling} includes discarding this card as its activated cost.`;
  return oracle(card)
    .split(/[.\n]/)
    .map((clause) => clause.trim())
    .find((clause) => (
      controlledDiscardPattern.test(clause)
      && !(/^whenever\b/i.test(clause) && clause.toLowerCase().indexOf('discard') < clause.indexOf(','))
      && !/\bward\b|target opponent discards?|an opponent discards?/i.test(clause)
      && (/\byou (?:may )?discard|(?:^|[,;—])\s*(?:then )?discard|each player discards?|players discard|discard your hand/i.test(clause))
    ));
};
const hasKeyword = (card, keyword) => card.keywords.some((item) => item.toLowerCase() === keyword.toLowerCase());
const basicLandTypeCount = (card) => new Set(card.type.match(/\b(?:Plains|Island|Swamp|Mountain|Forest)\b/gi) ?? []).size;
const reusableEnterTriggerClause = (card) => (
  oracle(card).match(new RegExp(etbTriggerPattern.source, 'gi')) ?? []
).find((clause) => (
  !opponentControlledEnterPattern.test(clause)
  && !/\b(?:a|another|one or more|target|each)?\s*lands? (?:you control )?enter/i.test(clause)
  && !/\bcast\b[^.;]{0,200}\benter/i.test(clause)
)) ?? '';
const hasBlinkReturnKeyword = (card) => ['Encore', 'Escape', 'Persist', 'Undying', 'Unearth'].some((keyword) => hasKeyword(card, keyword));
const isBlinkEnabler = (card) => textMatches(card, flickerPattern);
const blinkEnablerReason = (card) => `Intentional exile-and-return effect. ${explicitReason(card, flickerPattern)}`;
const isBlinkPayoff = (card) => isPermanent(card) && !card.isLand && (
  Boolean(reusableEnterTriggerClause(card))
  || textMatches(card, etbAmplifierPattern)
  || textMatches(card, creatureTriggerAmplifierPattern)
  || textMatches(card, blinkPreparedPattern)
  || blinkSagaResetPattern.test(card.oracleText)
  || textMatches(card, blinkLeaveRewardPattern)
);
const blinkPayoffReason = (card) => {
  const enterTrigger = reusableEnterTriggerClause(card);
  if (enterTrigger) return `Explicit enter trigger: "${enterTrigger}". Re-entering the permanent repeats this trigger.`;
  if (textMatches(card, etbAmplifierPattern)) return `${explicitReason(card, etbAmplifierPattern)} This increases the value of separate enter triggers.`;
  if (textMatches(card, creatureTriggerAmplifierPattern)) return `${explicitReason(card, creatureTriggerAmplifierPattern)} This increases the value of a separate creature's enter trigger.`;
  if (textMatches(card, blinkPreparedPattern)) return `${explicitReason(card, blinkPreparedPattern)} Flickering this creature prepares its spell again.`;
  if (blinkSagaResetPattern.test(card.oracleText)) return 'Saga entry starts its chapter sequence again, so flicker can reuse its opening chapter.';
  return `${explicitReason(card, blinkLeaveRewardPattern)} A true flicker causes this leave/exile trigger.`;
};
const coloredCostCount = (card) => new Set((card.parsedCost ?? []).filter((symbol) => /^[wubrg]$/i.test(symbol)).map((symbol) => symbol.toUpperCase())).size;
const hasWubrgActivation = (card) => /\{W\}[^.\n]{0,20}\{U\}[^.\n]{0,20}\{B\}[^.\n]{0,20}\{R\}[^.\n]{0,20}\{G\}/i.test(oracle(card));
const isCommanderOnly = (card) => {
  const functionalLines = oracle(card)
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(?:this land enters tapped|partner(?:—|\b)|choose a background|[−+]?\d+:|.* can be your commander)/i.test(line));
  return functionalLines.length > 0 && functionalLines.every((line) => (
    /commander creatures you own have/i.test(line)
    || /your commander's color identity/i.test(line)
    || /shares a creature type with your commander/i.test(line)
  ));
};
const isGraveyardFuel = (card) => textMatches(card, graveyardFuelPattern) || Boolean(controlledDiscardClause(card)) || hasKeyword(card, 'Connive');
const graveyardFuelEvidence = (card) => {
  const discard = controlledDiscardClause(card);
  if (discard) return `Player-controlled discard: "${discard}"`;
  if (hasKeyword(card, 'Connive')) return 'Keyword is Connive, which draws then discards.';
  return explicitReason(card, graveyardFuelPattern);
};
const isDiscardPayoff = (card) => {
  if (hasKeyword(card, 'Madness') || hasKeyword(card, 'Mayhem')) return true;
  if (!textMatches(card, discardPayoffPattern)) return false;
  if (/whenever you discard a card, exile that card from your graveyard/i.test(oracle(card)) && !/card exiled with/i.test(oracle(card))) return false;
  return true;
};
const opponentCardSourceClause = (card) => {
  // Remove reminder text first: Gift and similar reminders can mention an
  // opponent near an otherwise unrelated self-cast effect.
  const lines = card.oracleText
    .replace(/\([^()]*\)/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const opponentOwnedSource = /(?:target )?opponent's (?:library|graveyard|hand|sideboard)|target opponent[^.]{0,180}(?:library|graveyard|hand|sideboard|exiles?|chooses)|that player(?:'s)?[^.]{0,160}(?:library|graveyard|hand|sideboard|exiles?)|(?:spell|card|permanent|creature)[^.]{0,100}opponent controls|cards? you (?:didn't control|don't own)|opponent discards a card[^.]{0,100}exile/i;
  const castOrPlayLinkedCard = /you may [^.]{0,180}\b(?:cast|play)\b/i;
  const direct = lines.find((line) => opponentOwnedSource.test(line) && castOrPlayLinkedCard.test(line));
  if (direct) return direct;
  const exileOpponent = lines.find((line) => opponentOwnedSource.test(line) && /\b(?:exile|exiled)\b/i.test(line));
  const linkedCast = lines.find((line) => /you may (?:cast|play) [^.]{0,160}(?:exiled with|the exiled cards?|cards? exiled|cards? you don't own|it this turn)/i.test(line));
  return exileOpponent && linkedCast ? `${exileOpponent} ${linkedCast}` : '';
};
const tokenSourceClause = (card) => card.oracleText
  .replace(/\([^()]*\)/g, ' ')
  .split(/\n|(?<=\.)\s+/)
  .map((clause) => clause.trim())
  .find((clause) => tokenSourcePattern.test(clause) && !/(?:if you would create|would be created|instead create)[^.]{0,160}tokens?/i.test(clause)) ?? '';
const diesPayoffClause = (card) => card.oracleText
  .replace(/\([^()]*\)/g, ' ')
  .split(/\n|(?<=\.)\s+/)
  .map((clause) => clause.trim())
  .find((clause) => (
    diesPayoffPattern.test(clause)
    && !/(?:creature|permanent|artifact) an opponent controls (?:dies|is put)/i.test(clause)
    && !/if you control your commander/i.test(clause)
  )) ?? '';
const isDiscountedPayload = (card) => (
  ['Affinity', 'Convoke', 'Delve', 'Improvise'].some((keyword) => hasKeyword(card, keyword))
  || hasTag(card, 'cheaper-than-mv', 'free-spell', 'alternate-cost', 'cost-reduction')
  || /costs? [^.]{0,100}less to cast|rather than pay (?:this spell's|its) mana cost|without paying (?:its|their) mana cost|you may cast [^.]{0,120}for (?:its|the) [^.]{0,30}cost/i.test(oracle(card))
);
const manaWordValue = new Map([['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5]]);
const rampSourceClause = (card) => {
  const landAccess = matchingClause(card, /search your library for [^.]{0,100}land card[^.]{0,100}(?:to|onto) the battlefield|you may play an additional land/i);
  if (landAccess) return landAccess;
  const lines = card.oracleText
    .replace(/\([^()]*\)/g, ' ')
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter((line) => /\badd\b/i.test(line));
  for (const line of lines) {
    if (card.layout === 'modal_dfc' && /^\{T\}:\s*Add/i.test(line)) continue;
    if (/loses all abilities|becomes [^.]{0,80}(?:land|treasure)|is a [^.]{0,80}land with|has ["“][^"”]*\{T\}:\s*Add/i.test(line)) continue;
    const addIndex = line.search(/\badd\b/i);
    const output = line.slice(addIndex);
    const symbols = output.match(/\{[WUBRGC]\}/gi) ?? [];
    const word = output.match(/\b(one|two|three|four|five) mana\b/i)?.[1]?.toLowerCase();
    const produced = symbols.length || manaWordValue.get(word) || (/for each color[^.]{0,100}add one mana/i.test(line) ? 2 : 0);
    if (!produced) continue;
    const colon = line.lastIndexOf(':', addIndex);
    if (colon < 0) return line;
    const activationCost = line.slice(0, colon);
    const paidMana = (activationCost.match(/\{(?:\d+|[WUBRGC])\}/gi) ?? [])
      .reduce((sum, symbol) => sum + (/^\{\d+\}$/.test(symbol) ? Number(symbol.slice(1, -1)) : 1), 0);
    if (produced > paidMana) return line;
  }
  return '';
};
const noncombatDamageClause = (card) => oracle(card)
  .split(/\n|(?<=\.)\s+/)
  .map((clause) => clause.trim())
  .find((clause) => (
    damageSourcePattern.test(clause)
    && !(/combat damage/i.test(clause) && (clause.match(/\bdeals?\b/gi) ?? []).length < 2)
    && !(
      /deals? [^.]{0,80}damage to you\b/i.test(clause)
      && !/(?:any target|target (?:creature|planeswalker|permanent|player|opponent)|each opponent|that spell's controller)/i.test(clause)
    )
    && !/damage dealt to you/i.test(clause)
  )) ?? '';
const adjacentMechanicMatches = (card) => {
  const matches = [];
  if (textMatches(card, permanentCopyPattern)) matches.push({ id: 'permanent-copy', label: 'Permanent copy', reason: explicitReason(card, permanentCopyPattern) });
  if (textMatches(card, selfBouncePattern)) matches.push({ id: 'self-bounce', label: 'Self-bounce / recast', reason: explicitReason(card, selfBouncePattern) });
  if (textMatches(card, reanimatePattern) || textMatches(card, diesReturnPattern) || (isPermanent(card) && hasBlinkReturnKeyword(card))) {
    matches.push({ id: 'battlefield-recursion', label: 'Battlefield recursion', reason: 'The card returns a permanent from a graveyard to the battlefield; this is graveyard synergy, not Blink.' });
  }
  if (textMatches(card, graveyardPermanentCastPattern)) matches.push({ id: 'graveyard-casting', label: 'Graveyard casting', reason: explicitReason(card, graveyardPermanentCastPattern) });
  return matches;
};

export const STRICT_THEMES = [
  {
    id: 'artifacts', name: 'Artifacts', focusColors: ['U', 'R'],
    description: 'Artifact cards and artifact tokens feed explicit artifact rewards.',
    nominationTags: ['synergy-artifact', 'artifactfall', 'affinity-for-artifacts', 'recursion-artifact'],
    roles: {
      enablers: strictRole('Artifact inputs', 'artifact-input', (card) => isType(card, 'Artifact') || textMatches(card, artifactTokenPattern), (card) => isType(card, 'Artifact') ? 'Card type is Artifact, including artifact lands.' : explicitReason(card, artifactTokenPattern), 'Strict Artifacts: Enabler'),
      payoffs: explicitRole('Artifact rewards', 'artifact-reward', artifactPayoffPattern, 'Strict Artifacts: Payoff'),
      glue: explicitRole('Artifact search and recursion', 'artifact-glue', artifactGluePattern, 'Strict Artifacts: Glue'),
    },
  },
  {
    id: 'noncreature-spells', name: 'Noncreature Spells', focusColors: ['U', 'R'],
    description: 'Broad noncreature cast rewards work with artifacts and enchantments as well as instants and sorceries.',
    nominationTags: ['synergy-noncreature', 'noncreature-typal', 'prowess', 'cast-trigger-you'],
    roles: {
      enablers: strictRole('Noncreature spells', 'noncreature-input', (card) => !card.isLand && !isCreature(card), () => 'Card is a nonland, noncreature spell.', 'Strict Noncreature: Enabler'),
      payoffs: explicitRole('Noncreature cast rewards', 'noncreature-cast-reward', noncreaturePayoffPattern, 'Strict Noncreature: Payoff'),
      glue: noRole('No generic glue', 'noncreature-no-glue'),
    },
  },
  {
    id: 'enchantments', name: 'Enchantments', focusColors: ['W', 'G'],
    description: 'Enchantments and Role tokens feed explicit enchantment cast and enter rewards.',
    nominationTags: ['synergy-enchantment', 'enchantmentfall', 'enchantment-engine', 'tutor-enchantment'],
    roles: {
      enablers: strictRole('Enchantment inputs', 'enchantment-input', (card) => isType(card, 'Enchantment') || /create [^.]{0,100}role token/i.test(oracle(card)), (card) => isType(card, 'Enchantment') ? 'Card type is Enchantment.' : 'Explicitly creates a Role enchantment token.', 'Strict Enchantments: Enabler'),
      payoffs: explicitRole('Enchantment rewards', 'enchantment-reward', enchantmentPayoffPattern, 'Strict Enchantments: Payoff'),
      glue: explicitRole('Enchantment search and recursion', 'enchantment-glue', enchantmentGluePattern, 'Strict Enchantments: Glue'),
    },
  },
  {
    id: 'blink', name: 'Blink',
    description: 'Intentional exile-and-return effects reuse nonland permanents. Payoffs must demonstrably benefit from actual flicker: reusable own enter/leave effects, re-preparing, Saga resets, or relevant trigger amplification. Copy, self-bounce, landfall, reanimation, and graveyard casting remain separate adjacent mechanics.',
    nominationTags: ['flicker', 'flicker-creature', 'flicker-permanent', 'etb-trigger'],
    roles: {
      enablers: strictRole('Intentional flicker effects', 'blink-flicker', isBlinkEnabler, blinkEnablerReason, 'Strict Blink: Enabler'),
      payoffs: strictRole(
        'Enter-trigger permanents',
        'blink-enter-trigger-payoff',
        isBlinkPayoff,
        blinkPayoffReason,
        'Strict Blink: Payoff',
      ),
      glue: noRole('Blink glue', 'blink-no-generic-glue'),
    },
  },
  {
    id: 'pp-counters', name: '+1/+1 Counters',
    description: 'Literal +1/+1 counter sources connect to explicit counter rewards; generic counters do not qualify.',
    nominationTags: ['gives-pp-counters', 'gains-pp-counters', 'pp-counters-matter', 'counter-doubler', 'repeatable-proliferate'],
    roles: {
      enablers: strictRole(
        '+1/+1 counter sources',
        'pp-counter-source',
        (card) => textMatches(card, ppCounterSourcePattern) || hasKeyword(card, 'Connive'),
        (card) => hasKeyword(card, 'Connive') && !textMatches(card, ppCounterSourcePattern) ? 'Keyword is Connive, which can put a +1/+1 counter on this creature.' : explicitReason(card, ppCounterSourcePattern),
        'Strict Counters: Enabler',
      ),
      payoffs: strictRole(
        '+1/+1 counter rewards',
        'pp-counter-reward',
        (card) => textMatches(card, ppCounterPayoffPattern) || (textMatches(card, ppCounterSourcePattern) && textMatches(card, linkedGenericCounterPayoffPattern)),
        (card) => textMatches(card, ppCounterPayoffPattern)
          ? explicitReason(card, ppCounterPayoffPattern)
          : `This card creates +1/+1 counters and has a linked counter reward: "${matchingClause(card, linkedGenericCounterPayoffPattern)}"`,
        'Strict Counters: Payoff',
      ),
      glue: explicitRole('Proliferate', 'pp-counter-proliferate', proliferatePattern, 'Strict Counters: Glue'),
    },
  },
  {
    id: 'tokens', name: 'Tokens',
    description: 'Token makers feed cards that explicitly reward or scale with tokens.',
    nominationTags: ['repeatable-token-generator', 'multiple-bodies', 'synergy-token', 'token-doubler'],
    roles: {
      enablers: strictRole('Token makers', 'token-source', (card) => Boolean(tokenSourceClause(card)), (card) => `Explicit token production: "${tokenSourceClause(card)}"`, 'Strict Tokens: Enabler'),
      payoffs: explicitRole('Token rewards', 'token-reward', tokenPayoffPattern, 'Strict Tokens: Payoff'),
      glue: noRole('No generic glue', 'tokens-no-glue'),
    },
  },
  {
    id: 'humans', name: 'Humans', focusColors: ['W', 'B'],
    description: 'Human creatures feed cards that explicitly reward Humans as a creature type.',
    nominationTags: ['typal-human'],
    roles: {
      enablers: strictRole('Human creatures', 'human-input', (card) => isCreature(card) && card.creatureTypes.includes('Human'), () => 'Creature type is Human.', 'Strict Humans: Enabler'),
      payoffs: explicitRole('Human rewards', 'human-reward', humanPayoffPattern, 'Strict Humans: Payoff', (card) => !/non-human/i.test(oracle(card))),
      glue: explicitRole('Human search', 'human-glue', humanGluePattern, 'Strict Humans: Glue'),
    },
  },
  {
    id: 'reanimator', name: 'Reanimator',
    description: 'Discard and self-mill stock graveyards for effects that return permanents directly to the battlefield.',
    nominationTags: ['mill-self', 'discard-outlet', 'reanimate', 'recursion-creature'],
    roles: {
      enablers: strictRole('Graveyard fuel', 'graveyard-fuel', isGraveyardFuel, graveyardFuelEvidence, 'Strict Reanimator: Enabler'),
      payoffs: explicitRole('Return to battlefield', 'reanimate-to-battlefield', reanimatePattern, 'Strict Reanimator: Payoff'),
      glue: noRole('No generic glue', 'reanimator-no-glue'),
    },
  },
  {
    id: 'graveyard-casting', name: 'Graveyard Casting',
    description: 'Discard and self-mill feed cards that are explicitly cast or played from a graveyard.',
    nominationTags: ['castable-from-graveyard', 'synergy-graveyard-cast', 'reanimate-cast', 'flashback'],
    roles: {
      enablers: strictRole('Graveyard fuel', 'graveyard-cast-fuel', isGraveyardFuel, graveyardFuelEvidence, 'Strict Graveyard Cast: Enabler'),
      payoffs: explicitRole('Cast from graveyard', 'graveyard-cast-reward', graveyardCastingPattern, 'Strict Graveyard Cast: Payoff'),
      glue: noRole('No generic glue', 'graveyard-casting-no-glue'),
    },
  },
  {
    id: 'discard', name: 'Discard',
    description: 'Player-controlled discard and Connive feed abilities that explicitly reward or require discarded cards.',
    nominationTags: ['discard-outlet', 'discard-matters', 'madness', 'mayhem'],
    roles: {
      enablers: strictRole('Controlled discard', 'discard-source', (card) => Boolean(controlledDiscardClause(card)) || hasKeyword(card, 'Connive'), graveyardFuelEvidence, 'Strict Discard: Enabler'),
      payoffs: strictRole(
        'Discard rewards',
        'discard-reward',
        isDiscardPayoff,
        (card) => textMatches(card, discardPayoffPattern)
          ? explicitReason(card, discardPayoffPattern)
          : `Keyword is ${hasKeyword(card, 'Madness') ? 'Madness' : 'Mayhem'}; a separate discard enables its alternate graveyard cast.`,
        'Strict Discard: Payoff',
      ),
      glue: noRole('No generic glue', 'discard-no-glue'),
    },
  },
  {
    id: 'sacrifice', name: 'Sacrifice',
    description: 'Explicit sacrifice outlets feed abilities that specifically mention sacrificing; generic dies rewards are tracked separately.',
    nominationTags: ['sacrifice-outlet', 'sacrifice-matters', 'dies-trigger'],
    roles: {
      enablers: explicitRole('Sacrifice outlets', 'sacrifice-source', sacrificeSourcePattern, 'Strict Sacrifice: Enabler'),
      payoffs: explicitRole('Sacrifice rewards', 'sacrifice-reward', sacrificePayoffPattern, 'Strict Sacrifice: Payoff'),
      glue: noRole('No generic glue', 'sacrifice-no-glue'),
    },
  },
  {
    id: 'dies', name: 'Aristocrats', focusColors: ['W', 'B'],
    description: 'Low-cost recurring or expendable bodies feed creature-sacrifice outlets and rewards for other creatures dying. Generic creatures, Treasure sacrifice, and artifact-only outlets do not qualify.',
    nominationTags: ['dies-trigger', 'death-trigger', 'creature-death-matters'],
    roles: {
      enablers: strictRole('Fodder and recurring bodies', 'aristocrats-fodder', (card) => Boolean(aristocratsFodder(card)), aristocratsFodder, 'Strict Aristocrats: Enabler'),
      payoffs: strictRole('Creature outlets and death rewards', 'aristocrats-reward', (card) => Boolean(creatureSacrificeOutlet(card) || creatureDeathReward(card)), (card) => creatureSacrificeOutlet(card) ? `Consumes another creature: "${creatureSacrificeOutlet(card)}"` : `Rewards creature deaths: "${creatureDeathReward(card)}"`, 'Strict Aristocrats: Payoff'),
      glue: noRole('No generic glue', 'aristocrats-no-glue'),
    },
  },
  {
    id: 'theft', name: 'Theft',
    description: 'Control-changing effects and explicit rewards for controlling cards you do not own.',
    nominationTags: ['theft', 'control-changing-effects', 'exchange-control'],
    roles: {
      enablers: explicitRole('Control-changing effects', 'theft-source', theftPattern, 'Strict Theft: Enabler'),
      payoffs: explicitRole('Theft rewards', 'theft-reward', theftPayoffPattern, 'Strict Theft: Payoff'),
      glue: noRole('No generic glue', 'theft-no-glue'),
    },
  },
  {
    id: 'opponent-cards', name: "Opponent's Cards",
    description: 'Cards that let you cast or play an opponent-owned card, plus explicit rewards for doing so.',
    nominationTags: ['nightveil-theft', 'theft-cast', 'cast-opponents-card'],
    roles: {
      enablers: strictRole('Opponent-card access', 'opponent-card-source', (card) => Boolean(opponentCardSourceClause(card)), (card) => `Explicit access to an opponent-owned card: "${opponentCardSourceClause(card)}"`, 'Strict Opponent Cards: Enabler'),
      payoffs: explicitRole('Opponent-card rewards', 'opponent-card-reward', opponentCardPayoffPattern, 'Strict Opponent Cards: Payoff'),
      glue: noRole('No generic glue', 'opponent-cards-no-glue'),
    },
  },
  {
    id: 'power-four', name: 'Power 4+', focusColors: ['R', 'G'],
    description: 'Four-power bodies available at mana value three or less enable early threshold rewards. Expensive finishers retain descriptive power tags but do not inflate early support.',
    nominationTags: ['ferocious', 'specific-power-matters', 'power-matters-individual'],
    roles: {
      enablers: strictRole('Early four-power bodies', 'early-power-four-input', (card) => Boolean(earlyPowerInput(card)), earlyPowerInput, 'Strict Power 4+: Enabler'),
      payoffs: explicitRole('Power 4+ rewards', 'power-four-reward', powerFourPattern, 'Strict Power 4+: Payoff'),
      glue: noRole('No generic glue', 'power-four-no-glue'),
    },
  },
  {
    id: 'power-matters', name: 'Power Matters', focusColors: ['R', 'G'],
    description: 'Effects scale their damage, cards, mana, or other output from a creature or board power value.',
    nominationTags: ['scales-with-power', 'greatest-power-matters', 'power-matters-total'],
    roles: {
      enablers: strictRole(
        'Early efficient power',
        'early-power-matters-input',
        (card) => Boolean(earlyScalingPower(card)),
        earlyScalingPower,
        'Strict Power Matters: Enabler',
      ),
      payoffs: explicitRole('Power-scaled effects', 'power-matters-reward', powerScalingPattern, 'Strict Power Matters: Payoff'),
      glue: noRole('No generic glue', 'power-matters-no-glue'),
    },
  },
  {
    id: 'ramp', name: 'Ramp',
    description: 'Nonland mana acceleration enables truly demanding eight-mana payloads; six- and seven-mana cards are softer ramp glue.',
    nominationTags: ['ramp', 'land-ramp', 'mana-producer', 'multi-land-ramp'],
    roles: {
      enablers: strictRole('Mana acceleration', 'ramp-source', (card) => !card.isLand && Boolean(rampSourceClause(card)), (card) => `Explicit net mana acceleration: "${rampSourceClause(card)}"`, 'Strict Ramp: Enabler'),
      payoffs: strictRole('Build-around mana payloads', 'ramp-hard-payoff', (card) => !card.isLand && card.cmc >= 8 && !isDiscountedPayload(card), (card) => `Mana value is ${card.cmc}, with no detected alternative cost or intrinsic reduction; this normally requires dedicated acceleration.`, 'Strict Ramp: Payoff'),
      glue: strictRole('High-mana payloads', 'ramp-payload-glue', (card) => !card.isLand && card.cmc >= 6 && card.cmc < 8 && !isDiscountedPayload(card), (card) => `Mana value is ${card.cmc}, with no detected alternative cost or intrinsic reduction; ramp helps, but the card is not fully dependent on a ramp engine.`, 'Strict Ramp: Glue'),
    },
  },
  {
    id: 'noncombat-damage', name: 'Noncombat Damage',
    description: 'Damage clauses that can hit an opponent or permanent outside combat feed explicit noncombat-damage rewards; self-damage and combat-damage clauses are excluded.',
    nominationTags: ['burn', 'ping', 'damage-increaser', 'damage-multiplier'],
    roles: {
      enablers: strictRole('Noncombat damage effects', 'damage-source', (card) => Boolean(noncombatDamageClause(card)), (card) => `Explicit noncombat-capable damage clause: "${noncombatDamageClause(card)}"`, 'Strict Damage: Enabler'),
      payoffs: explicitRole('Damage rewards', 'damage-reward', damagePayoffPattern, 'Strict Damage: Payoff'),
      glue: explicitRole('Generic damage amplification', 'damage-amplifier-glue', genericDamageAmplifierPattern, 'Strict Damage: Glue', (card) => !textMatches(card, damagePayoffPattern)),
    },
  },
  {
    id: 'attack-triggers', name: 'Attack Triggers',
    description: 'Cards with attack triggers are enablers because they contain the desired trigger; trigger doublers are hard payoffs and extra-combat effects are glue.',
    nominationTags: ['attack-trigger', 'attacking-matters', 'raid'],
    roles: {
      enablers: explicitRole('Attack-trigger cards', 'attack-trigger-source', attackTriggerPattern, 'Strict Attack: Enabler'),
      payoffs: strictRole(
        'Attack-trigger amplifiers',
        'attack-trigger-amplifier',
        (card) => textMatches(card, attackAmplifierPattern) || textMatches(card, creatureTriggerAmplifierPattern),
        (card) => textMatches(card, attackAmplifierPattern)
          ? explicitReason(card, attackAmplifierPattern)
          : `${explicitReason(card, creatureTriggerAmplifierPattern)} This needs a separate creature trigger, such as an attack trigger.`,
        'Strict Attack: Payoff',
      ),
      glue: explicitRole('Extra attacks and attacking support', 'attack-support', attackSupportPattern, 'Strict Attack: Glue'),
    },
  },
  {
    id: 'combat-damage', name: 'Combat Damage',
    description: 'Cards with combat-damage triggers are enablers; trigger doublers are hard payoffs and evasion or strike-granting effects are glue.',
    nominationTags: ['saboteur', 'combat-damage-player-trigger'],
    roles: {
      enablers: explicitRole('Combat-damage trigger cards', 'combat-damage-trigger-source', combatDamageTriggerPattern, 'Strict Combat Damage: Enabler'),
      payoffs: strictRole(
        'Combat-damage trigger amplifiers',
        'combat-damage-trigger-amplifier',
        (card) => textMatches(card, combatDamageAmplifierPattern) || textMatches(card, creatureTriggerAmplifierPattern),
        (card) => textMatches(card, combatDamageAmplifierPattern)
          ? explicitReason(card, combatDamageAmplifierPattern)
          : `${explicitReason(card, creatureTriggerAmplifierPattern)} This needs a separate creature trigger, such as a combat-damage trigger.`,
        'Strict Combat Damage: Payoff',
      ),
      glue: explicitRole('Connection support', 'combat-damage-support', combatDamageSupportPattern, 'Strict Combat Damage: Glue'),
    },
  },
  {
    id: 'equipment', name: 'Equipment',
    description: 'Equipment cards feed explicit equipped-creature and Equipment rewards.',
    nominationTags: ['equipment-matters', 'tutor-artifact-equipment', 'equipment-cheaper-equip'],
    roles: {
      enablers: strictRole('Equipment cards', 'equipment-input', (card) => isType(card, 'Equipment'), () => 'Card type is Equipment.', 'Strict Equipment: Enabler'),
      payoffs: explicitRole('Equipment rewards', 'equipment-reward', equipmentPayoffPattern, 'Strict Equipment: Payoff', (card) => !isType(card, 'Equipment')),
      glue: explicitRole('Equipment search and equip help', 'equipment-glue', equipmentGluePattern, 'Strict Equipment: Glue'),
    },
  },
  {
    id: 'draw-matters', name: 'Draw Matters',
    description: 'Card-draw effects feed explicit second-card and multi-draw rewards.',
    nominationTags: ['draw', 'repeatable-draw', 'second-draw-matters', 'third-draw-matters'],
    roles: {
      enablers: strictRole(
        'Card draw',
        'draw-source',
        (card) => textMatches(card, drawSourcePattern) || hasKeyword(card, 'Connive'),
        (card) => hasKeyword(card, 'Connive') && !textMatches(card, drawSourcePattern) ? 'Keyword is Connive, which draws then discards.' : explicitReason(card, drawSourcePattern),
        'Strict Draw: Enabler',
      ),
      payoffs: explicitRole('Multi-draw rewards', 'draw-reward', drawPayoffPattern, 'Strict Draw: Payoff'),
      glue: noRole('No generic glue', 'draw-no-glue'),
    },
  },
  {
    id: 'landfall', name: 'Landfall', focusColors: ['U', 'G'],
    description: 'Extra land access feeds literal Landfall and land-enter triggers.',
    nominationTags: ['landfall', 'land-matters', 'additional-land-play', 'land-recursion'],
    roles: {
      enablers: explicitRole('Extra land access', 'landfall-source', landfallSourcePattern, 'Strict Landfall: Enabler', (card) => !/each player[^.]*may put|from their hand/i.test(oracle(card))),
      payoffs: explicitRole('Land-enter rewards', 'landfall-reward', landfallPayoffPattern, 'Strict Landfall: Payoff'),
      glue: noRole('No generic glue', 'landfall-no-glue'),
    },
  },
  {
    id: 'five-color-domain', name: 'Five-Color Domain',
    description: 'Lasting access to basic land types enables Domain, converge, four- and five-color costs, and explicit five-color activations.',
    nominationTags: ['affinity-for-domain', 'domain', 'converge', 'rainbow-matters', 'the-domains'],
    roles: {
      enablers: strictRole(
        'Basic-land-type breadth',
        'five-color-domain-source',
        (card) => (card.isLand && basicLandTypeCount(card) >= 2) || textMatches(card, domainLandSearchPattern) || textMatches(card, domainLandTypePattern),
        (card) => card.isLand && basicLandTypeCount(card) >= 2
          ? `Land type line contains ${basicLandTypeCount(card)} basic land types.`
          : explicitReason(card, textMatches(card, domainLandSearchPattern) ? domainLandSearchPattern : domainLandTypePattern),
        'Strict Five-Color Domain: Enabler',
      ),
      payoffs: strictRole(
        'Color-breadth rewards',
        'five-color-domain-reward',
        (card) => textMatches(card, domainPayoffPattern) || coloredCostCount(card) >= 4 || hasWubrgActivation(card),
        (card) => textMatches(card, domainPayoffPattern)
          ? explicitReason(card, domainPayoffPattern)
          : hasWubrgActivation(card)
            ? 'Rules text contains a WUBRG activation cost.'
            : `Casting cost contains ${coloredCostCount(card)} distinct colors.`,
        'Strict Five-Color Domain: Payoff',
      ),
      glue: explicitRole('Repeatable rainbow fixing', 'five-color-domain-glue', repeatableAnyColorPattern, 'Strict Five-Color Domain: Glue', isPermanent),
    },
  },
  {
    id: 'taxes', name: 'Taxes',
    description: 'Casting restrictions and cost increases are tracked without treating generic pressure as a payoff.',
    nominationTags: ['tax', 'cast-tax', 'casting-restriction', 'hatebear'],
    roles: {
      enablers: explicitRole('Tax effects', 'tax-source', taxPattern, 'Strict Taxes: Enabler'),
      payoffs: noRole('No generic payoff', 'tax-no-payoff'),
      glue: noRole('No generic glue', 'tax-no-glue'),
    },
  },
  {
    id: 'graveyard-types', name: 'Graveyard Types',
    description: 'Controlled discard and self-mill diversify card types for Delirium and explicit card-type rewards.',
    nominationTags: ['mill-self', 'discard-outlet', 'delirium', 'cards-in-graveyard-matter'],
    roles: {
      enablers: strictRole('Graveyard-type fuel', 'graveyard-types-source', isGraveyardFuel, graveyardFuelEvidence, 'Strict Graveyard Types: Enabler'),
      payoffs: explicitRole('Graveyard-type rewards', 'graveyard-types-reward', graveyardTypesPayoffPattern, 'Strict Graveyard Types: Payoff'),
      glue: noRole('No generic glue', 'graveyard-types-no-glue'),
    },
  },
  {
    id: 'lifegain', name: 'Lifegain',
    description: 'Explicit life-gain effects feed cards that explicitly reward gaining life or a high life total.',
    nominationTags: ['lifegain', 'lifelink', 'lifegain-matters'],
    roles: {
      enablers: strictRole(
        'Life gain',
        'lifegain-source',
        (card) => card.keywords.includes('Lifelink') || textMatches(card, lifegainSourcePattern),
        (card) => card.keywords.includes('Lifelink') ? 'Keyword is Lifelink.' : explicitReason(card, lifegainSourcePattern),
        'Strict Lifegain: Enabler',
      ),
      payoffs: explicitRole('Lifegain rewards', 'lifegain-reward', lifegainPayoffPattern, 'Strict Lifegain: Payoff'),
      glue: noRole('No generic glue', 'lifegain-no-glue'),
    },
  },
];

export function strictRoleMatches(theme, card) {
  if (card.inactiveInCubeFormat) return [];
  const matches = [];
  for (const [roleName, config] of Object.entries(theme.roles)) {
    if (config.test(card)) matches.push({ role: roleName, label: config.label, ruleId: config.ruleId, reason: config.evidence(card), liveTag: config.liveTag });
  }
  return matches;
}

export function strictRoleReview(theme, card) {
  const matches = new Map(strictRoleMatches(theme, card).map((match) => [match.role, match]));
  return Object.entries(theme.roles).map(([role, config]) => {
    const match = matches.get(role);
    return match
      ? { role, assigned: true, ruleId: match.ruleId, label: match.label, evidence: match.reason }
      : {
          role,
          assigned: false,
          ruleId: config.ruleId,
          label: config.label,
          evidence: card.inactiveInCubeFormat
            ? 'Not assigned: the card is inactive under this cube format.'
            : 'Not assigned: this role rule found no qualifying type, numeric, keyword, or Oracle-text evidence.',
        };
  });
}

export function nominationMatches(theme, card) {
  return (theme.nominationTags ?? []).filter((tag) => card.oracleTags.includes(tag));
}

export function functionalRoleMatches(card) {
  const roles = [];
  if (
    textMatches(card, interactionPattern)
    || hasTag(card, 'removal', 'spot-removal', 'removal-*', 'counterspell*', 'bounce', 'tap-down', 'fight', 'discard-opponent')
  ) {
    roles.push({ id: 'interaction', label: 'Interaction', liveTag: 'Function: Interaction', reason: textMatches(card, interactionPattern) ? explicitReason(card, interactionPattern) : 'Scryfall classifies this card as removal, disruption, or tempo interaction.' });
  }
  if (
    textMatches(card, valuePattern)
    || hasTag(card, 'draw', 'pure-draw', 'card-advantage', 'cantrip', 'draw-engine', 'repeatable-draw', 'multiple-bodies', 'recursion-*', 'tutor-*')
  ) {
    roles.push({ id: 'value', label: 'Value', liveTag: 'Function: Value', reason: textMatches(card, valuePattern) ? explicitReason(card, valuePattern) : 'Scryfall classifies this card as card advantage, recursion, tutoring, or multiple material.' });
  }
  return roles;
}

export function normalizeCard(entry, board) {
  const details = entry.details ?? {};
  const type = String(details.type ?? '');
  const printedOracleText = String(details.oracle_text ?? '');
  const cubeOracleText = CUBE_RULES_OVERRIDES.get(details.name ?? '') ?? '';
  const creatureTypes = [];
  for (const face of type.split(' // ')) {
    const match = face.match(/(?:Creature|Kindred)[^—]*—\s*(.+)$/i);
    if (!match) continue;
    for (const subtype of match[1].trim().split(/\s+/)) if (subtype && !creatureTypes.includes(subtype)) creatureTypes.push(subtype);
  }
  const colors = [...(details.color_identity ?? [])].sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b));
  return {
    board,
    index: Number(entry.index),
    cardID: entry.cardID,
    scryfallId: details.scryfall_id ?? entry.cardID,
    oracleId: details.oracle_id ?? '',
    name: details.name ?? entry.cardID,
    fullName: details.full_name ?? details.name ?? entry.cardID,
    set: details.set ?? '',
    collectorNumber: details.collector_number ?? '',
    colors,
    colorLabel: colors.length ? colors.join('') : 'C',
    cmc: Number(details.cmc ?? 0),
    parsedCost: [...(details.parsed_cost ?? [])],
    type,
    oracleText: cubeOracleText || printedOracleText,
    printedOracleText,
    cubeOracleText,
    hasCubeOverride: Boolean(cubeOracleText),
    keywords: [...(details.keywords ?? [])].sort(),
    oracleTags: [...(details.oracle_tags ?? [])].sort(),
    artTags: [...(details.art_tags ?? [])].sort(),
    creatureTypes,
    power: String(details.power ?? ''),
    toughness: String(details.toughness ?? ''),
    rarity: details.rarity ?? '',
    layout: details.layout ?? 'normal',
    faceCount: details.image_flip || /\s\/\/\s/.test(String(details.full_name ?? '')) ? 2 : 1,
    imageFlip: details.image_flip ?? '',
    producedMana: [...(details.produced_mana ?? [])].sort(),
    image: details.image_normal ?? details.image_small ?? '',
    scryfallUri: details.scryfall_uri ?? '',
    elo: Number(details.elo ?? 0),
    pickCount: Number(details.pickCount ?? 0),
    popularity: Number(details.popularity ?? 0),
    cubeCount: Number(details.cubeCount ?? 0),
    releasedAt: String(details.released_at ?? ''),
    firstPrintYear: Number(details.firstPrintYear ?? String(details.released_at ?? '').slice(0, 4) ?? 0),
    edhrecRank: Number(details.edhrecRank ?? 0),
    isLand: /\bLand\b/i.test(type),
    existingTags: [...(entry.tags ?? [])].sort(),
  };
}

export function derivedLocalTags(card) {
  const tags = [
    ...card.oracleTags.map((tag) => `otag:${tag}`),
    ...card.artTags.map((tag) => `atag:${tag}`),
    ...card.creatureTypes.map((type) => `tribe:${type}`),
    `mv:${card.cmc}`,
  ];
  const power = numericPower(card);
  if (power !== null) tags.push(`power:${power}`);
  if (power !== null && power >= 4) tags.push('power:4+');
  if (card.cmc === 4) tags.push('mv:4-matters-input');
  if (card.cmc >= 4) tags.push('mv:4+');
  if (isBlinkPayoff(card)) tags.push('derived:etb-payoff');
  if (isBlinkEnabler(card)) tags.push('derived:blink-enabler');
  for (const adjacent of adjacentMechanicMatches(card)) tags.push(`derived:${adjacent.id}`);
  return [...new Set(tags)].sort();
}

export const taxonomyHelpers = {
  isCommanderOnly,
  isEtbReuse: isBlinkEnabler,
  isFlicker: (card) => textMatches(card, flickerPattern),
  isPermanentCopy: (card) => textMatches(card, permanentCopyPattern),
  isBattlefieldRecursion: (card) => textMatches(card, reanimatePattern) || textMatches(card, graveyardPermanentCastPattern) || textMatches(card, diesReturnPattern) || (isPermanent(card) && hasBlinkReturnKeyword(card)),
  isSelfBounce: (card) => textMatches(card, selfBouncePattern),
  adjacentMechanicMatches,
  hasEtbValue: isBlinkPayoff,
  isBlinkHardPayoff: isBlinkPayoff,
  isCounterEnabler: (card) => textMatches(card, ppCounterSourcePattern),
  isCounterPayoff: (card) => textMatches(card, ppCounterPayoffPattern),
  isTokenMaker: (card) => textMatches(card, tokenSourcePattern),
  isGoWidePayoff: (card) => textMatches(card, tokenPayoffPattern),
  mentionsInstantSorcery: (card) => /\binstant (?:or|and) sorcery\b|\binstant and\/or sorcery\b|\binstant\/sorcery\b/i.test(card.oracleText),
  hasAmbiguousPower: (card) => isCreature(card) && numericPower(card) === null && /[x*]/i.test(card.power),
};
