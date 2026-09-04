import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'data', 'research', 'scryfall-candidates.json');
const userAgent = 'WinningInStyleCubeHealth/1.1 (+https://cubecobra.com/cube/about/style)';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const searches = [
  {
    id: 'ur-artifact-payoffs',
    label: 'UR artifact payoff candidates',
    query: 'game:paper id<=UR (otag:artifactfall or otag:affinity-for-artifacts)',
  },
  {
    id: 'gw-enchantress-payoffs',
    label: 'GW Enchantress payoff candidates',
    query: 'game:paper id<=WG (otag:enchantmentfall or otag:enchantment-engine)',
  },
  {
    id: 'rg-power-four-payoffs',
    label: 'RG Power 4+ payoff candidates',
    query: 'game:paper id<=RG (o:"power 4 or greater" or keyword:ferocious)',
  },
  {
    id: 'rg-power-matters-payoffs',
    label: 'RG Power Matters payoff candidates',
    query: 'game:paper id<=RG (o:"equal to its power" or o:"equal to that creature\'s power" or o:"equal to the greatest power" or o:"where X is the greatest power")',
  },
  {
    id: 'ug-counter-payoffs',
    label: 'UG +1/+1 Counter payoff candidates',
    query: 'game:paper id<=UG o:"+1/+1 counter" (o:"for each" or o:"would be put" or o:"with a +1/+1 counter" or keyword:proliferate)',
  },
  {
    id: 'ug-landfall-payoffs',
    label: 'UG Landfall payoff candidates',
    query: 'game:paper id<=UG (keyword:landfall or o:"whenever a land you control enters")',
  },
  {
    id: 'gw-counter-payoffs',
    label: 'GW +1/+1 Counter payoff candidates',
    query: 'game:paper id<=WG o:"+1/+1 counter" (o:"for each" or o:"would be put" or o:"with a +1/+1 counter" or keyword:proliferate)',
  },
];

const precedents = [
  { set: 'Khans of Tarkir and Fate Reforged', finding: 'Temur Ferocious checks for power 4 or greater.', url: 'https://magic.wizards.com/en/news/feature/mechanics-khans-tarkir' },
  { set: 'Theros Beyond Death', finding: 'RG smooth ramp and big creatures were reinforced by a 4-power theme.', url: 'https://magic.wizards.com/en/news/making-magic/nuts-bolts-12-part-2-limited-themes-2020-03-16' },
  { set: 'Outlaws of Thunder Junction', finding: 'RG ramp rewards creatures with power 4 or greater.', url: 'https://magic.wizards.com/en/news/making-magic/outlaws-of-thunder-junction-vision-design-handoff-document-part-2' },
  { set: 'Commander Masters', finding: 'RG Power Matters was an explicit draft synergy cluster.', url: 'https://magic.wizards.com/en/news/making-magic/chain-of-commander-masters' },
];

async function fetchSearch(search) {
  let url = `https://api.scryfall.com/cards/search?${new URLSearchParams({ q: search.query, unique: 'cards', order: 'edhrec' })}`;
  const cards = [];
  while (url) {
    const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json;q=0.9,*/*;q=0.8' } });
    if (!response.ok) throw new Error(`Scryfall ${search.id} failed: ${response.status} ${response.statusText}`);
    const page = await response.json();
    cards.push(...page.data.map((card) => ({
      id: card.id,
      oracleId: card.oracle_id,
      name: card.name,
      colors: card.color_identity ?? [],
      manaValue: card.cmc,
      type: card.type_line,
      oracleText: card.oracle_text ?? card.card_faces?.map((face) => face.oracle_text).filter(Boolean).join('\n//\n') ?? '',
      scryfallUri: card.scryfall_uri,
      image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? '',
      edhrecRank: card.edhrec_rank ?? null,
      releasedAt: card.released_at,
    })));
    url = page.has_more ? page.next_page : null;
    if (url) await delay(150);
  }
  return { ...search, cards };
}

async function main() {
  const results = [];
  for (const search of searches) {
    results.push(await fetchSearch(search));
    await delay(150);
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'https://scryfall.com/docs/api', precedents, searches: results }, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, searches: results.map((result) => ({ id: result.id, cards: result.cards.length })) }, null, 2));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
