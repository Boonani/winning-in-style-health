import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');

const root = path.resolve(import.meta.dirname, '..');
const target = process.env.DASHBOARD_URL || pathToFileURL(path.join(root, 'dashboard.html')).href;
const output = path.join(root, 'outputs');

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function openView(page, group, section) {
  await page.locator(`[data-group="${group}"]`).click();
  if (section && await page.locator('#subview-wrap').isVisible()) {
    await page.locator('#subview-select').selectOption(section);
  }
}

async function inspectSemantics(browser) {
  const viewport = { width: 1440, height: 1000 };
  const page = await browser.newPage({ viewport });
  const errors = watchErrors(page);

  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  assert.match(await page.locator('h1').innerText(), /Winning in Style/);
  assert.equal(await page.locator('.metric').first().locator('strong').innerText(), '1004');
  assert.equal(await page.locator('nav .tab').count(), 5);
  assert.equal(await page.locator('#overview-stats .overview-stat').count(), 8);
  assert.equal(await page.locator('#overview-themes .theme-summary').count(), 27);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
  assert.equal(await page.locator('#theme-groups .card-tile').count(), 0, 'Browse cards render before the view is opened');
  assert.equal(await page.locator('#card-body tr').count(), 0, 'All-card rows render before the view is opened');
  await page.screenshot({ path: path.join(output, 'dashboard-desktop.png'), fullPage: false });

  await openView(page, 'browse', 'themes');
  assert.equal(await page.locator('#theme-select').inputValue(), 'all');
  assert.equal(await page.locator('#theme-groups .card-tile').count(), 1004, 'All does not show the full mainboard');
  await page.locator('#theme-groups').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => [...document.querySelectorAll('#theme-groups img')].some((image) => image.naturalWidth > 0),
    undefined,
    { timeout: 10_000 },
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.browse-toolbar').scrollIntoViewIfNeeded();

  const filterTargets = await page.evaluate(() => [...document.querySelectorAll('#theme-colors label, #theme-types label')].map((label) => {
    const rect=label.getBoundingClientRect(),pool=label.closest('fieldset').getBoundingClientRect();
    const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
    return {
      value:label.querySelector('input').value,
      visible:rect.left>=pool.left-1&&rect.right<=pool.right+1&&rect.top>=pool.top-1&&rect.bottom<=pool.bottom+1,
      clickable:hit===label||label.contains(hit),
    };
  }));
  assert.equal(filterTargets.length, 14, 'Browse is missing color or card-type targets');
  assert.deepEqual(filterTargets.filter(target=>!target.visible||!target.clickable), [], 'Browse color or type targets are clipped or covered');

  await page.locator('#theme-select').selectOption('pp-counters');
  await page.locator('#theme-colors label:has(input[value="U"])').click();
  await page.locator('#theme-colors label:has(input[value="G"])').click();
  const ugPool = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => {
    const cards = nodes.map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId));
    return {
      count: cards.length,
      labels: [...new Set(cards.map((card) => card.colorLabel))],
      invalid: cards.filter((card) => card.colors.some((color) => !['U', 'G'].includes(color))).map((card) => card.name),
      colorless: cards.filter((card) => card.colors.length === 0).map((card) => card.name),
    };
  });
  assert.ok(ugPool.count > 20, 'UG color pool returned too few +1/+1 counter cards');
  assert.deepEqual(ugPool.invalid, [], 'UG color pool included a card outside U/G');
  assert.deepEqual(ugPool.colorless, [], 'UG color pool included colorless cards without C selected');
  for (const label of ['U', 'G', 'UG']) assert.ok(ugPool.labels.includes(label), `UG color pool is missing ${label} cards`);
  await page.locator('#theme-colors .color-clear').click();

  await page.locator('#theme-select').selectOption('artifacts');
  await page.locator('#theme-types label:has(input[value="Artifact"])').click();
  const artifactOnly = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => nodes
    .map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId)));
  assert.ok(artifactOnly.length > 100, 'Artifact type filter returned too few Artifact-theme cards');
  assert.deepEqual(artifactOnly.filter((card) => !card.type.includes('Artifact')).map((card) => card.name), [], 'Artifact type filter included a non-Artifact card');
  await page.locator('#theme-types label:has(input[value="Creature"])').click();
  const anyTypes = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => nodes
    .map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId)));
  assert.ok(anyTypes.length >= artifactOnly.length, 'Adding Creature with Any type unexpectedly narrowed the result');
  assert.deepEqual(anyTypes.filter((card) => !card.type.includes('Artifact') && !card.type.includes('Creature')).map((card) => card.name), [], 'Any type mode included an unrelated card type');
  await page.locator('#theme-type-mode label:has(input[value="all"])').click();
  const allTypes = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => nodes
    .map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId)));
  assert.ok(allTypes.length > 20, 'Artifact Creature intersection returned too few cards');
  assert.deepEqual(allTypes.filter((card) => !card.type.includes('Artifact') || !card.type.includes('Creature')).map((card) => card.name), [], 'All types mode did not require Artifact Creature');
  await page.locator('#theme-types .type-clear').click();
  await page.locator('#theme-type-mode label:has(input[value="any"])').click();

  await page.locator('#theme-role').selectOption('enablers');
  await page.locator('#theme-performance').selectOption('seventeen-rated');
  await page.locator('#theme-sort').selectOption('seventeen-score');
  await page.locator('#theme-sort-direction label:has(input[value="desc"])').click();
  const scoreOrder = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => nodes.map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId).seventeenLands?.score));
  assert.ok(scoreOrder.length > 10 && scoreOrder.every((score) => score != null), '17Lands-rated filter included unrated cards');
  assert.deepEqual(scoreOrder, [...scoreOrder].sort((a, b) => b - a), '17Lands score sort is not descending');
  await page.locator('#theme-sort-direction label:has(input[value="asc"])').click();
  const ascendingScores = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => nodes.map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId).seventeenLands?.score));
  assert.deepEqual(ascendingScores, [...ascendingScores].sort((a, b) => a - b), '17Lands score sort is not ascending');
  await page.locator('#theme-sort').selectOption('seventeen-pick');
  const pickOrder = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => nodes.map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId).seventeenLands?.avgPick));
  assert.deepEqual(pickOrder, [...pickOrder].sort((a, b) => a - b), '17Lands pick-priority sort is not earliest first');
  await page.locator('#theme-performance').selectOption('all');
  await page.locator('#theme-sort').selectOption('community-picks');
  await page.locator('#theme-sort-direction label:has(input[value="desc"])').click();
  const communityOrder = await page.locator('#theme-groups [data-card-id]').evaluateAll((nodes) => nodes.map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId).pickCount));
  assert.deepEqual(communityOrder, [...communityOrder].sort((a, b) => b - a), 'Cube Cobra community-pick sort is not descending');

  await openView(page, 'health', 'guilds');
  assert.match(await page.locator('#guild-stats').innerText(), /65\s+Enablers/);
  assert.match(await page.locator('#guild-stats').innerText(), /6\s+Hard payoffs/);
  assert.match(await page.locator('#guild-stats').innerText(), /R: 0\s+Hard payoffs using first color/);
  assert.ok((await page.locator('#guild-candidates .candidate').count()) >= 10);
  await page.locator('#guild-select').selectOption('ug-landfall');
  assert.match(await page.locator('#guild-verdict').innerText(), /green-heavy/i);
  assert.match(await page.locator('#guild-verdict').innerText(), /Balance goal:\s+met/);
  assert.match(await page.locator('#guild-stats').innerText(), /U: 0\s+Hard payoffs using first color/);

  await openView(page, 'health', 'overlap');
  assert.match(await page.locator('#overlap-stats').innerText(), /Average themes \/ card/);
  assert.equal(await page.locator('#overlap-distribution tr').count(), 5);
  assert.ok((await page.locator('#overlap-gallery .card-tile').count()) >= 50);

  await openView(page, 'review', 'cuts');
  const likelyCutCount = await page.evaluate(() => DATA.weaknessSummary.likelyCuts);
  assert.equal(await page.locator('#cut-gallery .card-tile').count(), likelyCutCount);
  assert.equal(likelyCutCount, 0, 'ELO-neutral maturity repair unexpectedly produced a likely cut');
  await page.locator('#cut-view').selectOption('owner');
  assert.equal(await page.locator('#cut-gallery .card-tile').count(), 0);
  assert.match(await page.locator('#cuts').innerText(), /does not claim that any card is literally never picked/i);

  await openView(page, 'review', 'review');
  assert.ok((await page.locator('#review-list [data-card-id]').count()) > 0);
  assert.equal(await page.locator('#ambiguous-power .card-tile').count(), 5);
  await openView(page, 'health', 'focus');
  await page.locator('#focus-select').selectOption('spells');
  assert.match(await page.locator('#focus-stats').innerText(), /4\s+Narrow cast rewards/);

  await openView(page, 'browse', 'types');
  await page.locator('#type-colors label:has(input[value="U"])').click();
  await page.locator('#type-colors label:has(input[value="R"])').click();
  const urSpells = await page.locator('#type-gallery [data-card-id]').evaluateAll((nodes) => {
    const cards = nodes.map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId));
    const expected = DATA.cards.filter((card) => card.board === 'mainboard' && card.colors.every((color) => ['U', 'R'].includes(color)) && /\b(?:Instant|Sorcery)\b/i.test(card.type));
    return {
      shown: cards.length,
      expected: expected.length,
      invalidColor: cards.filter((card) => card.colors.some((color) => !['U', 'R'].includes(color))).map((card) => card.name),
      invalidType: cards.filter((card) => !/\b(?:Instant|Sorcery)\b/i.test(card.type)).map((card) => card.name),
    };
  });
  assert.equal(urSpells.shown, urSpells.expected, 'UR Instant or Sorcery census does not match the cube data');
  assert.deepEqual(urSpells.invalidColor, []);
  assert.deepEqual(urSpells.invalidType, []);
  await page.locator('#type-function').selectOption('interaction');
  const invalidFunctions = await page.locator('#type-gallery [data-card-id]').evaluateAll((nodes) => nodes
    .map((node) => DATA.cards.find((card) => card.id === node.dataset.cardId))
    .filter((card) => !card.functionRoles.some((role) => role.id === 'interaction'))
    .map((card) => card.name));
  assert.deepEqual(invalidFunctions, [], 'Interaction filter included an unlabeled card');

  await openView(page, 'health', 'map');
  await page.waitForTimeout(100);
  const coloredCanvasPixels = await page.locator('#synergy-canvas').evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) colored += 1;
    return colored;
  });
  assert.ok(coloredCanvasPixels > 1000, 'Synergy canvas is blank');

  await openView(page, 'health', 'packets');
  await page.locator('#deal-button').click();
  assert.equal(await page.locator('#packet-deal .packet').count(), 8);
  assert.match(await page.locator('#deal-summary').innerText(), /coherent packets/);
  await openView(page, 'review', 'seventeen');
  assert.equal(await page.locator('#lands-gallery .card-tile').count(), 37);
  await page.locator('#lands-gallery .card-tile').first().click();
  assert.match(await page.locator('#lands-detail').innerText(), /17Lands Powered Cube/);

  await openView(page, 'discover', 'adjacency');
  await page.locator('#adjacency-search').fill('Panharmonicon');
  await page.locator('#adjacency-search-results [data-add-anchor]').first().click();
  await page.locator('#adjacency-search').fill('Wall of Omens');
  await page.locator('#adjacency-search-results [data-add-anchor]').first().click();
  assert.equal(await page.locator('#adjacency-anchors .anchor-row').count(), 2);
  await page.locator('#adjacency-anchors [data-anchor-weight]').first().selectOption('2');
  await page.locator('#adjacency-run').click();
  await page.waitForFunction(() => document.querySelector('#adjacency-count').textContent.includes('ranked cards'));
  assert.ok((await page.locator('#adjacency-results .candidate').count()) > 20, 'CubeCobra adjacency returned too few ranked cards');
  assert.match(await page.locator('#adjacency-status').innerText(), /qualifying CubeCobra lists analyzed/i);
  const baselineCubeScore = await page.locator('#adjacency-results .adjacency-score').first().innerText();
  await page.locator('#adjacency-results .candidate-button').first().click();
  assert.match(await page.locator('#adjacency-detail').innerText(), /Weighted score/i);
  assert.match(await page.locator('#adjacency-detail').innerText(), /Anchor coverage/i);

  await page.locator('#adjacency-search').fill('Desolation Prowler');
  await page.locator('#adjacency-search-results [data-add-anchor]').first().click();
  assert.equal(await page.locator('#adjacency-results .candidate').count(), 0, 'Changing anchors left stale adjacency cards visible');
  assert.match(await page.locator('#adjacency-status').innerText(), /previous ranking was cleared/i);
  await page.locator('#adjacency-anchors [data-anchor-weight]').last().selectOption('3');
  await page.locator('#adjacency-run').click();
  await page.waitForFunction(() => document.querySelector('#adjacency-count').textContent.includes('ranked cards'));
  assert.match(await page.locator('#adjacency-status').innerText(), /Desolation Prowler \(0 qualifying cubes\)/i);
  assert.equal(await page.locator('#adjacency-results .adjacency-score').first().innerText(), baselineCubeScore, 'A zero-corpus anchor changed the modeled score denominator');

  await page.locator('#adjacency-source label:has(input[value="edhrec"])').click();
  await page.locator('#adjacency-run').click();
  await page.waitForFunction(() => /EDHREC anchor pages analyzed|Adjacency analysis failed/.test(document.querySelector('#adjacency-status').textContent), undefined, { timeout: 20_000 });
  assert.doesNotMatch(await page.locator('#adjacency-status').innerText(), /analysis failed/i);
  assert.match(await page.locator('#adjacency-status').innerText(), /EDHREC anchor pages analyzed/i);
  assert.ok((await page.locator('#adjacency-results .candidate').count()) > 10, 'Live EDHREC Lift returned too few ranked cards');
  const edhrecResultCount=await page.locator('#adjacency-results .candidate').count();
  if(edhrecResultCount>120){const tail=page.locator('#adjacency-results .candidate:nth-child(n+121)');const imagesPerCandidate=await tail.evaluateAll(candidates=>candidates.map(candidate=>candidate.querySelectorAll('img').length));assert.ok(imagesPerCandidate.every(count=>count===1),'Each EDHREC result beyond item 120 must contain exactly one image');await tail.locator('img').evaluateAll(images=>images.forEach(image=>{image.loading='eager';const source=image.src;image.src='';image.src=source;}));await page.waitForFunction(()=>[...document.querySelectorAll('#adjacency-results .candidate:nth-child(n+121) img')].every(image=>image.complete&&image.naturalWidth>0),undefined,{timeout:20_000});}

  const viewportOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.close();
  return { viewport, coloredCanvasPixels, viewportOverflow, errors };
}

