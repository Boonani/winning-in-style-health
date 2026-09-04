import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import streamJson from 'stream-json';
import streamArrayPackage from 'stream-json/streamers/StreamArray.js';

const { parser } = streamJson;
const { streamArray } = streamArrayPackage;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data', 'cubecobra-ml');
const cacheDir = path.join(dataDir, 'cache');
const outputPath = path.join(dataDir, 'cubecobra-adjacency.json');
const cubePath = path.join(cacheDir, 'cubes.json');
const mapPath = path.join(cacheDir, 'indexToOracleMap.json');
const dictPath = path.join(cacheDir, 'simpleCardDict.json');
const sourceMetadataPath = path.join(cacheDir, 'source-metadata.json');
const sourceRoot = 'https://cubecobra-public.s3.amazonaws.com/export';
const sources = {
  cubes: `${sourceRoot}/cubes.json`,
  indexToOracleMap: `${sourceRoot}/indexToOracleMap.json`,
  simpleCardDict: `${sourceRoot}/simpleCardDict.json`,
};
const minimumCubeSize = 180;
const maximumCubeSize = 1080;

async function download(name, url, filePath) {
  const response = await fetch(url, { headers: { 'User-Agent': 'WinningInStyleCubeHealth/1.0' } });
  if (!response.ok || !response.body) throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  const temporaryPath = `${filePath}.download`;
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporaryPath));
  await fsp.rename(temporaryPath, filePath);
  return {
    name,
    url,
    bytes: Number(response.headers.get('content-length')) || (await fsp.stat(filePath)).size,
    etag: response.headers.get('etag') ?? '',
    lastModified: response.headers.get('last-modified') ?? '',
  };
}

async function ensureSources(force) {
  await fsp.mkdir(cacheDir, { recursive: true });
  const files = [
    ['cubes', sources.cubes, cubePath],
    ['indexToOracleMap', sources.indexToOracleMap, mapPath],
    ['simpleCardDict', sources.simpleCardDict, dictPath],
  ];
  const existingMetadata = await fsp.readFile(sourceMetadataPath, 'utf8').then(JSON.parse).catch(() => ({ files: [] }));
  const metadataByName = new Map((existingMetadata.files ?? []).map((item) => [item.name, item]));
  for (const [name, url, filePath] of files) {
    const exists = await fsp.access(filePath).then(() => true).catch(() => false);
    if (force || !exists) metadataByName.set(name, await download(name, url, filePath));
  }
  const metadata = {
    downloadedAt: force ? new Date().toISOString() : existingMetadata.downloadedAt ?? null,
    files: files.map(([name, url, filePath]) => metadataByName.get(name) ?? ({
      name,
      url,
      bytes: fs.statSync(filePath).size,
      etag: '',
      lastModified: '',
    })),
  };
  await fsp.writeFile(sourceMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

async function build() {
  const force = process.argv.includes('--fetch');
  const sourceMetadata = await ensureSources(force);
  const [rawCube, indexToOracleMap, simpleCardDict] = await Promise.all([
    fsp.readFile(path.join(root, 'data', 'raw', 'cube.json'), 'utf8').then(JSON.parse),
    fsp.readFile(mapPath, 'utf8').then(JSON.parse),
    fsp.readFile(dictPath, 'utf8').then(JSON.parse),
  ]);

  const localByOracle = new Map();
  for (const entry of rawCube.cards?.mainboard ?? []) {
    const oracleId = entry.details?.oracle_id;
    if (!oracleId) continue;
    let local = localByOracle.get(oracleId);
    if (!local) {
      local = {
        oracleId,
        name: entry.details?.name ?? oracleId,
        image: entry.details?.image_normal ?? entry.details?.image_small ?? simpleCardDict[oracleId]?.image ?? '',
        type: entry.details?.type ?? simpleCardDict[oracleId]?.type ?? '',
        colors: entry.details?.color_identity ?? [],
        localCardIds: [],
      };
      localByOracle.set(oracleId, local);
    }
    local.localCardIds.push(`mainboard:${entry.index}`);
  }

  const cards = [...localByOracle.values()];
  const localIndexByOracle = new Map(cards.map((card, index) => [card.oracleId, index]));
  const cardCubeCounts = new Uint32Array(cards.length);
  const pairCounts = Array.from({ length: cards.length }, () => new Uint32Array(cards.length));
  let totalCubes = 0;
  let qualifyingCubes = 0;
  let droppedSmall = 0;
  let droppedLarge = 0;

  const cubeStream = fs.createReadStream(cubePath).pipe(parser()).pipe(streamArray());
  for await (const { value: cube } of cubeStream) {
    totalCubes += 1;
    const rawCards = Array.isArray(cube.cards) ? cube.cards : [];
    if (rawCards.length < minimumCubeSize) {
      droppedSmall += 1;
      continue;
    }
    if (rawCards.length > maximumCubeSize) {
      droppedLarge += 1;
      continue;
    }
    qualifyingCubes += 1;
    const present = new Set();
    for (const sourceIndex of rawCards) {
      const oracleId = indexToOracleMap[sourceIndex];
      const localIndex = localIndexByOracle.get(oracleId);
      if (localIndex !== undefined) present.add(localIndex);
    }
    const presentCards = [...present];
    for (const localIndex of presentCards) cardCubeCounts[localIndex] += 1;
    for (let left = 0; left < presentCards.length; left += 1) {
      const a = presentCards[left];
      for (let right = left + 1; right < presentCards.length; right += 1) {
        const b = presentCards[right];
        pairCounts[a][b] += 1;
        pairCounts[b][a] += 1;
      }
    }
    if (totalCubes % 25000 === 0) process.stdout.write(`Scanned ${totalCubes.toLocaleString()} cubes...\n`);
  }

  const generatedAt = new Date().toISOString();
  const output = {
    generatedAt,
    source: {
      name: 'CubeCobra quarterly public ML export',
      repository: 'https://github.com/dekkerglen/CubeCobraML',
      cubesUrl: sources.cubes,
      sourceLastModified: sourceMetadata.files.find((item) => item.name === 'cubes')?.lastModified ?? '',
      downloadedAt: sourceMetadata.downloadedAt,
      totalCubes,
      qualifyingCubes,
      droppedSmall,
      droppedLarge,
      minimumCubeSize,
      maximumCubeSize,
    },
    model: {
      candidatePool: 'Current Winning in Style mainboard cards with an Oracle ID.',
      pairLift: 'log10((pair co-cubes * qualifying cubes) / (anchor cubes * candidate cubes))',
      confidence: 'Displayed score multiplies pair log lift by pair co-cubes / (pair co-cubes + 20).',
      groupScore: 'Weighted mean of confidence-adjusted pair log lift across selected anchors.',
      zeroHandling: 'Pairs with no shared qualifying cube contribute zero and remain visible through anchor coverage.',
    },
    cards: cards.map((card, index) => ({ ...card, index, cubeCount: cardCubeCounts[index] })),
    pairCounts: pairCounts.map((row) => Array.from(row)),
  };
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(outputPath, `${JSON.stringify(output)}\n`);
  console.log(JSON.stringify({
    outputPath,
    generatedAt,
    uniqueCurrentCards: cards.length,
    totalCubes,
    qualifyingCubes,
    bytes: (await fsp.stat(outputPath)).size,
  }, null, 2));
}

build().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
