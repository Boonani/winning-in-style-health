import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const analysis = JSON.parse(await fs.readFile(path.join(root, 'outputs/analysis.json'), 'utf8'));
const cards = [...new Map(analysis.cards.filter(card => card.board === 'mainboard').map(card => [card.name, { name: card.name, image: card.image }])).values()].sort((a, b) => a.name.localeCompare(b.name));
await fs.writeFile(path.join(root, 'picks/cards.json'), JSON.stringify({ cubeVersion: analysis.cube.version, cards }) + '\n');
console.log(JSON.stringify({ cubeVersion: analysis.cube.version, uniqueCards: cards.length }));