async function inspectMobile(browser, engine, profile) {
  const page = await browser.newPage({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    hasTouch: true,
    isMobile: true,
  });
  const errors = watchErrors(page);
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.evaluate((safe) => {
    for (const [side, value] of Object.entries(safe)) {
      document.documentElement.style.setProperty(`--safe-${side}`, `${value}px`);
    }
  }, profile.safe);

  assert.match(await page.locator('meta[name="viewport"]').getAttribute('content'), /viewport-fit=cover/);
  assert.equal(await page.locator('#theme-groups .card-tile').count(), 0, 'Heavy Browse view eagerly rendered on mobile');
  assert.equal(await page.locator('#card-body tr').count(), 0, 'Heavy card table eagerly rendered on mobile');
  assert.equal(await page.locator('#oracle-tag-body tr').count(), 0, 'Heavy tag tables eagerly rendered on mobile');

  const safeGeometry = await page.evaluate(() => {
    const px = (value) => Math.round(Number.parseFloat(value));
    const header = getComputedStyle(document.querySelector('header'));
    const main = getComputedStyle(document.querySelector('main'));
    const nav = getComputedStyle(document.querySelector('nav'));
    return {
      headerTop: px(header.paddingTop),
      mainLeft: px(main.paddingLeft),
      mainRight: px(main.paddingRight),
      mainBottom: px(main.paddingBottom),
      navLeft: px(nav.paddingLeft),
      navRight: px(nav.paddingRight),
      textAdjustRule: document.querySelector('style').textContent.includes('-webkit-text-size-adjust: 100%'),
    };
  });
  assert.equal(safeGeometry.headerTop, profile.safe.top);
  assert.equal(safeGeometry.mainLeft, Math.max(12, profile.safe.left));
  assert.equal(safeGeometry.mainRight, Math.max(12, profile.safe.right));
  assert.equal(safeGeometry.mainBottom, Math.max(20, profile.safe.bottom));
  assert.equal(safeGeometry.navLeft, Math.max(12, profile.safe.left));
  assert.equal(safeGeometry.navRight, Math.max(12, profile.safe.right));
  assert.equal(safeGeometry.textAdjustRule, true);

  await page.screenshot({ path: path.join(output, `dashboard-${engine}-${profile.name}.png`), fullPage: false });
  const visited = [];
  let mapPixels = 0;
  const tabs = page.locator('nav .tab');
  for (let tabIndex = 0; tabIndex < await tabs.count(); tabIndex += 1) {
    const tab = tabs.nth(tabIndex);
    const group = await tab.getAttribute('data-group');
    await tab.click();
    const selector = page.locator('#subview-select');
    const sectionIds = await page.locator('#subview-wrap').isVisible()
      ? await selector.locator('option').evaluateAll((options) => options.map((option) => option.value))
      : [await tab.getAttribute('data-tab')];

    for (const sectionId of sectionIds) {
      if (sectionIds.length > 1) await selector.selectOption(sectionId);
      await page.waitForTimeout(25);
      const section = page.locator(`#${sectionId}`);
      assert.ok(await section.isVisible(), `${engine}/${profile.name}/${sectionId} is hidden`);
      assert.ok((await section.innerText()).trim().length > 5, `${engine}/${profile.name}/${sectionId} has no usable content`);

      const geometry = await page.evaluate((activeId) => {
        const headerRect = document.querySelector('header').getBoundingClientRect();
        const mainRect = document.querySelector('main').getBoundingClientRect();
        const activeRect = document.getElementById(activeId).getBoundingClientRect();
        const selectedTabRect = document.querySelector('.tab[aria-selected="true"]').getBoundingClientRect();
        const interactive = [
          ...document.querySelectorAll('header button, header select'),
          ...document.getElementById(activeId).querySelectorAll('button, select, input:not([type="checkbox"]):not([type="radio"]), .color-pool label, .type-pool label, .mode-control label, .check-control, tr.all-card-row'),
        ];
        const targetIssues = interactive.flatMap((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];
          if (rect.width + 0.5 >= 44 && rect.height + 0.5 >= 44) return [];
          return [{ tag: element.tagName, id: element.id, className: String(element.className), width: Math.round(rect.width), height: Math.round(rect.height) }];
        });
        const smallForms = [...document.getElementById(activeId).querySelectorAll('select, input:not([type="checkbox"]):not([type="radio"])')]
          .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 16)
          .map((element) => element.id || element.tagName);
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          mainTop: mainRect.top,
          headerBottom: headerRect.bottom,
          activeLeft: activeRect.left,
          activeRight: activeRect.right,
          selectedTabLeft: selectedTabRect.left,
          selectedTabRight: selectedTabRect.right,
          targetIssues,
          smallForms,
        };
      }, sectionId);
      assert.ok(geometry.overflow <= 1, `${engine}/${profile.name}/${sectionId} overflows by ${geometry.overflow}px`);
      assert.ok(geometry.mainTop + 1 >= geometry.headerBottom, `${engine}/${profile.name}/${sectionId} starts under the sticky header`);
      assert.ok(geometry.activeLeft >= -1 && geometry.activeRight <= profile.viewport.width + 1, `${engine}/${profile.name}/${sectionId} escapes the viewport`);
      assert.ok(geometry.selectedTabLeft >= -1 && geometry.selectedTabRight <= profile.viewport.width + 1, `${engine}/${profile.name}/${group} selected tab is clipped`);
      assert.deepEqual(geometry.targetIssues, [], `${engine}/${profile.name}/${sectionId} has undersized touch targets`);
      assert.deepEqual(geometry.smallForms, [], `${engine}/${profile.name}/${sectionId} has form text below 16px`);
      if (sectionId === 'map') {
        const map = await page.locator('#synergy-canvas').evaluate((canvas) => {
          const ratio = window.devicePixelRatio || 1;
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let colored = 0;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) colored += 1;
          return {
            colored,
            logicalWidth: canvas.width / ratio,
            logicalHeight: canvas.height / ratio,
            cssWidth: canvas.getBoundingClientRect().width,
            cssHeight: canvas.getBoundingClientRect().height,
            scrollWidth: canvas.parentElement.scrollWidth,
            clientWidth: canvas.parentElement.clientWidth,
            scrollMoved: (() => {
              const wrap = canvas.parentElement;
              const original = wrap.scrollLeft;
              wrap.scrollLeft = 0;
              wrap.scrollLeft = Math.min(20, wrap.scrollWidth - wrap.clientWidth);
              const moved = wrap.scrollLeft > 0;
              wrap.scrollLeft = original;
              return moved;
            })(),
          };
        });
        assert.ok(map.colored > 1000, `${engine}/${profile.name} synergy map is blank`);
        assert.ok(Math.abs(map.logicalWidth - map.cssWidth) <= 1 && Math.abs(map.logicalHeight - map.cssHeight) <= 1, `${engine}/${profile.name} synergy map is non-uniformly scaled`);
        assert.ok(map.logicalWidth >= 720 && map.logicalHeight >= 500, `${engine}/${profile.name} synergy map labels are not given a readable canvas`);
        if (profile.viewport.width < 720) {
          assert.ok(map.scrollWidth > map.clientWidth + 1 && map.scrollMoved, `${engine}/${profile.name} synergy map cannot be panned on a narrow phone`);
        }
        mapPixels = map.colored;
      }
      visited.push(sectionId);
    }
  }

  await openView(page, 'browse', 'themes');
  const blueLabel = page.locator('#theme-colors label:has(input[value="U"])');
  await blueLabel.scrollIntoViewIfNeeded();
  await blueLabel.click();
  assert.ok(await page.locator('#theme-colors input[value="U"]').isChecked(), `${engine}/${profile.name} touch filter did not toggle`);
  assert.equal(visited.length, 20, `${engine}/${profile.name} did not inspect every subview`);
  assert.deepEqual(errors, [], `${engine}/${profile.name} emitted browser errors`);
  await page.close();
  return { engine, profile: profile.name, viewport: profile.viewport, safe: profile.safe, views: visited.length, mapPixels, errors };
}

const profiles = [
  { name: 'iphone-se-portrait', viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, safe: { top: 20, right: 0, bottom: 0, left: 0 } },
  { name: 'iphone-modern-portrait', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
  { name: 'iphone-modern-landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, safe: { top: 0, right: 47, bottom: 21, left: 47 } },
];

const [chromiumBrowser, webkitBrowser] = await Promise.all([
  chromium.launch({ headless: true }),
  webkit.launch({ headless: true }),
]);

try {
  const desktop = await inspectSemantics(chromiumBrowser);
  const mobile = [];
  for (const profile of profiles) {
    const results = await Promise.all([
      inspectMobile(chromiumBrowser, 'chromium', profile),
      inspectMobile(webkitBrowser, 'webkit', profile),
    ]);
    mobile.push(...results);
  }
  assert.deepEqual(desktop.errors, []);
  assert.ok(desktop.viewportOverflow <= 1, `Desktop page overflows horizontally by ${desktop.viewportOverflow}px`);
  console.log(JSON.stringify({ verified: true, desktop, mobile }, null, 2));
} finally {
  await Promise.all([chromiumBrowser.close(), webkitBrowser.close()]);
}
