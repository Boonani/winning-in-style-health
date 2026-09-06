import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDesignedModel } from './designed-archetypes.mjs';
import { scryfallImageUrl, validatePrimerContent } from './primer-content.mjs';
import { siteMotionCSS, siteMotionMarkup } from './site-motion.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PRIMER_CONTENT = validatePrimerContent(JSON.parse(
  fs.readFileSync(path.join(here, '..', 'data', 'primer-content.json'), 'utf8'),
));

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

export function primerCards(data, lane) {
  const byId = new Map(data.cards.map(card => [card.id, card]));
  const preferred = lane.examples
    .map(name => data.cards.find(card => card.board === 'mainboard' && card.name === name))
    .filter(card => card && lane.pair.union.includes(card.id));
  const ranked = ids => ids.map(id => byId.get(id)).filter(Boolean)
    .sort((a, b) => (b.quality?.score || 0) - (a.quality?.score || 0));
  return [...new Map([...preferred, ...ranked(lane.pair.payoffs), ...ranked(lane.pair.enablers)]
    .map(card => [card.id, card])).values()].slice(0, 3);
}

export function orderedPrimerLanes(data) {
  const lanes = buildDesignedModel(data).lanes;
  return [lanes[0], ...lanes.slice(1).sort((a, b) =>
    b.pair.payoffs.length / Math.max(1, b.pair.pairPool) - a.pair.payoffs.length / Math.max(1, a.pair.pairPool))];
}

export function renderCubeCobraPrimer(data, input = DEFAULT_PRIMER_CONTENT) {
  const content = validatePrimerContent(input);
  return [
    '# Winning in Style',
    'Big plays. Shared synergies. Flashy finishes.',
    'Commander-style stories in a normal draft. No commanders required.',
    '**First draft?** [Open the visual primer](https://cube.coolasheck.com/draft-primer.html). [Cube health](https://cube.coolasheck.com/) shows exact support.',
    '## Draft in four moves',
    '**Pick one. Pass the rest.**',
    '**Draft interaction.** ' + content.sections.find(section => section.id === 'removal').body[0],
    '**Start with two colors.** Branch when supported.',
    '**Build 40 cards.** Start near 17 lands.',
    '## Pick a plan',
    ...content.plans.flatMap(plan => [
      `### ${plan.colors.map(color => `{${color}}`).join('')} ${plan.guild} / ${plan.name}`,
      plan.body,
      `<<${plan.cards.map(card => `[[!${card.name}|${card.scryfallId}]]`).join('')}>>`,
    ]),
    '## Stay flexible',
    'Shared cards keep several plans open.',
  ].join('\n\n') + '\n';
}

const cardFigure = card => `<figure class="primer-card" data-motion>
  <img src="${esc(scryfallImageUrl(card.scryfallId))}" alt="${esc(card.name)}" loading="lazy" decoding="async">
  <figcaption><strong>${esc(card.name)}</strong><span>${esc(card.set.toUpperCase())} · ${esc(card.collectorNumber)}</span></figcaption>
</figure>`;

const paragraphs = lines => lines.filter(Boolean).map(line => `<p>${esc(line)}</p>`).join('');
const sectionById = (content, id) => content.sections.find(section => section.id === id);
const sectionHead = section => `<div class="section-head" data-motion><span>${esc(section.eyebrow)}</span><h2>${esc(section.heading)}</h2></div>`;
const gallery = cards => `<div class="card-gallery">${cards.map(cardFigure).join('')}</div>`;

