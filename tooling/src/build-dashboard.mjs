import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDashboard } from './dashboard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployRoot = path.resolve(root, process.env.DASHBOARD_DEPLOY_DIR ?? 'deploy-site');
const analysis = JSON.parse(await fs.readFile(path.join(root, 'outputs', 'analysis.json'), 'utf8'));
const expectedHtml = renderDashboard(analysis);
const adjacencySource = path.join(root, 'data', 'cubecobra-ml', 'cubecobra-adjacency.json');
const adjacencyDeploy = path.join(deployRoot, 'data', 'cubecobra-adjacency.json');
const manaSymbols = ['W', 'U', 'B', 'R', 'G', 'C'];
const checkOnly = process.argv.includes('--check');

if (checkOnly) await fs.access(deployRoot);
else await fs.mkdir(deployRoot, { recursive: true });

if (checkOnly) {
  const [standalone, deployed, sourceAdjacency, deployedAdjacency] = await Promise.all([
    fs.readFile(path.join(root, 'dashboard.html'), 'utf8'),
    fs.readFile(path.join(deployRoot, 'index.html'), 'utf8'),
    fs.readFile(adjacencySource),
    fs.readFile(adjacencyDeploy),
  ]);
  assert.equal(standalone, expectedHtml, 'dashboard.html does not match src/dashboard.mjs and outputs/analysis.json');
  assert.equal(deployed, expectedHtml, 'deploy-site/index.html does not match the verified standalone dashboard');
  assert.deepEqual(deployedAdjacency, sourceAdjacency, 'Deployed CubeCobra adjacency matrix is stale');
  for (const symbol of manaSymbols) {
    const [source, deployedAsset] = await Promise.all([
      fs.readFile(path.join(root, 'assets', 'mana', `${symbol}.svg`)),
      fs.readFile(path.join(deployRoot, 'assets', 'mana', `${symbol}.svg`)),
    ]);
    assert.deepEqual(deployedAsset, source, `Deployed ${symbol} mana symbol is stale`);
  }
} else {
  await fs.mkdir(path.join(deployRoot, 'assets', 'mana'), { recursive: true });
  await fs.mkdir(path.join(deployRoot, 'data'), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(root, 'dashboard.html'), expectedHtml),
    fs.writeFile(path.join(deployRoot, 'index.html'), expectedHtml),
    fs.copyFile(adjacencySource, adjacencyDeploy),
    ...manaSymbols.map((symbol) => fs.copyFile(
      path.join(root, 'assets', 'mana', `${symbol}.svg`),
      path.join(deployRoot, 'assets', 'mana', `${symbol}.svg`),
    )),
  ]);
}

console.log(JSON.stringify({
  verified: true,
  mode: checkOnly ? 'check' : 'write',
  cubeVersion: analysis.cube.version,
  bytes: Buffer.byteLength(expectedHtml),
  artifacts: ['dashboard.html', 'deploy-site/index.html', 'deploy-site/assets/mana/*.svg', 'deploy-site/data/cubecobra-adjacency.json'],
}, null, 2));
