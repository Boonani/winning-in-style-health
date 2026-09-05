const clean = (card) => String(card.oracleText ?? '').replace(/\([^()]*\)/g, ' ');
const clauses = (card) => clean(card).split(/\n|(?<=\.)\s+/).map((s) => s.trim());
const creature = (card) => /\bCreature\b/.test(card.type ?? '');

// Aristocrats needs expendable bodies and a way to cash those bodies in, not any permanent that can die.
export function creatureSacrificeOutlet(card) {
  return clauses(card).find((line) => {
    if (!/\bsacrifice (?:another|a|an|one or more|any number of|two|three|x) (?:(?:other|nontoken|token|attacking|untapped|legendary|white|blue|black|red|green|multicolored|colorless|artifact) )*creatures?\b/i.test(line)) return false;
    return /sacrifice[^:]*:/i.test(line) || /as an additional cost to cast/i.test(line) || /you may sacrifice/i.test(line);
  }) ?? '';
}

export function creatureDeathReward(card) {
  return clauses(card).find((line) => {
    const trigger = line.split(',')[0];
    if (!/^(?:when|whenever)\b/i.test(trigger)) return false;
    if (/opponent (?:controls|sacrifices)|opponent's/i.test(trigger)) return false;
    return /(?:another|other|a|an|one or more) (?:(?:attacking|blocking|nontoken|token|artifact) )?creatures?[^,]{0,90}\b(?:dies|die|is put|are put|is sacrificed|are sacrificed)\b/i.test(trigger)
      || /(?:a|an) (?:artifact or creature|creature or artifact)[^,]{0,90}(?:dies|die|is put|are put)/i.test(trigger)
      || /(?:you sacrifice|you sacrificed) (?:another |a |one or more )?creature/i.test(trigger);
  }) ?? '';
}

export function aristocratsFodder(card) {
  if (!Number.isFinite(card.cmc) || card.cmc > 3) return '';
  const text = clean(card);
  if (creature(card) && /\b(?:Persist|Undying|Afterlife)\b/i.test([...(card.keywords ?? []), text].join(' '))) return 'Low-cost body with its own return or replacement-body ability.';
  if (creature(card) && /return (?:this card|this creature|it) from your graveyard to the battlefield|you may cast (?:this spell|this card) from your graveyard/i.test(text)) return 'Low-cost body can return or be cast again from the graveyard; its stated costs still apply.';
  if (creature(card) && (card.keywords ?? []).includes('Fabricate')) return 'Low-cost Fabricate creature can supply an additional Servo body.';
  if (creature(card) && /when (?:this creature|[A-Z][^,\n]{0,60}) dies,[^.]{0,100}draw a card/i.test(text)) return 'Low-cost body replaces itself with a card when it dies.';
  const body = clauses(card).find((line) => {
    if (/whenever you cast your second spell/i.test(text)) return false;
    if (!/create[^.]{0,120}\b(?:0\/1|1\/1|1\/2|2\/1|2\/2)\b[^.]{0,100}creature tokens?/i.test(line)) return false;
    if (/sacrifice|exile[^.]{0,60}graveyard|whenever[^,]{0,100}(?:deals|attacks|casts|cast)/i.test(line)) return false;
    const recurring = /(?:at the beginning of|whenever[^,]{0,100}(?:dies|die))|^[^:]+:/i.test(line);
    const multiple = /create (?:two|three|four|x)\b/i.test(line);
    const extraBody = creature(card) && /when[^,]{0,100}(?:enters|dies)/i.test(line);
    return recurring || multiple || extraBody;
  });
  return body ? `Low-cost replacement or small-body supply: "${body}"` : '';
}

export function earlyScalingPower(card) {
  const fixed = earlyPowerInput(card);
  if (fixed) return fixed;
  if (creature(card) && card.cmc <= 2 && /\*/.test(card.power ?? '') && /power (?:is|are) equal to|power and toughness are each equal to/i.test(clean(card))) return 'Low-cost scaling power, conditional on the stated board or graveyard count; not guaranteed four-power support.';
  return '';
}

export function earlyPowerInput(card) {
  if (/isn't a creature|is not a creature|when[^\n,]*enters,[^\n.]*sacrifice (?:it|this creature)/i.test(clean(card))) return '';
  const power = /^\d+$/.test(card.power ?? '') ? Number(card.power) : null;
  if (creature(card) && card.cmc >= 0 && card.cmc <= 3 && power !== null && power >= 4 && power > card.cmc) {
    return `Early printed rate: ${power} power for mana value ${card.cmc}. Casting restrictions and board conditions still apply.`;
  }
  if (card.cmc >= 0 && card.cmc <= 3) {
    const line = clauses(card).find((s) => /\bcreate[^.]{0,100}\b(?:4\/4|5\/5|6\/6|7\/7|8\/8|9\/9|10\/10)\b[^.]{0,80}creature token/i.test(s)
      && !/[:]|\b(?:when|whenever|if|at the beginning|for each|sacrifice|exile)\b/i.test(s));
    if (line) return `Early large-body spell, mana value ${card.cmc}: "${line}"`;
  }
  return '';
}
