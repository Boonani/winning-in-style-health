import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

export const PRIMER_SCHEMA_VERSION = 1;
export const SCRYFALL_IMAGE_HOST = 'cards.scryfall.io';
export const CARD_GROUP_IDS = new Set([
  'section:removal',
  'section:blink',
  'section:mana', 'section:finish', 'plan:WUBRG',
  'plan:WU', 'plan:UB', 'plan:BR', 'plan:RG', 'plan:GW',
  'plan:WB', 'plan:UR', 'plan:BG', 'plan:WR', 'plan:UG',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR = /^[WUBRGC]$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9-]{0,31}$/i;

function fail(path, message) {
  throw new TypeError(`${path}: ${message}`);
}

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  return value;
}

function text(value, path, { max = 500, blank = false } = {}) {
  if (typeof value !== 'string') fail(path, 'expected plain text');
  if (value.length > max) fail(path, `must be ${max} characters or fewer`);
  if (!blank && !value.trim()) fail(path, 'must not be blank');
  if (/\0/.test(value)) fail(path, 'must not contain null bytes');
  return value;
}

function list(value, path, { min = 0, max = 50 } = {}) {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  if (value.length < min || value.length > max) fail(path, `expected ${min}–${max} items`);
  return value;
}

function card(value, path) {
  const source = object(value, path);
  if (!UUID.test(source.scryfallId ?? '')) fail(`${path}.scryfallId`, 'expected a Scryfall UUID');
  return {
    scryfallId: source.scryfallId.toLowerCase(),
    name: text(source.name, `${path}.name`, { max: 160 }),
    set: text(source.set, `${path}.set`, { max: 12 }).toLowerCase(),
    collectorNumber: text(source.collectorNumber, `${path}.collectorNumber`, { max: 24 }),
  };
}

function cards(value, path) {
  return list(value, path, { max: 60 }).map((entry, index) => card(entry, `${path}[${index}]`));
}

