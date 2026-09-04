import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { parse } from 'csv-parse';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'data', '17lands', 'game_data_public.Cube_-_Powered.PremierDraft.csv.gz');
const draftSourcePath = path.join(root, 'data', '17lands', 'draft_data_public.Cube_-_Powered.PremierDraft.csv.gz');
const outputPath = path.join(root, 'data', '17lands', 'powered-cube-ratings.json');
const minGamesInHand = 250;

const normalizeName = (value) => String(value ?? '').split(' // ')[0].trim().toLowerCase();
const round = (value, digits = 4) => Number(value.toFixed(digits));

function gradeForZ(z) {
  const scale = [
    [1.98, 'A+'], [1.65, 'A'], [1.32, 'A-'], [0.99, 'B+'], [0.66, 'B'], [0.33, 'B-'],
    [0.165, 'C+'], [-0.165, 'C'], [-0.495, 'C-'], [-0.825, 'D+'], [-1.155, 'D'], [-1.485, 'D-'],
  ];
  return scale.find(([minimum]) => z >= minimum)?.[1] ?? 'F';
}

async function analyzeDraftData() {
  await fsp.access(draftSourcePath);
  const parser = fs.createReadStream(draftSourcePath).pipe(zlib.createGunzip()).pipe(parse({ bom: true, relax_column_count: true }));
  let headers;
  let draftIndex;
  let packIndex;
  let pickNumberIndex;
  let pickIndex;
  let packCards;
  let activeGroup = '';
  let lastSeen = new Map();
  let rows = 0;
  const stats = new Map();
  const statFor = (name) => {
    const entry = stats.get(name) ?? { seenCount: 0, lastSeenSum: 0, pickCount: 0, pickNumberSum: 0 };
    stats.set(name, entry);
    return entry;
  };
  const finishGroup = () => {
    for (const [name, pickNumber] of lastSeen) {
      const stat = statFor(name);
      stat.seenCount += 1;
      stat.lastSeenSum += pickNumber;
    }
    lastSeen = new Map();
  };

  for await (const row of parser) {
    if (!headers) {
      headers = row;
      draftIndex = headers.indexOf('draft_id');
      packIndex = headers.indexOf('pack_number');
      pickNumberIndex = headers.indexOf('pick_number');
      pickIndex = headers.indexOf('pick');
      packCards = headers.map((header, index) => ({ header, index })).filter(({ header }) => header.startsWith('pack_card_')).map(({ header, index }) => ({ name: header.slice('pack_card_'.length), index }));
      if ([draftIndex, packIndex, pickNumberIndex, pickIndex].some((index) => index < 0)) throw new Error('17Lands draft dataset is missing required pick columns');
      continue;
    }
    rows += 1;
    const group = `${row[draftIndex]}:${row[packIndex]}`;
    if (activeGroup && group !== activeGroup) finishGroup();
    activeGroup = group;
    const pickNumber = (Number(row[pickNumberIndex]) || 0) + 1;
    const picked = row[pickIndex];
    if (picked) {
      const stat = statFor(picked);
      stat.pickCount += 1;
      stat.pickNumberSum += pickNumber;
    }
    for (const card of packCards) if ((Number(row[card.index]) || 0) > 0) lastSeen.set(card.name, pickNumber);
  }
  finishGroup();
  return { rows, stats };
}