export function renderDraftPrimer(data, input = DEFAULT_PRIMER_CONTENT) {
  const content = validatePrimerContent(input);
  const draft = sectionById(content, 'draft');
  const removal = sectionById(content, 'removal');
  const deck = sectionById(content, 'deck');
  const curve = sectionById(content, 'curve');
  const blink = sectionById(content, 'blink');
  const plans = sectionById(content, 'plans');
  const ready = sectionById(content, 'ready');
  const colors = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
  const deckCells = Array.from({ length: 40 }, (_, index) =>
    `<i class="${index < 17 ? 'land' : index < 32 ? 'creature' : 'spell'}" aria-hidden="true"></i>`).join('');
  const curveBars = [1, 5, 4, 3, 1, 1].map((count, index) =>
    `<div><strong>${count}</strong><i data-motion-bar style="--bar:${count / 5}"></i><span>${index === 5 ? '6+' : index + 1}</span></div>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#090c12">
  <title>First Draft · Winning in Style</title>
  <style>
    :root {color-scheme:dark;--paper:#090c12;--ink:#f7f8fa;--muted:#a9b1bd;--line:#29313d;--blue:#7db8ff;--mint:#74d7b0;--gold:#f0c66f;--violet:#b9a4ff;--gutter:max(22px,env(safe-area-inset-left));}
    * {box-sizing:border-box;letter-spacing:0}
    html {-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth}
    body {margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif}
    a {color:var(--blue);text-underline-offset:4px}
    a:focus-visible,summary:focus-visible,input:focus-visible {outline:3px solid var(--blue);outline-offset:4px}
    header,main {width:min(100%,800px);margin:auto;padding-inline:max(22px,env(safe-area-inset-left),env(safe-area-inset-right))}
    header {min-height:64px;padding-top:max(10px,env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line)}
    header strong {font-size:14px;letter-spacing:0}
    header a {min-height:44px;display:inline-flex;align-items:center;font-size:14px}
    main {padding-bottom:max(42px,env(safe-area-inset-bottom))}
    .hero {padding:64px 0 58px}
    .hero span,.section-head span {display:block;color:var(--mint);font-size:12px;font-weight:780;letter-spacing:0}
    h1 {font-size:64px;line-height:.98;letter-spacing:0;margin:14px 0 20px;max-width:680px}
    .hero p {font-size:24px;color:var(--muted);margin:0}
    section {position:relative;border-top:1px solid var(--line);padding:50px 0 58px}
    .section-head {margin-bottom:26px}
    h2 {font-size:36px;line-height:1.08;letter-spacing:0;margin:10px 0 0}
    p {max-width:610px;margin:14px 0;color:#d8dde5}
    .prompts {display:grid;gap:0;border-top:1px solid var(--line);margin-top:28px}
    .prompts p {max-width:none;margin:0;padding:14px 0;border-bottom:1px solid var(--line)}
    #removal .section-head span {color:var(--gold)}
    #deck .section-head span {color:var(--blue)}
    #curve .section-head span {color:var(--violet)}
    #blink .section-head span {color:var(--mint)}
    .draft-flow {display:grid;grid-template-columns:1fr;margin:8px 0 26px;border-top:1px solid var(--line)}
    .draft-flow div {display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;min-height:70px;border-bottom:1px solid var(--line)}
    .draft-flow small {color:var(--muted);font-size:12px}
    .draft-flow strong {font-size:18px}
    .draft-flow b {color:var(--blue);font-size:22px}
    .card-gallery {display:grid;grid-template-columns:minmax(0,1fr);gap:34px;width:min(100%,560px);margin:26px 0 30px}
    .primer-card {margin:0;min-width:0}
    .primer-card img {display:block;width:100%;height:auto;aspect-ratio:488/680;object-fit:contain;background:#111722;border-radius:0;box-shadow:0 18px 60px rgba(0,0,0,.34)}
    .primer-card figcaption {display:flex;justify-content:space-between;gap:14px;padding:9px 2px 0;font-size:13px}
    .primer-card figcaption span {color:var(--muted);font-size:11px;text-transform:uppercase;white-space:nowrap}
    .deck {display:grid;grid-template-columns:repeat(10,1fr);gap:5px;margin:22px 0 17px;max-width:560px}
    .deck i {aspect-ratio:5/7;background:var(--blue)}
    .deck .land {background:var(--mint)}.deck .spell {background:var(--gold)}
    .legend {display:flex;flex-wrap:wrap;gap:16px;color:var(--muted);font-size:13px}
    .legend i {display:inline-block;width:11px;height:11px;margin-right:7px;background:var(--color)}
    .curve {height:210px;display:grid;grid-template-columns:repeat(6,1fr);align-items:end;gap:10px;margin:24px 0 18px;max-width:610px}
    .curve div {height:100%;display:grid;grid-template-rows:22px 1fr 26px;align-items:end;text-align:center;font-size:12px;color:var(--muted)}
    .curve strong {color:var(--ink)}
    .curve i {display:block;height:calc(var(--bar) * 100%);min-height:2px;background:linear-gradient(to top,var(--violet),var(--blue));transform-origin:bottom}
    .curve span::after {content:' mana';font-size:10px}
    .plans {border-top:1px solid var(--line)}
    details {border-bottom:1px solid var(--line)}
    summary {min-height:76px;padding:16px 0;cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;gap:13px;align-items:center;list-style:none}
    summary::-webkit-details-marker {display:none}
    summary::after {content:'+';font-size:24px;color:var(--muted)}
    details[open]>summary::after {content:'−'}
    .pips {display:flex;gap:3px}
    .pips img {width:24px;height:24px;border-radius:50%}
    .plan-title strong,.plan-title small {display:block}
    .plan-title small {color:var(--muted);font-size:12px;margin-top:2px}
    .plan-body {padding:0 0 34px}
    .plan-body .card-gallery {margin-top:8px}
    .plan-body p {margin-top:22px}
    .checklist {display:grid;border-top:1px solid var(--line);margin-top:24px}
    .checklist label {display:flex;align-items:center;gap:13px;min-height:58px;border-bottom:1px solid var(--line)}
    .checklist input {width:22px;height:22px;accent-color:var(--mint)}
    footer {padding:34px 0 10px;color:var(--muted)}
    footer details {border:0}
    footer summary {min-height:56px}
    .source-list {display:grid;gap:2px;padding-bottom:18px}
    .source-list a {min-height:44px;display:flex;align-items:center}
    footer>small {display:block;margin-top:18px}
${siteMotionCSS.trim()}
    @media (max-width:900px) {
      .card-gallery {width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);gap:30px}
      .primer-card figcaption {padding-inline:var(--gutter)}
      .plan-body .card-gallery {margin-top:8px}
    }
    @media (max-width:620px) {
      :root {--gutter:max(20px,env(safe-area-inset-left),env(safe-area-inset-right))}
      header,main {padding-inline:var(--gutter)}
      header {align-items:flex-start;flex-direction:column;gap:0;padding-bottom:10px}
      .hero {padding:52px 0 46px}
      h1 {font-size:44px;overflow-wrap:anywhere}
      h2 {font-size:28px}
      .hero p {font-size:20px}
      section {padding:42px 0 50px}
      .draft-flow div {grid-template-columns:52px 1fr auto}
      .curve {gap:5px;height:170px}
      .curve span::after {content:''}
    }
  </style>
</head>
<body>
  <header><strong>Winning in Style</strong><a href="./">Cube health →</a></header>
  <main>
    <div class="hero" data-motion><span>${esc(content.hero.eyebrow)}</span><h1>${esc(content.hero.title)}</h1><p>${esc(content.hero.lede)}</p></div>
    <section id="draft">${sectionHead(draft)}
      <div class="draft-flow" role="img" aria-label="Three packs: pass left, then right, then left" data-motion>
        <div><small>PACK 1</small><strong>Pick one</strong><b aria-hidden="true">←</b></div>
        <div><small>PACK 2</small><strong>Pick one</strong><b aria-hidden="true">→</b></div>
        <div><small>PACK 3</small><strong>Pick one</strong><b aria-hidden="true">←</b></div>
      </div><div class="prompts" data-motion>${paragraphs(draft.body)}</div>
    </section>
    <section id="removal">${sectionHead(removal)}${gallery(removal.cards)}<div class="prompts" data-motion>${paragraphs(removal.body)}</div></section>
    <section id="deck">${sectionHead(deck)}
      <div class="deck" role="img" aria-label="40 cards: 17 lands, 15 creatures, and 8 other spells" data-motion>${deckCells}</div>
      <div class="legend" data-motion><span><i style="--color:var(--mint)"></i>17 lands</span><span><i style="--color:var(--blue)"></i>15 creatures</span><span><i style="--color:var(--gold)"></i>8 other spells</span></div>
      <div class="prompts" data-motion>${paragraphs(deck.body)}</div>
    </section>
    <section id="curve">${sectionHead(curve)}
      <div class="curve" role="img" aria-label="Example creature curve: one at 1 mana, five at 2, four at 3, three at 4, one at 5, one at 6 or more" data-motion>${curveBars}</div>
      <div class="prompts" data-motion>${paragraphs(curve.body)}</div>
    </section>
    <section id="blink">${sectionHead(blink)}${gallery(blink.cards)}${blink.body.some(Boolean) ? `<div class="prompts" data-motion>${paragraphs(blink.body)}</div>` : ''}</section>
    <section id="plans">${sectionHead(plans)}<div class="prompts" data-motion>${paragraphs(plans.body)}</div>
      <div class="plans">${content.plans.map((plan, index) => `<details ${index === 0 ? 'open' : ''}>
        <summary><span class="pips">${plan.colors.map(color => `<img src="assets/mana/${color}.svg" alt="${colors[color]}">`).join('')}</span><span class="plan-title"><strong>${esc(plan.name)}</strong><small>${esc(plan.guild)}</small></span></summary>
        <div class="plan-body">${gallery(plan.cards)}<p data-motion>${esc(plan.body)}</p><a href="./index.html?pair=${esc(plan.id)}">Explore ${esc(plan.guild)} support →</a></div>
      </details>`).join('')}</div>
    </section>
    <section id="ready">${sectionHead(ready)}<div class="checklist" data-motion>${content.checklist.map(item => `<label><input type="checkbox">${esc(item)}</label>`).join('')}</div><div class="prompts" data-motion>${paragraphs(ready.body)}</div></section>
    <footer><a href="https://draft.coolasheck.com/?pick=last">Record a pick</a><details><summary>Sources and deeper reading</summary><div class="source-list">${content.sources.map(source => `<a href="${esc(source.url)}">${esc(source.label)}</a>`).join('')}</div></details><small>Card examples verified in cube snapshot v${esc(data.cube.version)}. No commanders required.</small></footer>
  </main>
  ${siteMotionMarkup()}
</body>
</html>`.replace(/[\t ]+$/gm, '');
}