export function validatePrimerContent(value) {
  const source = object(value, 'content');
  if (source.schemaVersion !== PRIMER_SCHEMA_VERSION) fail('content.schemaVersion', `expected ${PRIMER_SCHEMA_VERSION}`);
  if (!Number.isSafeInteger(source.documentVersion) || source.documentVersion < 1) fail('content.documentVersion', 'expected a positive integer');
  const updatedAt = text(source.updatedAt, 'content.updatedAt', { max: 40 });
  if (Number.isNaN(Date.parse(updatedAt))) fail('content.updatedAt', 'expected an ISO date');
  const hero = object(source.hero, 'content.hero');
  const sections = list(source.sections, 'content.sections', { min: 7, max: 20 }).map((entry, index) => {
    const section = object(entry, `content.sections[${index}]`);
    const id = text(section.id, `content.sections[${index}].id`, { max: 32 });
    if (!IDENTIFIER.test(id)) fail(`content.sections[${index}].id`, 'expected a safe identifier');
    return {
      id,
      eyebrow: text(section.eyebrow, `content.sections[${index}].eyebrow`, { max: 80 }),
      heading: text(section.heading, `content.sections[${index}].heading`, { max: 120 }),
      body: list(section.body, `content.sections[${index}].body`, { min: 1, max: 12 })
        .map((line, lineIndex) => text(line, `content.sections[${index}].body[${lineIndex}]`, { max: 500, blank: id === 'blink' })),
      cards: cards(section.cards, `content.sections[${index}].cards`),
    };
  });
  const requiredSections = ['draft', 'removal', 'deck', 'curve', 'blink', 'plans', 'ready'];
  if (new Set(sections.map(section => section.id)).size !== sections.length) fail('content.sections', 'section IDs must be unique');
  for (const id of requiredSections) if (!sections.some(section => section.id === id)) fail('content.sections', `missing ${id}`);

  const plans = list(source.plans, 'content.plans', { min: 10, max: 11 }).map((entry, index) => {
    const plan = object(entry, `content.plans[${index}]`);
    const id = text(plan.id, `content.plans[${index}].id`, { max: 5 });
    if (!/^(WU|UB|BR|RG|GW|WB|UR|BG|WR|UG|WUBRG)$/.test(id)) fail(`content.plans[${index}].id`, 'expected a supported strategy');
    const colors = list(plan.colors, `content.plans[${index}].colors`, { min: id === 'WUBRG' ? 5 : 2, max: id === 'WUBRG' ? 5 : 2 });
    if (new Set(colors).size !== colors.length || [...id].some(color => !colors.includes(color))) fail(`content.plans[${index}].colors`, 'colors must match strategy');
    if (colors.some(value => typeof value !== 'string' || !COLOR.test(value))) fail(`content.plans[${index}].colors`, 'expected mana-color letters');
    return {
      id,
      guild: text(plan.guild, `content.plans[${index}].guild`, { max: 40 }),
      name: text(plan.name, `content.plans[${index}].name`, { max: 80 }),
      colors,
      body: text(plan.body, `content.plans[${index}].body`, { max: 300 }),
      cards: cards(plan.cards, `content.plans[${index}].cards`),
    };
  });
  if (new Set(plans.map(plan => plan.id)).size !== plans.length) fail('content.plans', 'plan IDs must be unique');

  const sources = list(source.sources, 'content.sources', { max: 12 }).map((entry, index) => {
    const sourceEntry = object(entry, `content.sources[${index}]`);
    const url = text(sourceEntry.url, `content.sources[${index}].url`, { max: 500 });
    let parsed;
    try { parsed = new URL(url); } catch { fail(`content.sources[${index}].url`, 'expected an absolute URL'); }
    if (parsed.protocol !== 'https:') fail(`content.sources[${index}].url`, 'only HTTPS sources are allowed');
    return { label: text(sourceEntry.label, `content.sources[${index}].label`, { max: 100 }), url };
  });

  const printingProvenance = list(source.printingProvenance, 'content.printingProvenance', { max: 30 }).map((entry, index) => {
    const p = object(entry, `content.printingProvenance[${index}]`);
    return {
      purpose: text(p.purpose, `content.printingProvenance[${index}].purpose`, { max: 100 }),
      name: text(p.name, `content.printingProvenance[${index}].name`, { max: 160 }),
      scryfallId: card({ ...p, collectorNumber: p.collectorNumber }, `content.printingProvenance[${index}]`).scryfallId,
      set: text(p.set, `content.printingProvenance[${index}].set`, { max: 12 }).toLowerCase(),
      collectorNumber: text(p.collectorNumber, `content.printingProvenance[${index}].collectorNumber`, { max: 24 }),
      releasedAt: text(p.releasedAt, `content.printingProvenance[${index}].releasedAt`, { max: 20 }),
      language: text(p.language, `content.printingProvenance[${index}].language`, { max: 12 }),
      oracleText: text(p.oracleText, `content.printingProvenance[${index}].oracleText`, { max: 1000 }),
      scryfallUri: text(p.scryfallUri, `content.printingProvenance[${index}].scryfallUri`, { max: 500 }),
      consultedAt: text(p.consultedAt, `content.printingProvenance[${index}].consultedAt`, { max: 40 }),
      reason: text(p.reason, `content.printingProvenance[${index}].reason`, { max: 300 }),
    };
  });

  return {
    schemaVersion: PRIMER_SCHEMA_VERSION,
    documentVersion: source.documentVersion,
    updatedAt,
    hero: {
      eyebrow: text(hero.eyebrow, 'content.hero.eyebrow', { max: 80 }),
      title: text(hero.title, 'content.hero.title', { max: 120 }),
      lede: text(hero.lede, 'content.hero.lede', { max: 300 }),
    },
    sections,
    plans,
    checklist: list(source.checklist, 'content.checklist', { min: 1, max: 12 })
      .map((line, index) => text(line, `content.checklist[${index}]`, { max: 180 })),
    sources,
    printingProvenance,
  };
}

export function scryfallImageUrl(scryfallId, size = 'normal') {
  if (!UUID.test(scryfallId ?? '')) fail('scryfallId', 'expected a Scryfall UUID');
  if (!['small', 'normal', 'large'].includes(size)) fail('size', 'unsupported Scryfall image size');
  const id = scryfallId.toLowerCase();
  return `https://${SCRYFALL_IMAGE_HOST}/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;
}

export function primerRevision(serialized) {
  const bytes = typeof serialized === 'string' || Buffer.isBuffer(serialized)
    ? serialized
    : `${JSON.stringify(serialized, null, 2)}\n`;
  return createHash('sha256').update(bytes).digest('hex');
}

export async function loadPrimerContent(file) {
  const serialized = await fs.readFile(file, 'utf8');
  return { content: validatePrimerContent(JSON.parse(serialized)), revision: primerRevision(serialized), serialized };
}

export function serializePrimerContent(content) {
  return `${JSON.stringify(validatePrimerContent(content), null, 2)}\n`;
}