async function main() {
  await fsp.access(sourcePath);
  const draftDataPromise = analyzeDraftData();
  const parser = fs.createReadStream(sourcePath).pipe(zlib.createGunzip()).pipe(parse({ bom: true, relax_column_count: true }));
  let headers;
  let wonIndex;
  let cardColumns;
  let rows = 0;

  for await (const row of parser) {
    if (!headers) {
      headers = row;
      wonIndex = headers.indexOf('won');
      if (wonIndex < 0) throw new Error('17Lands game dataset has no won column');
      const byName = new Map();
      for (let index = 0; index < headers.length; index += 1) {
        const match = headers[index].match(/^(opening_hand|drawn|tutored|deck)_(.+)$/);
        if (!match) continue;
        const [, kind, name] = match;
        const entry = byName.get(name) ?? { name, opening: -1, drawn: -1, tutored: -1, deck: -1, gameCount: 0, gameWins: 0, gihCount: 0, gihWins: 0, gnsCount: 0, gnsWins: 0 };
        entry[kind === 'opening_hand' ? 'opening' : kind] = index;
        byName.set(name, entry);
      }
      cardColumns = [...byName.values()].filter((card) => card.opening >= 0 && card.drawn >= 0 && card.deck >= 0);
      continue;
    }

    rows += 1;
    const wonValue = String(row[wonIndex]).toLowerCase();
    const won = wonValue === 'true' || wonValue === '1' ? 1 : 0;
    for (const card of cardColumns) {
      const opening = Number(row[card.opening]) || 0;
      const drawn = Number(row[card.drawn]) || 0;
      const tutored = card.tutored >= 0 ? Number(row[card.tutored]) || 0 : 0;
      const deck = Number(row[card.deck]) || 0;
      if (!deck && !opening && !drawn) continue;
      const inHand = opening + drawn;
      const notSeen = Math.max(0, deck - Math.min(deck, inHand + tutored));
      card.gameCount += deck;
      card.gameWins += deck * won;
      card.gihCount += inHand;
      card.gihWins += inHand * won;
      card.gnsCount += notSeen;
      card.gnsWins += notSeen * won;
    }
  }

  const ratings = cardColumns.map((card) => ({
    name: card.name,
    normalizedName: normalizeName(card.name),
    gameCount: card.gameCount,
    gameWinRate: card.gameCount ? card.gameWins / card.gameCount : null,
    gamesInHand: card.gihCount,
    gihWinRate: card.gihCount ? card.gihWins / card.gihCount : null,
    gamesNotSeen: card.gnsCount,
    gnsWinRate: card.gnsCount ? card.gnsWins / card.gnsCount : null,
    improvementInHand: card.gihCount && card.gnsCount ? card.gihWins / card.gihCount - card.gnsWins / card.gnsCount : null,
  }));
  const draftData = await draftDataPromise;
  for (const card of ratings) {
    const draft = draftData.stats.get(card.name);
    card.seenCount = draft?.seenCount ?? 0;
    card.avgSeen = draft?.seenCount ? round(draft.lastSeenSum / draft.seenCount, 2) : null;
    card.pickCount = draft?.pickCount ?? 0;
    card.avgPick = draft?.pickCount ? round(draft.pickNumberSum / draft.pickCount, 2) : null;
  }
  const qualified = ratings.filter((card) => card.gamesInHand >= minGamesInHand && card.gihWinRate !== null);
  const mean = qualified.reduce((sum, card) => sum + card.gihWinRate, 0) / qualified.length;
  const standardDeviation = Math.sqrt(qualified.reduce((sum, card) => sum + (card.gihWinRate - mean) ** 2, 0) / qualified.length);
  const sorted = [...qualified].sort((a, b) => a.gihWinRate - b.gihWinRate);
  for (const card of ratings) {
    card.sufficientSample = card.gamesInHand >= minGamesInHand;
    if (!card.sufficientSample || card.gihWinRate === null) {
      card.score = null;
      card.grade = null;
      card.zScore = null;
    } else {
      const belowOrEqual = sorted.filter((entry) => entry.gihWinRate <= card.gihWinRate).length;
      card.score = Math.round((100 * belowOrEqual) / sorted.length);
      card.zScore = round((card.gihWinRate - mean) / standardDeviation, 3);
      card.grade = gradeForZ(card.zScore);
    }
    for (const key of ['gameWinRate', 'gihWinRate', 'gnsWinRate', 'improvementInHand']) if (card[key] !== null) card[key] = round(card[key]);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    source: {
      provider: '17Lands',
      dataset: 'Powered Cube PremierDraft game data',
      url: 'https://17lands-public.s3.amazonaws.com/analysis_data/game_data/game_data_public.Cube_-_Powered.PremierDraft.csv.gz',
      catalog: 'https://www.17lands.com/public_datasets',
      license: 'CC BY 4.0',
      lastModified: '2025-12-01T04:03:09Z',
      rows,
      draftRows: draftData.rows,
      minGamesInHand,
      meanGihWinRate: round(mean),
      standardDeviation: round(standardDeviation),
    },
    ratings: ratings.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name)),
  };
  await fsp.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, gameRows: rows, draftRows: draftData.rows, cards: ratings.length, qualified: qualified.length, meanGihWinRate: result.source.meanGihWinRate }, null, 2));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
