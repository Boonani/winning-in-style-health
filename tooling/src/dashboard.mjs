const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function renderDashboard(data) {
  const payloadData = structuredClone(data);
  for (const card of payloadData.cards) delete card.search;
  const payload = JSON.stringify(payloadData).replaceAll('</script', '<\\/script');
  const colorPicker = (id) => `<fieldset class="color-pool" id="${id}"><legend>Color pool</legend>${[
    ['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green'], ['C', 'Colorless'],
  ].map(([color, label]) => `<label title="${label}"><input type="checkbox" value="${color}" aria-label="${label}"><span class="pip ${color}" aria-hidden="true"><span>${color}</span><img src="assets/mana/${color}.svg" alt=""></span></label>`).join('')}<button type="button" class="color-clear" title="Clear color pool">All</button></fieldset>`;
  const typePicker = (id) => `<fieldset class="type-pool" id="${id}"><legend>Card types</legend>${[
    'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Battle',
  ].map((type) => `<label><input type="checkbox" value="${type}"><span>${type}</span></label>`).join('')}<button type="button" class="type-clear" title="Clear card types">All types</button></fieldset>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${esc(data.cube.name)} - Cube Health</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #f5f7f8;
      --muted: #9aa2aa;
      --paper: #0d0f11;
      --panel: #16191c;
      --raised: #1e2226;
      --line: #2e3338;
      --accent: #79b8ff;
      --blue: var(--accent);
      --red: var(--accent);
      --green: #70c996;
      --gold: #e7b85b;
      --good: #68c392;
      --warn: #e0ad4f;
      --bad: #ef7668;
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-right: env(safe-area-inset-right, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --safe-left: env(safe-area-inset-left, 0px);
    }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    body { min-height: 100vh; min-height: 100dvh; margin: 0; background: var(--paper); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, select { font: inherit; letter-spacing: 0; }
    button, label, select { touch-action: manipulation; }
    button { cursor: pointer; }
    header { position: sticky; top: 0; z-index: 20; padding-top: var(--safe-top); background: rgba(13,15,17,.96); border-bottom: 1px solid var(--line); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
    .top { max-width: 1600px; margin: auto; min-height: 66px; display: flex; gap: 20px; align-items: center; padding: 10px max(22px, var(--safe-right)) 10px max(22px, var(--safe-left)); }
    h1 { margin: 0; font-size: 20px; line-height: 1.2; letter-spacing: 0; }
    .subtitle { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .header-actions { margin-left: auto; display: flex; gap: 10px; align-items: center; }
    .metrics { display: flex; gap: 20px; align-items: baseline; }
    .metric { min-width: 72px; }
    .metric strong { display: block; font-size: 19px; }
    .metric span { color: var(--muted); font-size: 11px; }
    nav { max-width: 1600px; margin: auto; display: flex; overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; padding: 0 max(22px, var(--safe-right)) 0 max(22px, var(--safe-left)); }
    nav::-webkit-scrollbar, .type-pool::-webkit-scrollbar, .color-pool::-webkit-scrollbar, .preset-list::-webkit-scrollbar, .packet-cards::-webkit-scrollbar { display: none; }
    .tab { border: 0; border-bottom: 3px solid transparent; background: transparent; padding: 10px 14px 9px; color: var(--muted); white-space: nowrap; }
    .tab[aria-selected="true"] { border-color: var(--red); color: var(--ink); font-weight: 700; }
    main { max-width: 1600px; margin: auto; padding: 22px max(22px, var(--safe-right)) max(22px, var(--safe-bottom)) max(22px, var(--safe-left)); }
    section[hidden] { display: none; }
    h2 { font-size: 17px; margin: 0 0 6px; letter-spacing: 0; }
    h3 { font-size: 14px; margin: 0; letter-spacing: 0; }
    .lede { color: var(--muted); margin: 0 0 18px; line-height: 1.5; max-width: 980px; }
    .band { border-top: 1px solid var(--line); padding: 18px 0 24px; }
    .table-wrap { border: 1px solid var(--line); background: var(--panel); overflow: auto; max-height: 72vh; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { position: sticky; top: 0; z-index: 2; background: #24282c; text-align: left; font-size: 11px; text-transform: uppercase; color: #c9cdd1; letter-spacing: .04em; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #2b2f33; vertical-align: top; }
    tbody tr:hover { background: #22262a; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .status { font-weight: 700; }
    .strong, .healthy, .high-visibility, .premium { color: var(--good); }
    .playable, .subtheme, .visible, .solid { color: var(--blue); }
    .fragile, .thin, .inconsistent, .role-player { color: var(--warn); }
    .unsupported, .trap, .scarce, .synergy-piece { color: var(--bad); }
    .likely-cut { color: var(--bad); } .review { color: var(--warn); } .watch { color: var(--blue); } .protected { color: var(--good); }
    .colors { display: inline-flex; gap: 3px; white-space: nowrap; }
    .pip { position: relative; width: 20px; height: 20px; border-radius: 50%; display: inline-grid; place-items: center; border: 1px solid rgba(255,255,255,.14); font-size: 10px; font-weight: 800; color: #171717; font-style: normal; overflow: hidden; background: #d4d1c9; }
    .pip img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .W { background: #f5eac6; } .U { background: #a9d6e8; } .B { background: #b9b1bc; } .R { background: #e9a28e; } .G { background: #add5b2; } .C { background: #d4d1c9; }
    .bar { width: 120px; height: 8px; background: #30353a; overflow: hidden; }
    .bar > i { display: block; height: 100%; background: var(--green); }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; align-items: center; }
    .browse-toolbar { display: grid; gap: 8px; margin: 0 0 14px; }
    .filter-row { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .filter-row-primary #theme-select { flex: 1 1 220px; }
    .filter-row-primary #theme-role { flex: 1 1 180px; }
    .filter-row-primary #theme-search { flex: 2 1 320px; }
    .filter-row-primary #theme-function { flex: 1 1 170px; }
    .filter-row-types .type-pool { flex: 1 1 620px; }
    .filter-row-sort #theme-performance { flex: 1 1 230px; }
    .filter-row-sort #theme-sort { flex: 1 1 220px; }
    .filter-row-sort .result-count { margin-left: auto; }
    .color-pool { flex: 0 0 auto; min-width: 214px; height: 38px; max-width: 100%; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); background: var(--panel); padding: 0 7px; margin: 0; border-radius: 6px; overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
    .color-pool legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .color-pool label { position: relative; display: inline-grid; place-items: center; cursor: pointer; }
    .color-pool input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; }
    .color-pool input:checked + .pip { outline: 3px solid var(--ink); outline-offset: 1px; }
    .color-pool input:focus-visible + .pip { box-shadow: 0 0 0 3px var(--panel), 0 0 0 5px var(--blue); }
    .color-clear { height: 26px; border: 0; border-left: 1px solid var(--line); background: transparent; padding: 0 3px 0 8px; color: var(--muted); font-size: 11px; font-weight: 700; }
    .color-clear:hover { color: var(--ink); }
    .type-pool { min-width: min(100%, 520px); min-height: 38px; max-width: 100%; display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--line); background: var(--panel); padding: 3px; margin: 0; border-radius: 6px; overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
    .type-pool legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .type-pool label { position: relative; flex: 0 0 auto; cursor: pointer; }
    .type-pool input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; pointer-events: none; }
    .type-pool label span { min-height: 28px; display: inline-flex; align-items: center; padding: 0 8px; border: 1px solid transparent; border-radius: 3px; color: var(--muted); font-size: 11px; font-weight: 700; }
    .type-pool input:checked + span { border-color: var(--blue); background: #20333b; color: var(--ink); }
    .type-pool input:focus-visible + span { outline: 2px solid var(--blue); outline-offset: 1px; }
    .type-clear { flex: 0 0 auto; min-height: 28px; border: 0; border-left: 1px solid var(--line); background: transparent; padding: 0 7px; color: var(--muted); font-size: 11px; font-weight: 700; }
    .type-clear:hover { color: var(--ink); }
    .mode-control { height: 38px; display: inline-flex; align-items: center; border: 1px solid var(--line); background: var(--panel); border-radius: 6px; overflow: hidden; }
    .mode-control label { position: relative; height: 100%; display: inline-flex; align-items: center; cursor: pointer; }
    .mode-control input { position: absolute; opacity: 0; pointer-events: none; }
    .mode-control span { height: 100%; display: inline-flex; align-items: center; padding: 0 9px; color: var(--muted); font-size: 11px; font-weight: 700; }
    .mode-control input:checked + span { background: #20333b; color: var(--ink); }
    input:not([type="checkbox"]):not([type="radio"]), select { height: 38px; border: 1px solid var(--line); background: var(--panel); padding: 0 10px; border-radius: 6px; color: var(--ink); }
    input[type="search"] { min-width: 280px; flex: 1; }
    input[type="number"] { width: 86px; }
    .command { min-height: 38px; border: 1px solid var(--line); background: var(--raised); color: var(--ink); padding: 7px 12px; border-radius: 6px; font-weight: 700; }
    .command:hover { background: #292d31; }
    .primary { background: var(--accent); border-color: var(--accent); color: #09131d; }
    .primary:hover { background: #7ac9e8; }
    .result-count { color: var(--muted); font-size: 12px; margin-left: auto; }
    .note { border-left: 3px solid var(--gold); padding: 10px 12px; background: #211f18; max-width: 1050px; line-height: 1.45; }
    .note strong { color: var(--ink); }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 14px 0 20px; }
    .stat { padding: 12px 14px; border-right: 1px solid var(--line); }
    .stat:last-child { border-right: 0; }
    .stat strong { display: block; font-size: 20px; font-variant-numeric: tabular-nums; }
    .stat span { color: var(--muted); font-size: 11px; }
    .browser-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; }
    .detail { position: sticky; top: 126px; border-left: 1px solid var(--line); padding-left: 17px; min-height: 420px; max-height: calc(100vh - 145px); overflow-y: auto; }
    .detail > img { width: 100%; max-width: 300px; aspect-ratio: 488 / 680; object-fit: contain; background: #23272b; display: block; }
    .detail h3 { margin: 12px 0 5px; font-size: 15px; }
    .detail p { margin: 0 0 9px; color: var(--muted); font-size: 12px; line-height: 1.45; white-space: pre-line; }
    .detail .case { padding: 9px 0; border-top: 1px solid var(--line); color: var(--ink); }
    .card-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 12px 9px; align-items: start; }
    .card-tile { margin: 0; min-width: 0; border: 0; padding: 0; background: transparent; text-align: left; color: var(--ink); }
    .card-tile figure { margin: 0; }
    .card-tile img, .card-placeholder { width: 100%; aspect-ratio: 488 / 680; display: block; object-fit: contain; background: #23272b; border-radius: 7px; box-shadow: 0 2px 9px rgba(0,0,0,.52); }
    .card-tile:hover img, .card-tile:focus-visible img { outline: 3px solid var(--accent); outline-offset: 2px; }
    .card-tile:focus-visible { outline: none; }
    .card-tile figcaption { padding: 6px 2px 0; min-height: 43px; font-size: 12px; line-height: 1.25; }
    .card-tile small { display: block; margin-top: 2px; color: var(--muted); font-size: 10px; }
    .role-section { border-top: 1px solid var(--line); padding: 16px 0 24px; }
    .role-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 12px; }
    .role-head span { color: var(--muted); font-size: 12px; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip { border: 1px solid #484d52; background: #24282c; padding: 2px 5px; font-size: 11px; border-radius: 3px; white-space: nowrap; }
    .case-grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 10px 0; }
    .case-grid > div { padding: 9px; }
    .case-grid > div + div { border-left: 1px solid var(--line); }
    .case-grid strong { display: block; font-size: 18px; }
    .case-grid span { color: var(--muted); font-size: 10px; text-transform: uppercase; }
    .packet-list { display: grid; gap: 8px; }
    .packet { display: grid; grid-template-columns: 125px minmax(0, 1fr); gap: 12px; border-top: 1px solid var(--line); padding-top: 9px; }
    .packet-summary { font-size: 12px; color: var(--muted); }
    .packet-summary strong { display: block; color: var(--ink); font-size: 13px; margin-bottom: 3px; }
    .packet-cards { display: flex; gap: 6px; overflow-x: auto; min-height: 72px; }
    .mini-card { flex: 0 0 52px; border: 0; padding: 0; background: transparent; }
    .mini-card img { width: 52px; height: 72px; object-fit: cover; border-radius: 4px; display: block; }
    .mini-card span { display: block; font-size: 9px; text-align: center; margin-top: 2px; }
    .empty { color: var(--muted); padding: 24px 0; }
    .all-card-row { cursor: pointer; }
    .canvas-wrap { border: 1px solid var(--line); background: #16191c; overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; contain: inline-size; }
    #synergy-canvas { width: 100%; height: 620px; display: block; }
    .candidate-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 12px 9px; }
    .candidate { margin: 0; min-width: 0; }
    .candidate img { width: 100%; aspect-ratio: 488 / 680; object-fit: contain; display: block; border-radius: 7px; box-shadow: 0 2px 9px rgba(0,0,0,.52); background: #23272b; }
    .candidate figcaption { padding: 6px 2px 0; font-size: 12px; line-height: 1.3; }
    .candidate small { display: block; color: var(--muted); }
    .subview { max-width: 1600px; margin: 0 auto 18px; display: flex; align-items: center; gap: 8px; }
    .subview label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .overview-head { display: flex; gap: 18px; justify-content: space-between; align-items: end; padding-bottom: 18px; }
    .overview-head h2 { font-size: 28px; margin: 0 0 6px; }
    .freshness { min-width: min(100%, 360px); text-align: right; }
    .freshness p { color: var(--muted); margin: 6px 0 0; font-size: 12px; }
    .overview-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .overview-stat { padding: 16px; border-right: 1px solid var(--line); min-width: 0; }
    .overview-stat:last-child { border-right: 0; }
    .overview-stat strong { display: block; font-size: 24px; font-variant-numeric: tabular-nums; }
    .overview-stat span { display: block; color: var(--muted); font-size: 11px; margin-top: 3px; }
    .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
    .compact-list { display: grid; gap: 8px; }
    .compact-row { display: grid; grid-template-columns: minmax(80px, 1fr) 3fr auto; align-items: center; gap: 9px; font-size: 12px; }
    .compact-row > .compact-bar { display: block; height: 7px; background: var(--accent); border-radius: 4px; }
    .theme-summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(235px, 1fr)); gap: 8px; }
    .theme-summary { border: 1px solid var(--line); background: var(--panel); border-radius: 8px; padding: 12px; color: var(--ink); text-align: left; min-height: 112px; }
    .theme-summary:hover, .theme-summary:focus-visible { border-color: var(--accent); outline: none; background: var(--raised); }
    .theme-summary header { position: static; display: flex; justify-content: space-between; gap: 8px; background: transparent; border: 0; backdrop-filter: none; }
    .theme-summary small { color: var(--muted); display: block; margin-top: 8px; line-height: 1.4; }
    .theme-summary .bar { width: 100%; margin-top: 10px; }
    .attention-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .diff-list { color: var(--muted); font-size: 12px; margin-top: 8px; }
    .discover-form { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .discover-fields { min-width: 0; width: 100%; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .preset-list { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
    .preset-list .command { flex: 0 0 auto; }
    .query-preview { padding: 10px 12px; background: #111417; border: 1px solid var(--line); border-radius: 6px; overflow-wrap: anywhere; color: #cbd5df; }
    .check-control { min-height: 38px; display: inline-flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--muted); font-size: 12px; }
    .candidate-button { border: 0; padding: 0; background: transparent; color: inherit; text-align: left; width: 100%; }
    .candidate-button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 8px; }
    .adjacency-builder { display: grid; grid-template-columns: minmax(260px, .8fr) minmax(0, 1.2fr); gap: 24px; align-items: start; }
    .anchor-results, .anchor-list { display: grid; gap: 6px; max-height: 330px; overflow: auto; }
    .anchor-result, .anchor-row { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--line); }
    .anchor-result { width: 100%; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: inherit; text-align: left; }
    .anchor-result small, .anchor-row small { color: var(--muted); display: block; overflow-wrap: anywhere; }
    .anchor-row-controls { display: inline-flex; align-items: center; gap: 6px; }
    .anchor-row-controls select { min-width: 62px; }
    .adjacency-score { font-size: 18px; font-variant-numeric: tabular-nums; }
    .adjacency-source { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .live-pending { color: var(--gold); }
    .subview[hidden] { display: none; }
    a { color: var(--blue); }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .92em; }
    @media (max-width: 980px) {
      .header-actions .metrics { display: none; }
      .top, nav, main { padding-left: max(12px, var(--safe-left)); padding-right: max(12px, var(--safe-right)); }
      .top { gap: 8px; align-items: flex-start; }
      .top > div:first-child { min-width: 0; overflow: hidden; padding-top: 3px; }
      h1 { overflow: hidden; font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
      .header-actions { flex: 0 0 auto; }
      main { padding-top: 18px; padding-bottom: max(20px, var(--safe-bottom)); }
      .browser-layout, .grid-2 { grid-template-columns: 1fr; }
      .overview-head { align-items: stretch; flex-direction: column; }
      .freshness { text-align: left; }
      .overview-grid, .attention-grid { grid-template-columns: 1fr; }
      .adjacency-builder { grid-template-columns: 1fr; }
      .overview-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .detail { position: static; border-left: 0; border-top: 1px solid var(--line); padding: 15px 0 0; max-width: 360px; max-height: none; }
      .card-gallery { grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); }
      .packet { grid-template-columns: 1fr; }
      .role-head { align-items: stretch; flex-direction: column; }
      .result-count { width: 100%; margin-left: 0; }
      .color-pool, .type-pool { width: 100%; min-width: 0; }
      .browse-toolbar .mode-control { width: 100%; }
      .browse-toolbar .mode-control label { flex: 1 1 50%; justify-content: center; }
      input[type="search"], input[type="text"] { min-width: min(100%, 280px); }
      #synergy-canvas { width: max(100%, 720px); height: 520px; }
      th, td { padding: 8px; }
    }
    @media (max-width: 980px), (pointer: coarse) {
      button, select, input:not([type="checkbox"]):not([type="radio"]), .check-control { min-height: 44px; }
      input:not([type="checkbox"]):not([type="radio"]), select { height: 44px; font-size: 16px; }
      .tab { min-height: 44px; padding-top: 10px; padding-bottom: 9px; }
      .command { min-height: 44px; }
      .color-pool { height: 44px; padding-top: 0; padding-bottom: 0; }
      .color-pool label { flex: 0 0 44px; min-width: 44px; min-height: 44px; }
      .color-clear { flex: 0 0 44px; min-width: 44px; min-height: 44px; }
      .type-pool { min-height: 44px; }
      .type-pool label, .type-pool label span { min-width: 44px; }
      .type-pool label span, .type-clear { min-height: 44px; }
      .mode-control, .mode-control label { height: 44px; min-height: 44px; }
      .all-card-row { min-height: 44px; }
      tr.all-card-row td { padding-top: 15px; padding-bottom: 15px; }
    }
    @media (prefers-reduced-motion: no-preference) {
      section:not([hidden]) { animation: reveal 170ms ease-out; }
      .theme-summary, .command, .card-tile img { transition: background-color 160ms ease, border-color 160ms ease, outline-color 160ms ease, transform 160ms ease; }
      .theme-summary:hover { transform: translateY(-1px); }
      @keyframes reveal { from { opacity: .72; transform: translateY(3px); } to { opacity: 1; transform: none; } }
    }
  </style>
</head>
<body>
  <header>
    <div class="top">
      <div>
        <h1 title="${esc(data.cube.name)}">${esc(data.cube.name)}</h1>
        <div class="subtitle">Analyzed snapshot v${esc(data.cube.version)} | ${esc(data.generatedAt.slice(0, 16).replace('T', ' '))}</div>
      </div>
      <div class="header-actions">
        <div class="metrics">
          <div class="metric"><strong>${data.cube.mainboardCount}</strong><span>Mainboard</span></div>
          <div class="metric"><strong>${data.overlapDistribution.multiThemePercent}%</strong><span>Multi-theme</span></div>
        </div>
        <button class="command" id="refetch-button" type="button" title="Read the current public Cube Cobra list">Refetch</button>
      </div>
    </div>
    <nav aria-label="Primary views" role="tablist">
      <button class="tab" data-group="overview" data-tab="overview" role="tab" aria-controls="overview" aria-selected="true" tabindex="0">Overview</button>
      <button class="tab" data-group="browse" data-tab="themes" role="tab" aria-controls="themes" aria-selected="false" tabindex="-1">Browse</button>
      <button class="tab" data-group="health" data-tab="health" role="tab" aria-controls="health" aria-selected="false" tabindex="-1">Health</button>
      <button class="tab" data-group="review" data-tab="cuts" role="tab" aria-controls="cuts" aria-selected="false" tabindex="-1">Review</button>
      <button class="tab" data-group="discover" data-tab="adjacency" role="tab" aria-controls="adjacency" aria-selected="false" tabindex="-1">Discover</button>
    </nav>
  </header>
  <main>
    <div class="subview" id="subview-wrap" hidden><label for="subview-select">View</label><select id="subview-select" aria-label="View within this workspace"></select></div>

    <section id="overview">
      <div class="overview-head">
        <div><h2>Cube health at a glance</h2><p class="lede">The complete current snapshot: structure, overlap, performance evidence, and the themes that need attention.</p></div>
        <div class="freshness"><button class="command primary" id="overview-refetch" type="button">Refetch Cube Cobra</button><p id="freshness-status">Published analysis matches snapshot v${esc(data.cube.version)}. Refetch is read-only.</p><div id="freshness-diff" class="diff-list"></div></div>
      </div>
      <div id="overview-stats" class="overview-stats"></div>
      <div class="overview-grid band">
        <div><h2>Mana curve</h2><div id="overview-curve" class="compact-list"></div></div>
        <div><h2>Color balance</h2><div id="overview-colors" class="compact-list"></div></div>
        <div><h2>Card types</h2><div id="overview-types" class="compact-list"></div></div>
        <div><h2>Card functions</h2><div id="overview-functions" class="compact-list"></div></div>
      </div>
      <div class="band">
        <div class="role-head"><div><h2>Strict theme health</h2><p class="lede">Open any theme directly in Browse. Performance sorts use only cards with matching evidence.</p></div><select id="overview-theme-sort" aria-label="Sort archetypes"><option value="health">Health score</option><option value="pick">17Lands earliest average pick</option><option value="score">17Lands game-in-hand score</option><option value="community">Cube Cobra pick volume</option></select></div>
        <div id="overview-themes" class="theme-summary-grid"></div>
      </div>
      <div class="attention-grid band"><div><h2>Weakest supported lanes</h2><div id="overview-weak"></div></div><div><h2>Review attention</h2><div id="overview-attention"></div></div></div>
    </section>

    <section id="themes" hidden>
      <h2>Cards by strict theme and role</h2>
      <p class="lede">An enabler contains or produces the theme's input. A hard payoff needs a separate enabler to function. Glue works alone but becomes better with the theme. Every assignment is proven by type, a number, or rules text; Scryfall can nominate but cannot decide.</p>
      <div class="note" id="change-note"></div>
      <div class="band"><div class="role-head"><h3>Newly added cards</h3><span id="change-count"></span></div><div id="change-gallery" class="card-gallery"></div></div>
      <div class="browse-toolbar">
        <div class="filter-row filter-row-primary">
          <select id="theme-select" aria-label="Theme"></select>
          <select id="theme-role" aria-label="Role"><option value="all">All roles</option><option value="enablers">Enablers</option><option value="payoffs">Hard Payoffs</option><option value="glue">Glue / Soft Synergy</option></select>
          <input id="theme-search" type="search" placeholder="Search card, text, tag, or role" aria-label="Search cards">
          <select id="theme-function" aria-label="Function"><option value="all">All functions</option><option value="interaction">Interaction</option><option value="value">Value</option></select>
        </div>
        <div class="filter-row filter-row-types">
          ${colorPicker('theme-colors')}
          ${typePicker('theme-types')}
          <div class="mode-control" id="theme-type-mode" role="radiogroup" aria-label="Multiple type matching"><label title="Match at least one selected type"><input type="radio" name="theme-type-mode" value="any" checked><span>Any type</span></label><label title="Require every selected type"><input type="radio" name="theme-type-mode" value="all"><span>All types</span></label></div>
        </div>
        <div class="filter-row filter-row-sort">
          <select id="theme-performance" aria-label="Performance filter"><option value="all">All performance data</option><option value="seventeen-rated">17Lands rated only</option><option value="seventeen-top">17Lands top quartile</option><option value="seventeen-early">17Lands avg pick 5 or earlier</option><option value="community-top">Community-pick top quartile</option></select>
          <select id="theme-sort" aria-label="Sort"><option value="quality">Local quality</option><option value="seventeen-score">17Lands score</option><option value="seventeen-pick">17Lands pick priority</option><option value="community-picks">Cube Cobra community picks</option><option value="elo">Cube Cobra ELO</option><option value="mv">Mana value</option><option value="name">Name</option></select>
          <div class="mode-control" id="theme-sort-direction" role="radiogroup" aria-label="Sort direction"><label title="Show highest values or Z first"><input type="radio" name="theme-sort-direction" value="desc" checked><span>Descending</span></label><label title="Show lowest values or A first"><input type="radio" name="theme-sort-direction" value="asc"><span>Ascending</span></label></div>
          <span class="result-count" id="theme-count"></span>
        </div>
      </div>
      <div id="theme-stats" class="stats"></div>
      <div class="browser-layout">
        <div id="theme-groups"></div>
        <aside class="detail" id="theme-detail"><div class="note">Select a card to inspect every accepted role, its rule ID, and the exact reason it qualified.</div></aside>
      </div>
    </section>

    <section id="guilds" hidden>
      <h2>Guild archetype experiments</h2>
      <p class="lede">Compare the current cube as RG Power 4+, broader RG Power Matters, UG Counters, UG Landfall, or GW Counters. These are separate experiments, not merged labels.</p>
      <div class="toolbar"><select id="guild-select" aria-label="Guild experiment"></select><span id="guild-count" class="result-count"></span></div>
      <div id="guild-verdict" class="note"></div>
      <div id="guild-stats" class="stats"></div>
      <div class="browser-layout"><div id="guild-content"></div><aside class="detail" id="guild-detail"><div class="note">Select a card to see what else it supports and why each role was accepted.</div></aside></div>
      <div class="band"><div class="role-head"><h3>Absent research candidates</h3><span>Targeted Scryfall searches</span></div><div id="guild-candidates"></div></div>
      <div class="band"><div class="role-head"><h3>Official RG precedents</h3><span>Wizards of the Coast</span></div><div id="rg-precedents"></div></div>
    </section>

    <section id="overlap" hidden>
      <h2>How many themes can each card support?</h2>
      <p class="lede">Overlap is useful only when every assignment is real. The strict count dropped the previous permissive average of 4.22 themes per card to ${data.overlapDistribution.averageThemesPerCard}.</p>
      <div id="overlap-stats" class="stats"></div>
      <div class="band table-wrap"><table><thead><tr><th>Distinct strict themes</th><th>Cards</th><th>Mainboard share</th></tr></thead><tbody id="overlap-distribution"></tbody></table></div>
      <div class="band"><div class="role-head"><h3>Most flexible cards</h3><span>Each role remains independently auditable</span></div><div class="browser-layout"><div id="overlap-gallery" class="card-gallery"></div><aside class="detail" id="overlap-detail"><div class="note">Select a card to inspect its strict percentage and evidence.</div></aside></div></div>
    </section>

    <section id="cuts" hidden>
      <h2>Weak-card and cut review</h2>
      <p class="lede">Cards rise here only when independent evidence agrees: strict archetype fit, modeled standalone impact, CubeCobra community demand, and 17Lands Powered Cube performance. A single weak signal is not a cut verdict.</p>
      <div class="note"><strong>Applied owner cuts:</strong> ${esc(data.appliedOwnerCuts.join(', ') || 'None')}.<br><strong>Local pick limit:</strong> ${esc(data.weaknessSummary.localPickEvidence)} ${esc(data.weaknessSummary.communityHistoryRule)}</div>
      <div class="toolbar band">
        <select id="cut-view" aria-label="Cut review view"><option value="likely">Likely cuts</option><option value="review">Needs review</option><option value="owner">Owner-requested cuts</option><option value="no-home">No strict home</option><option value="low-impact">Low modeled impact</option><option value="low-demand">Low community demand</option><option value="powered">Powered Cube underperformers</option><option value="all">All reviewed cards</option></select>
        ${colorPicker('cut-colors')}
        <select id="cut-sort" aria-label="Cut review sort"><option value="review">Review score</option><option value="quality">Lowest quality</option><option value="elo">Lowest CubeCobra ELO</option><option value="name">Name</option></select>
        <span id="cut-count" class="result-count"></span>
      </div>
      <div id="cut-stats" class="stats"></div>
      <div class="browser-layout"><div id="cut-gallery" class="card-gallery"></div><aside class="detail" id="cut-detail"><div class="note">Select a card to see every negative signal, every protection, and the limits of the evidence.</div></aside></div>
    </section>

    <section id="review" hidden>
      <h2>Strict review queue</h2>
      <p class="lede">These cards were suggested by Scryfall tags but rejected because no strict type, numeric, or oracle-text rule matched. This is the place to fix rules, not silently accept tags.</p>
      <div class="toolbar"><select id="review-theme" aria-label="Rejected theme"></select><span id="review-count" class="result-count"></span></div>
      <div class="browser-layout"><div id="review-list" class="band"></div><aside class="detail" id="review-detail"><div class="note">Select a rejected nomination to inspect the card and decide whether the rule or the Scryfall tag is wrong.</div></aside></div>
      <div class="band"><div class="role-head"><h3>Ambiguous printed power</h3><span>${data.summary.ambiguousPowerCards} cards excluded from numeric Power 4+</span></div><div id="ambiguous-power" class="card-gallery"></div></div>
    </section>

    <section id="focus" hidden>
      <h2>UR artifacts, narrow spells, and GW Enchantress</h2>
      <p class="lede">These are direct card-level answers to the current design questions. The categories still come from Scryfall tags and exact rules text.</p>
      <div class="toolbar"><select id="focus-select"><option value="artifacts">UR Artifact Matters</option><option value="noncreature">Broad noncreature rewards</option><option value="spells">Instant / sorcery specific</option><option value="enchantress">GW Enchantress</option></select><span id="focus-count" class="result-count"></span></div>
      <div id="focus-stats" class="stats"></div>
      <div class="browser-layout"><div id="focus-content"></div><aside class="detail" id="focus-detail"><div class="note">Select a card to inspect its role, rules text, card quality, and 17Lands evidence where available.</div></aside></div>
    </section>

    <section id="map" hidden>
      <h2>Synergy map</h2>
      <p class="lede">Each node is a Scryfall-derived theme. Lines become darker when more cards bridge the two themes. The gallery below shows the cards that keep the most draft lanes open.</p>
      <div class="canvas-wrap"><canvas id="synergy-canvas" height="620" aria-label="Theme overlap network"></canvas></div>
      <div class="band"><div class="role-head"><h3>Highest-overlap bridge cards</h3><span>Sorted by number of distinct theme roles</span></div><div class="browser-layout"><div id="bridge-gallery" class="card-gallery"></div><aside class="detail" id="map-detail"><div class="note">Select a bridge card to see every theme and role it connects.</div></aside></div></div>
    </section>

    <section id="packets" hidden>
      <h2>Random packet visibility</h2>
      <p class="lede">The default deals eight players one 15-card packet each from the ${data.cube.mainboardCount}-card cube. Exact probabilities use sampling without replacement. This measures what appears, not what gets drafted into a finished deck.</p>
      <div class="toolbar">
        <label>Players <input id="packet-players" type="number" min="2" max="16" value="8"></label>
        <label>Cards each <input id="packet-size" type="number" min="1" max="45" value="15"></label>
        <button class="command" id="recalculate-packets">Recalculate</button>
      </div>
      <div class="note"><strong>Both</strong> means the sample contains at least one enabler and at least one hard payoff. Glue is displayed separately because soft synergy alone does not prove that the promised engine is present.</div>
      <div class="band table-wrap"><table><thead><tr><th>Theme</th><th>Signal</th><th>Expected E / table</th><th>Expected P / table</th><th>Pack sees E</th><th>Pack sees P</th><th>Pack sees both</th><th>Coherent packs</th><th>Table sees both</th></tr></thead><tbody id="packet-body"></tbody></table></div>
      <div class="band">
        <h2>Deal an actual randomized table</h2>
        <p class="lede">Pick a theme, then deal fresh non-overlapping packets. Only cards that support the selected theme are shown under each packet.</p>
        <div class="toolbar"><select id="deal-archetype"></select><button class="command primary" id="deal-button">Deal new packets</button><span id="deal-summary" class="result-count"></span></div>
        <div id="packet-deal" class="packet-list"></div>
      </div>
    </section>

    <section id="quality" hidden>
      <h2>Card quality and standalone strength</h2>
      <p class="lede">Every card receives the same transparent heuristic. Raw material, timing, flexibility, synergy dependence, mana efficiency, and CubeCobra community ELO are separate inputs. A great one-for-one can score highly while remaining 0 raw card advantage.</p>
      <div class="note">Average and best-case card advantage are estimates, not game logs. They count material after paying the card: Wall of Omens is about +1, while Swords to Plowshares is a card-neutral one-for-one whose quality comes from efficiency.</div>
      <div class="toolbar band">
        <input id="quality-search" type="search" placeholder="Search card, text, tag, or role">
        <select id="quality-tier"><option value="good">Good on their own</option><option value="all">All quality tiers</option><option>Premium</option><option>Strong</option><option>Solid</option><option>Role-player</option><option>Synergy piece</option></select>
        <select id="quality-speed"><option value="all">All speeds</option><option value="combat">Instant and flash</option><option value="Instant">Instants</option><option value="Flash">Flash cards</option><option value="high-combat">High-impact combat</option></select>
        <select id="quality-color"><option value="all">All colors</option><option>W</option><option>U</option><option>B</option><option>R</option><option>G</option><option>C</option></select>
        <select id="quality-sort"><option value="score">Quality score</option><option value="advantage">Average advantage</option><option value="best">Best-case advantage</option><option value="elo">CubeCobra ELO</option><option value="mv">Mana value</option><option value="name">Name</option></select>
        <span id="quality-count" class="result-count"></span>
      </div>
      <div class="browser-layout">
        <div><div id="quality-gallery" class="card-gallery"></div><button class="command" id="quality-more" hidden>Show more cards</button></div>
        <aside class="detail" id="quality-detail"><div class="note">Select any card for its average case, ceiling, raw card-advantage estimate, combat role, strengths, caveats, Scryfall tags, and archetype roles.</div></aside>
      </div>
    </section>

    <section id="seventeen" hidden>
      <h2>17Lands Powered Cube performance</h2>
      <p class="lede">According to the official public 17Lands Powered Cube PremierDraft datasets, ${data.summary.seventeenLandsCoverage} current cards have a defensible game sample. Score is GIH win-rate percentile within that cube dataset, not a universal rating.</p>
      <div class="note"><strong>Source and limits:</strong> Public 17Lands game and draft datasets, CC BY 4.0. GIH WR records games where a card was in the opening hand or drawn; pick timing is separate. These results come from the 2025 Powered Cube, not Winning in Style. <a href="https://www.17lands.com/public_datasets" target="_blank" rel="noreferrer">17Lands public datasets</a> | <a href="https://www.17lands.com/metrics_definitions" target="_blank" rel="noreferrer">metric definitions</a></div>
      <div class="toolbar band"><input id="lands-search" type="search" placeholder="Search scored card"><select id="lands-view"><option value="cuts">Cut-review cards</option><option value="all">All matched cards</option><option value="top">Top quartile</option><option value="bottom">Bottom quartile</option></select><select id="lands-sort"><option value="score">17Lands score</option><option value="pick">Average pick</option><option value="iih">Improvement in hand</option></select><span id="lands-count" class="result-count"></span></div>
      <div class="browser-layout"><div id="lands-gallery" class="card-gallery"></div><aside class="detail" id="lands-detail"><div class="note">Select a card to compare game-in-hand performance, pick priority, local quality, and synergy roles.</div></aside></div>
      <div class="band"><h2>Signpost visibility</h2><p class="lede">A singleton appears in only about twelve percent of an eight-player, 120-card sample from this ${data.cube.mainboardCount}-card cube. Redundant cards are usually cleaner than literal duplicates, but this table makes the cost visible.</p><div class="table-wrap"><table><thead><tr><th>Card</th><th>Current copies</th><th>Current table chance</th><th>2 copies</th><th>3 copies</th><th>6 copies</th><th>17Lands</th></tr></thead><tbody id="signpost-body"></tbody></table></div></div>
      <div class="band"><h2>Research candidates</h2><p class="lede">Absent cards returned by targeted Scryfall tag searches. Powered Cube scores appear only when the public dataset contains that card.</p><div id="candidate-groups"></div></div>
    </section>

    <section id="health" hidden>
      <h2>Scryfall-derived theme health</h2>
      <p class="lede">These themes come from Scryfall oracle tags and rules text, not the Cube Cobra primer. With only ${data.cube.numDecks} recorded decks, the honest signal is density, role balance, color coverage, overlap, and packet visibility.</p>
      <div class="note">The labels on the about page are intentionally ignored here. Every theme is rebuilt from the cards currently present in the live cube.</div>
      <div class="band table-wrap"><table><thead><tr><th>Theme</th><th>Status</th><th>Score</th><th>Enablers</th><th>Hard Payoffs</th><th>Glue / Soft Synergy</th><th>E:P</th><th>Support / 45</th><th>Description</th></tr></thead><tbody id="health-body"></tbody></table></div>
      <div class="band"><h2>Highest card-sharing lanes</h2><div class="table-wrap"><table><thead><tr><th>Theme A</th><th>Theme B</th><th>Shared cards</th><th>Overlap</th></tr></thead><tbody id="overlap-body"></tbody></table></div></div>
    </section>

    <section id="blink" hidden>
      <h2>Blink and adjacent ETB mechanics by color</h2>
      <p class="lede">Blink means intentional exile-and-return. Payoffs must benefit from actual flicker through a reusable own enter/leave effect, re-preparing, a useful Saga reset, or trigger amplification. Copy, graveyard return/casting, self-bounce, landfall, triggers caused only by opposing permanents entering, and cast triggers do not count as Blink. Adjacent mechanics remain visible in separate columns.</p>
      <div class="band table-wrap"><table><thead><tr><th>Color</th><th>Blink enablers</th><th>Adjacent copy</th><th>Adjacent recursion</th><th>Adjacent self-bounce</th><th>ETB hard payoffs</th><th>E:P</th><th>Coverage</th><th>Blink examples</th><th>Adjacent examples</th></tr></thead><tbody id="blink-body"></tbody></table></div>
    </section>

    <section id="hidden" hidden>
      <h2>Weak and unsupported themes</h2>
      <p class="lede">Mined from Scryfall oracle tags and rules text. Trap means inputs are abundant but dedicated rewards are too scarce to promise as a draft lane.</p>
      <div class="band table-wrap"><table><thead><tr><th>Theme</th><th>Signal</th><th>Best colors</th><th>Enablers</th><th>Hard Payoffs</th><th>E:P</th><th>Examples</th></tr></thead><tbody id="hidden-body"></tbody></table></div>
    </section>

    <section id="tribes" hidden>
      <h2>Creature type census</h2>
      <p class="lede">Bodies are not enough by themselves. Explicit payoff counts expose incidental tribes that look deep but lack reasons to draft them.</p>
      <div class="band table-wrap"><table><thead><tr><th>Creature type</th><th>Bodies</th><th>Explicit payoffs</th><th>Signal</th></tr></thead><tbody id="tribe-body"></tbody></table></div>
    </section>

    <section id="types" hidden>
      <h2>Card-type and function census</h2>
      <p class="lede">Select Blue and Red together to see every monoblue, monored, and blue-red card in that pool. Type and function filters overlap, so an interactive value spell remains visible under both labels.</p>
      <div class="toolbar">
        ${colorPicker('type-colors')}
        <select id="type-select" aria-label="Card type"><option>Instant or Sorcery</option><option>Instant</option><option>Sorcery</option><option>Artifact</option><option>Creature</option><option>Enchantment</option><option>Planeswalker</option><option>Land</option><option>Battle</option><option value="all">All card types</option></select>
        <select id="type-function" aria-label="Function"><option value="all">All functions</option><option value="interaction">Interaction</option><option value="value">Value</option></select>
        <span id="type-count" class="result-count"></span>
      </div>
      <div id="type-stats" class="stats"></div>
      <div class="grid-2 band">
        <div class="table-wrap"><table><thead><tr><th>Card type</th><th>Cards in color pool</th></tr></thead><tbody id="type-body"></tbody></table></div>
        <div class="note"><strong>Function labels overlap.</strong> Interaction answers an opposing resource and Value produces cards or material. A card can correctly have both.</div>
      </div>
      <div class="browser-layout"><div id="type-gallery" class="card-gallery"></div><aside class="detail" id="type-detail"><div class="note">Select a card to inspect its function labels, cube-specific rules text, and strict archetype roles.</div></aside></div>
    </section>

    <section id="cards" hidden>
      <h2>All-card data explorer</h2>
      <p class="lede">Every CubeCobra entry, role, quality estimate, Scryfall oracle tag, and illustration tag remains searchable here.</p>
      <div class="toolbar">
        <input id="card-search" type="search" placeholder="Search card, oracle text, tag, tribe, or role">
        <select id="card-board"><option value="all">All boards</option><option value="mainboard">Mainboard</option><option value="maybeboard">Maybeboard</option><option value="basics">Basics</option></select>
        <select id="card-color"><option value="all">All colors</option><option>W</option><option>U</option><option>B</option><option>R</option><option>G</option><option>C</option></select>
        <select id="card-type"><option value="all">All card types</option><option>Instant or Sorcery</option><option>Instant</option><option>Sorcery</option><option>Creature</option><option>Artifact</option><option>Enchantment</option><option>Planeswalker</option><option>Land</option><option>Battle</option></select>
        <select id="card-function"><option value="all">All functions</option><option value="interaction">Interaction</option><option value="value">Value</option></select>
        <span id="all-card-count" class="result-count"></span>
      </div>
      <div class="browser-layout">
        <div class="table-wrap"><table><thead><tr><th>Card</th><th>Color</th><th>MV</th><th>Function</th><th>Quality</th><th>Avg CA</th><th>Strict roles</th><th>Cube Cobra tags</th></tr></thead><tbody id="card-body"></tbody></table></div>
        <aside class="detail" id="card-detail"><div class="note">Select a row to inspect the card image and full evaluation.</div></aside>
      </div>
    </section>

    <section id="adjacency" hidden>
      <h2>Card adjacency lab</h2>
      <p class="lede">Weight a selected group, then rank adjacent cards using either other CubeCobra lists or EDHREC deck lift. The sources remain separate because they describe different formats and populations.</p>
      <div class="adjacency-builder band">
        <div>
          <label for="adjacency-search">Find an anchor in this cube</label>
          <input id="adjacency-search" type="search" placeholder="Card name, theme, or rules text" autocomplete="off">
          <div id="adjacency-search-results" class="anchor-results"></div>
        </div>
        <div>
          <div class="role-head"><h3>Weighted anchors</h3><span id="adjacency-anchor-count">0 selected</span></div>
          <div id="adjacency-anchors" class="anchor-list"></div>
        </div>
      </div>
      <div class="toolbar band">
        <div class="mode-control" id="adjacency-source" role="radiogroup" aria-label="Adjacency evidence source"><label><input type="radio" name="adjacency-source" value="cubecobra" checked><span>CubeCobra co-cubes</span></label><label><input type="radio" name="adjacency-source" value="edhrec"><span>EDHREC Lift</span></label></div>
        <select id="adjacency-coverage" aria-label="Required anchor coverage"><option value="half">At least half of anchors</option><option value="all">Every anchor</option><option value="any">Any anchor</option></select>
        <label class="check-control"><input id="adjacency-exclude" type="checkbox" checked> Exclude selected cards</label>
        <button class="command primary" id="adjacency-run" type="button">Analyze adjacency</button>
        <span id="adjacency-count" class="result-count"></span>
      </div>
      <div id="adjacency-status" class="note">CubeCobra mode compares current cube cards across the quarterly public cube corpus. EDHREC mode can surface cards outside this cube from Commander deck data.</div>
      <div id="adjacency-stats" class="stats"></div>
      <div class="browser-layout band"><div id="adjacency-results" class="candidate-gallery"></div><aside class="detail" id="adjacency-detail"><div class="note">Select a result to inspect every anchor contribution, source count, and weighting step.</div></aside></div>
      <div class="grid-2 band">
        <div class="note"><strong>CubeCobra score:</strong> pair lift is observed co-cube frequency divided by expected co-cube frequency, shown on a base-10 log scale and shrunk toward zero when few cubes contain the pair.</div>
        <div class="note"><strong>EDHREC score:</strong> each raw Lift value becomes log10(Lift), then the selected anchor weights form a weighted mean. A score of 1 means ten times the expected co-occurrence in EDHREC's source decks.</div>
      </div>
    </section>

    <section id="discover" hidden>
      <h2>Discover cards on Scryfall</h2>
      <p class="lede">Build an auditable Scryfall query, compare candidates with the evidence this dashboard actually has, and keep strict classification separate from discovery.</p>
      <div class="preset-list band" aria-label="Saved discovery searches">
        <button class="command" type="button" data-discover-preset="cheat">Cheat engines</button>
        <button class="command" type="button" data-discover-preset="payoffs">Big cheat payoffs</button>
        <button class="command" type="button" data-discover-preset="domain">Domain payoffs</button>
        <button class="command" type="button" data-discover-preset="power">RG Power 4+</button>
        <button class="command" type="button" data-discover-preset="counters">Counter bridges</button>
        <button class="command" type="button" data-discover-preset="blink">Blink bridges</button>
      </div>
      <div class="discover-form">
        <div class="discover-fields">
          <input id="discover-text" type="search" placeholder="Name, Oracle text, or raw Scryfall terms" aria-label="Scryfall text query">
          <input id="discover-tags" type="text" placeholder="Oracle tags, comma separated" aria-label="Scryfall oracle tags">
          <label>MV min <input id="discover-mv-min" type="number" min="0" max="20" aria-label="Minimum mana value"></label>
          <label>MV max <input id="discover-mv-max" type="number" min="0" max="20" aria-label="Maximum mana value"></label>
        </div>
        <div class="discover-fields">
          ${colorPicker('discover-colors')}
          ${typePicker('discover-types')}
          <div class="mode-control" id="discover-type-mode" role="radiogroup" aria-label="Multiple type matching"><label><input type="radio" name="discover-type-mode" value="any" checked><span>Any type</span></label><label><input type="radio" name="discover-type-mode" value="all"><span>All types</span></label></div>
        </div>
        <div class="discover-fields">
          <fieldset class="type-pool" id="discover-rarities"><legend>Rarities</legend>${['common','uncommon','rare','mythic'].map((rarity) => `<label><input type="checkbox" value="${rarity}"><span>${rarity[0].toUpperCase()+rarity.slice(1)}</span></label>`).join('')}<button class="type-clear" type="button">All rarities</button></fieldset>
          <label class="check-control"><input id="discover-exclude" type="checkbox" checked> Exclude current cube</label>
          <select id="discover-sort" aria-label="Candidate sort"><option value="edhrec">EDHREC popularity</option><option value="seventeen-pick">17Lands earliest pick</option><option value="seventeen-score">17Lands game score</option><option value="community">Cube Cobra cube count</option><option value="mv">Mana value</option><option value="name">Name</option></select>
          <button class="command primary" type="button" id="discover-search">Search Scryfall</button>
          <span id="discover-count" class="result-count"></span>
        </div>
        <code id="discover-query" class="query-preview">game:paper</code>
        <div id="discover-status" class="note">Cube Cobra popularity is shown only when the candidate already has a current-cube record. Missing data is labeled unavailable, never zero.</div>
      </div>
      <div class="browser-layout band"><div id="discover-results" class="candidate-gallery"></div><aside class="detail" id="discover-detail"><div class="note">Select a candidate to inspect its rules text, Scryfall evidence, current-cube membership, Cube Cobra demand when available, and 17Lands coverage.</div></aside></div>
      <div class="band">
        <h2>Design guidance behind the searches</h2>
        <div class="attention-grid">
          <div class="note"><strong>Overlap keeps drafts open.</strong> Use broadly playable cards and cards that bridge multiple real themes; too many narrow rewards create on-rails lanes. <a href="https://magic.wizards.com/en/news/feature/building-your-first-cube-2016-05-19" target="_blank" rel="noreferrer">Wizards: Building Your First Cube</a></div>
          <div class="note"><strong>Push enablers before narrow payoffs.</strong> Engines such as Sneak Attack, reanimation, and artifact cheats create stories when multiple payloads and routes connect to them. <a href="https://cubecobra.com/cube/about/dffa3d14-dd73-4c87-919e-57c0d88666ef" target="_blank" rel="noreferrer">Cube Cobra synergy-cube primer</a></div>
          <div class="note"><strong>Playtest for new interactions.</strong> Track whether games created new play patterns and emotional moments, not only whether an archetype won. <a href="https://magic.wizards.com/en/news/making-magic/playtesting" target="_blank" rel="noreferrer">Wizards: Playtesting</a></div>
          <div class="note"><strong>Pick rate and win rate answer different questions.</strong> A late pick can still perform well in the deck that wants it, so the dashboard keeps both metrics separate. <a href="https://magic.wizards.com/en/news/mtg-arena/arena-cube-draft" target="_blank" rel="noreferrer">Wizards: Arena Cube Draft</a></div>
        </div>
      </div>
    </section>

    <section id="tags" hidden>
      <h2>Scryfall tag frequency</h2>
      <p class="lede">All ${data.summary.oracleTagCount} distinct oracle tags and ${data.summary.artTagCount} illustration tags are preserved. Search for exact coverage.</p>
      <div class="toolbar"><input id="tag-search" type="search" placeholder="Search tag"></div>
      <div class="grid-2">
        <div><h2>Oracle tags</h2><div class="table-wrap"><table><thead><tr><th>Tag</th><th>Cards</th></tr></thead><tbody id="oracle-tag-body"></tbody></table></div></div>
        <div><h2>Illustration tags</h2><div class="table-wrap"><table><thead><tr><th>Tag</th><th>Cards</th></tr></thead><tbody id="art-tag-body"></tbody></table></div></div>
      </div>
    </section>
  </main>
  <script>const DATA=${payload};</script>
  <script>
    const q = s => document.querySelector(s);
    const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const debounce=(fn,delay=140)=>{let timer;return(...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay);};};
    DATA.cards.forEach(card=>{card.adjacentMechanics=card.adjacentMechanics||[];card.taxonomyAuditNotes=card.taxonomyAuditNotes||[];card.search=[card.name,card.type,card.oracleText,card.printedOracleText,...card.oracleTags,...card.artTags,...card.proposedTags,...card.adjacentMechanics.map(role=>role.label),...card.archetypeRoles.map(role=>role.archetype+' '+role.role),...card.functionRoles.map(role=>role.label)].join(' ').toLowerCase();});
    const byId = new Map(DATA.cards.map(card => [card.id, card]));
    const mainboard = DATA.cards.filter(card => card.board === 'mainboard');
    let livePreviewMainboard = null;
    const communityPickVolumes = mainboard.map(card=>card.pickCount).sort((a,b)=>a-b);
    const communityPickCutoff = communityPickVolumes[Math.floor(communityPickVolumes.length*.75)] ?? 0;
    const pips = colors => '<span class="colors">' + (colors.length ? colors : ['C']).map(c => '<i class="pip '+c+'" title="'+e(c)+'"><span>'+e(c)+'</span><img src="assets/mana/'+e(c)+'.svg" alt=""></i>').join('') + '</span>';
    const chips = values => '<div class="tag-list">' + values.map(x => '<span class="chip">'+e(x)+'</span>').join('') + '</div>';
    const statusClass = value => String(value).toLowerCase().replaceAll(' ', '-');
    const roleLabel = value => ({enablers:'Enablers',payoffs:'Hard Payoffs',glue:'Glue / Soft Synergy'}[value] || value);
    const cardColorsMatch = (card, color) => color === 'all' || card.colorLabel === color || (color !== 'C' && card.colors.includes(color));
    const selectedColorPool = selector => new Set([...q(selector).querySelectorAll('input:checked')].map(input => input.value));
    const cardColorsMatchPool = (card, selected) => selected.size === 0 || (card.colors.length === 0 ? selected.has('C') : card.colors.every(color => selected.has(color)));
    const cardHasType = (card, type) => type === 'Instant or Sorcery' ? card.type.includes('Instant') || card.type.includes('Sorcery') : card.type.includes(type);
    const cardMatchesType = (card, type) => type === 'all' || cardHasType(card,type);
    const selectedTypePool = selector => new Set([...q(selector).querySelectorAll('input:checked')].map(input => input.value));
    const selectedTypeMode = selector => q(selector+' input:checked')?.value || 'any';
    const cardMatchesTypes = (card, selected, mode='any') => selected.size === 0 || (mode === 'all' ? [...selected].every(type=>cardHasType(card,type)) : [...selected].some(type=>cardHasType(card,type)));
    const cardMatchesFunction = (card, role) => role === 'all' || card.functionRoles.some(item => item.id === role);
    const cardMatchesPerformance = (card, mode) => mode === 'all'
      || (mode === 'seventeen-rated' && card.seventeenLands?.score != null)
      || (mode === 'seventeen-top' && card.seventeenLands?.score >= 75)
      || (mode === 'seventeen-early' && card.seventeenLands?.avgPick != null && card.seventeenLands.avgPick <= 5)
      || (mode === 'community-top' && card.pickCount >= communityPickCutoff);
    const bindColorPool = (selector, render) => {
      const root=q(selector);
      root.querySelectorAll('input').forEach(input=>input.addEventListener('change',render));
      root.querySelector('.color-clear').addEventListener('click',()=>{root.querySelectorAll('input').forEach(input=>{input.checked=false;});render();});
    };
    const bindTypePool = (selector, render) => {
      const root=q(selector);
      root.querySelectorAll('input').forEach(input=>input.addEventListener('change',render));
      root.querySelector('.type-clear').addEventListener('click',()=>{root.querySelectorAll('input').forEach(input=>{input.checked=false;});render();});
    };
    const sortCards = (cards, mode, direction='desc') => {
      const factor=direction==='asc'?1:-1;
      const value=card=>{
        if(mode==='mv')return card.cmc;
        if(mode==='name')return card.name;
        if(mode==='advantage')return card.quality.averageAdvantage;
        if(mode==='best')return card.quality.bestAdvantage;
        if(mode==='seventeen-score')return card.seventeenLands?.score;
        if(mode==='seventeen-pick')return card.seventeenLands?.avgPick;
        if(mode==='community-picks')return card.pickCount;
        if(mode==='elo')return card.quality.elo;
        return card.quality.score;
      };
      return [...cards].sort((a,b)=>{
        const av=value(a),bv=value(b),aMissing=av==null||Number.isNaN(av),bMissing=bv==null||Number.isNaN(bv);
        if(aMissing!==bMissing)return aMissing?1:-1;
        if(!aMissing){
          const compared=typeof av==='string'?av.localeCompare(bv):av-bv;
          if(compared)return compared*factor;
        }
        return a.name.localeCompare(b.name);
      });
    };
    const cardTile = card => '<button class="card-tile" data-card-id="'+e(card.id)+'"><figure><img src="'+e(card.image)+'" alt="'+e(card.name)+'" loading="lazy"><figcaption><strong>'+e(card.name)+'</strong><small>'+e(card.functionRoles.map(role=>role.label).join(' + ')||'Unlabeled function')+'</small><small>'+e(card.quality.standaloneTier)+' | local '+card.quality.score+' | Avg CA '+e(card.quality.advantageLabel)+(card.seventeenLands?' | 17L '+card.seventeenLands.score+' '+e(card.seventeenLands.grade)+' | avg pick '+card.seventeenLands.avgPick:'')+' | CC picks '+card.pickCount.toLocaleString()+'</small></figcaption></figure></button>';
    const cutCardTile = card => '<button class="card-tile" data-card-id="'+e(card.id)+'"><figure><img src="'+e(card.image)+'" alt="'+e(card.name)+'" loading="lazy"><figcaption><strong>'+e(card.name)+'</strong><small class="'+statusClass(card.weakness.reviewTier)+'">'+e(card.weakness.reviewTier)+' '+card.weakness.reviewScore+' | '+card.weakness.negativeSignals+' signals | '+card.weakness.meaningfulThemeCount+' meaningful themes</small></figcaption></figure></button>';
    const bindCardButtons = (root, target) => root.querySelectorAll('[data-card-id]').forEach(button => button.addEventListener('click', () => showCard(button.dataset.cardId, target)));
    const showCard = (id, target) => {
      const card = byId.get(id); if (!card) return;
      const roles = card.archetypeRoles.map(role => '<p class="case"><strong>'+e(role.archetype)+' - '+e(roleLabel(role.role))+'</strong><br><code>'+e(role.ruleId)+'</code><br>'+e(role.reason)+'</p>').join('');
      const functions = card.functionRoles.map(role => '<p class="case"><strong>'+e(role.label)+'</strong><br>'+e(role.reason)+'</p>').join('');
      const adjacent = card.adjacentMechanics.map(role => '<p class="case"><strong>'+e(role.label)+'</strong><br>'+e(role.reason)+'</p>').join('');
      const ql = card.quality;
      const sl = card.seventeenLands;
      const weak = card.weakness;
      const weakness = weak ? '<h3>Cut review</h3><p><strong class="'+statusClass(weak.reviewTier)+'">'+e(weak.reviewTier)+'</strong> | review score '+weak.reviewScore+'/100</p>'+
        (weak.reasons.length?'<h3>Negative signals</h3>'+weak.reasons.map(reason=>'<p class="case"><strong>'+e(reason.label)+'</strong><br>'+e(reason.evidence)+'</p>').join(''):'')+
        (weak.protections.length?'<h3>Protections</h3>'+weak.protections.map(reason=>'<p class="case"><strong>'+e(reason.label)+'</strong><br>'+e(reason.evidence)+'</p>').join(''):'')+
        '<h3>Community demand</h3><p>'+card.pickCount.toLocaleString()+' CubeCobra community picks | '+card.cubeCount.toLocaleString()+' cubes | first printed '+(card.firstPrintYear||'unknown')+'<br>'+(weak.communityHistoryMature?'Pick-volume percentile '+weak.communityPickVolumePercentile+'; cube-count percentile '+weak.communityCubeCountPercentile+'.':'Too recent or undated for a low-demand penalty.')+'<br>'+e(weak.localPickEvidence)+'</p>' : '';
      q(target).innerHTML = (card.image ? '<img src="'+e(card.image)+'" alt="'+e(card.name)+'">' : '')+
        '<h3>'+e(card.name)+'</h3><p>'+e(card.type)+' | '+e(card.colorLabel)+' | MV '+card.cmc+(card.power ? ' | '+e(card.power)+'/'+e(card.toughness) : '')+(card.faceCount>1?' | '+card.faceCount+' faces ('+e(card.layout)+')':'')+'</p>'+
        weakness+
        '<div class="case-grid"><div><span>Average raw CA</span><strong>'+e(ql.advantageLabel)+'</strong></div><div><span>Best case</span><strong>'+e(ql.bestAdvantageLabel)+'</strong></div></div>'+
        '<p class="case"><strong>Average:</strong> '+e(ql.averageCase)+'</p><p class="case"><strong>Best:</strong> '+e(ql.bestCase)+'</p>'+
        '<h3>Standalone quality</h3><p><strong class="'+statusClass(ql.standaloneTier)+'">'+e(ql.standaloneTier)+'</strong> | score '+ql.score+'/100 | synergy need '+e(ql.synergyNeed)+' | community ELO '+ql.elo+' ('+ql.eloPercentile+'th percentile)</p>'+
        (sl ? '<h3>17Lands Powered Cube</h3><p><strong>'+sl.score+'/100 ('+e(sl.grade)+')</strong> | GIH WR '+(sl.gihWinRate*100).toFixed(1)+'% over '+sl.gamesInHand.toLocaleString()+' games in hand | IIH '+(sl.improvementInHand*100).toFixed(1)+' points | avg seen '+sl.avgSeen+' | avg pick '+sl.avgPick+'</p>' : '<h3>17Lands Powered Cube</h3><p>No matching card in the public 2025 Powered Cube dataset.</p>')+
        '<h3>Combat timing</h3><p>'+e(ql.speed)+' | '+e(ql.combatEffectiveness)+' impact<br>'+e(ql.combatRole)+'</p>'+
        (card.hasCubeOverride ? '<h3>Cube rules text (sharpied)</h3><p>'+e(card.cubeOracleText)+'</p><h3>Printed rules text</h3><p>'+e(card.printedOracleText)+'</p>' : '<h3>Rules text</h3><p>'+e(card.oracleText)+'</p>')+
        (ql.strengths.length ? '<h3>Strengths</h3>'+chips(ql.strengths) : '')+
        (ql.caveats.length ? '<h3>Caveats</h3>'+chips(ql.caveats) : '')+
        '<h3>Function labels</h3>'+(functions || '<p>No functional label assigned.</p>')+
        '<h3>Strict theme fit</h3><p><strong>'+card.strictThemeCount+' of '+DATA.overlapDistribution.themeCount+' themes ('+card.strictThemePercent+'%)</strong></p>'+
        '<h3>Accepted roles</h3>'+(roles || '<p>No strict theme role assigned.</p>')+
        '<h3>Adjacent mechanics (not Blink)</h3>'+(adjacent || '<p>No adjacent copy, self-bounce, or graveyard-return route detected.</p>')+
        '<h3>Audit status</h3><p>'+e(card.taxonomyAuditStatus||'live preview pending')+'</p>'+(card.taxonomyAuditNotes.length?chips(card.taxonomyAuditNotes):'')+
        '<h3>Cube Cobra tags</h3>'+chips(card.proposedTags)+'<h3>Scryfall oracle tags</h3>'+chips(card.oracleTags)+'<h3>Illustration tags</h3>'+chips(card.artTags)+
        (card.scryfallUri ? '<p><a href="'+e(card.scryfallUri)+'" target="_blank" rel="noreferrer">Open on Scryfall</a></p>' : '');
    };

    const viewGroups = {
      overview: [['overview','Overview']],
      browse: [['themes','Strict Themes and All'],['types','Type Census'],['cards','Data Explorer']],
      health: [['health','Theme Health'],['guilds','Guild Experiments'],['overlap','Card Overlap'],['focus','Existing Lanes'],['map','Synergy Map'],['packets','Draft Packets'],['blink','Blink by Color'],['hidden','Weak Themes'],['tribes','Creature Types']],
      review: [['cuts','Cut Review'],['review','Tag Review Queue'],['seventeen','17Lands'],['quality','Card Quality']],
      discover: [['adjacency','Card Adjacency'],['discover','Scryfall Discovery'],['tags','Scryfall Tag Census']],
    };
    let activeGroup='overview';
    const initializedViews=new Set(['overview']);
    const viewInitializers={};
    const activateView = (group, sectionId = null) => {
      activeGroup=group;
      const views=viewGroups[group];
      const selected=views.some(([id])=>id===sectionId)?sectionId:views[0][0];
      let activeTab=null;
      document.querySelectorAll('.tab').forEach(x=>{const active=x.dataset.group===group;x.setAttribute('aria-selected',String(active));x.tabIndex=active?0:-1;if(active)activeTab=x;});
      document.querySelectorAll('main > section').forEach(x=>{x.hidden=x.id!==selected;x.setAttribute('role','tabpanel');});
      const selector=q('#subview-select'),wrap=q('#subview-wrap');
      selector.innerHTML=views.map(([id,label])=>'<option value="'+e(id)+'"'+(id===selected?' selected':'')+'>'+e(label)+'</option>').join('');
      wrap.hidden=views.length<2;
      if(!initializedViews.has(selected)&&viewInitializers[selected]){viewInitializers[selected]();initializedViews.add(selected);}
      if(selected==='map')requestAnimationFrame(drawSynergyMap);
      activeTab?.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});
      window.scrollTo({top:0,behavior:'auto'});
    };
    document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>activateView(btn.dataset.group,btn.dataset.tab)));
    document.querySelector('nav[role="tablist"]').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('.tab')],current=tabs.indexOf(document.activeElement);let next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(current+1)%tabs.length:(current-1+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();});
    q('#subview-select').addEventListener('change',event=>activateView(activeGroup,event.target.value));

    const archetypeOptions = '<option value="all">All mainboard cards</option>'+DATA.themes.map(a => '<option value="'+e(a.id)+'">'+e(a.name)+'</option>').join('');
    q('#change-note').innerHTML='Live list refreshed from version <strong>'+e(DATA.changes.fromVersion??'unknown')+'</strong> to <strong>'+e(DATA.changes.toVersion)+'</strong>. Added '+DATA.changes.added.map(x=>e(x.name)).join(', ')+'. Removed '+DATA.changes.removed.map(x=>e(x.name)).join(', ')+'.';
    const changedCards=DATA.changes.added.map(change=>byId.get(change.cardId)).filter(Boolean);q('#change-gallery').innerHTML=changedCards.map(cardTile).join('');q('#change-count').textContent=changedCards.length+' current additions';bindCardButtons(q('#change-gallery'),'#theme-detail');
    q('#theme-select').innerHTML = archetypeOptions;
    q('#deal-archetype').innerHTML = DATA.themes.map(a => '<option value="'+e(a.id)+'">'+e(a.name)+'</option>').join('');
    const renderThemes = () => {
      const themeValue=q('#theme-select').value;
      const allMode=themeValue==='all';
      const archetype = DATA.themes.find(a => a.id === themeValue);
      const selectedRole = q('#theme-role').value;
      const colors = selectedColorPool('#theme-colors');
      const types = selectedTypePool('#theme-types');
      const typeMode = selectedTypeMode('#theme-type-mode');
      const performance = q('#theme-performance').value;
      const sorting = q('#theme-sort').value;
      const sortDirection = selectedTypeMode('#theme-sort-direction');
      const fn=q('#theme-function').value;
      const term=q('#theme-search').value.trim().toLowerCase();
      q('#theme-role').disabled=allMode;
      if(allMode){
        q('#theme-role').value='all';
        const source=livePreviewMainboard||mainboard;
        const cards=sortCards(source.filter(card=>cardColorsMatchPool(card,colors)&&cardMatchesTypes(card,types,typeMode)&&cardMatchesPerformance(card,performance)&&cardMatchesFunction(card,fn)&&(!term||card.search.includes(term))),sorting,sortDirection);
        const rated=cards.filter(card=>card.seventeenLands?.score!=null);
        q('#theme-stats').innerHTML='<div class="stat"><strong>'+cards.length+'</strong><span>Mainboard cards shown</span></div><div class="stat"><strong>'+rated.length+'</strong><span>17Lands rated</span></div><div class="stat"><strong>'+cards.filter(card=>cardMatchesFunction(card,'interaction')).length+'</strong><span>Interaction</span></div><div class="stat"><strong>'+cards.filter(card=>cardMatchesFunction(card,'value')).length+'</strong><span>Value</span></div><div class="stat"><strong>'+cards.filter(card=>card.livePending).length+'</strong><span>Pending strict analysis</span></div>';
        q('#theme-groups').innerHTML='<div class="role-section"><div class="role-head"><h3>All mainboard cards</h3><span>'+(livePreviewMainboard?'Live Cube Cobra preview':'Analyzed snapshot')+'</span></div>'+(cards.length?'<div class="card-gallery">'+cards.map(cardTile).join('')+'</div>':'<p class="empty">No cards match these filters.</p>')+'</div>';
        q('#theme-count').textContent=cards.length+' cards shown';
        bindCardButtons(q('#theme-groups'),'#theme-detail');
        return;
      }
      const pack = DATA.packModel.find(item => item.archetypeId === archetype.id);
      const filteredRoleCards = Object.fromEntries(['enablers','payoffs','glue'].map(role => [role, archetype.roleCardIds[role].map(id=>byId.get(id)).filter(card=>card&&cardColorsMatchPool(card,colors)&&cardMatchesTypes(card,types,typeMode)&&cardMatchesPerformance(card,performance)&&cardMatchesFunction(card,fn)&&(!term||card.search.includes(term)))]));
      const ratio = filteredRoleCards.payoffs.length ? Math.round(filteredRoleCards.enablers.length/filteredRoleCards.payoffs.length*100)/100 : (filteredRoleCards.enablers.length ? 'Inf' : 0);
      const performanceCards=[...new Map(Object.values(filteredRoleCards).flat().map(card=>[card.id,card])).values()];
      const rated=performanceCards.filter(card=>card.seventeenLands?.score!=null);
      const average=(cards,getter,digits=1)=>cards.length?(cards.reduce((sum,card)=>sum+getter(card),0)/cards.length).toFixed(digits):'n/a';
      q('#theme-stats').innerHTML = '<div class="stat"><strong>'+filteredRoleCards.enablers.length+'</strong><span>Enablers shown</span></div><div class="stat"><strong>'+filteredRoleCards.payoffs.length+'</strong><span>Hard payoffs shown</span></div><div class="stat"><strong>'+filteredRoleCards.glue.length+'</strong><span>Glue / soft synergy shown</span></div><div class="stat"><strong>'+e(ratio)+'</strong><span>Filtered enabler : payoff</span></div><div class="stat"><strong>'+rated.length+'</strong><span>17Lands rated</span></div><div class="stat"><strong>'+average(rated,card=>card.seventeenLands.score)+'</strong><span>Average 17Lands score</span></div><div class="stat"><strong>'+average(rated,card=>card.seventeenLands.avgPick)+'</strong><span>Average 17Lands pick</span></div><div class="stat"><strong>'+Math.round(Number(average(performanceCards,card=>card.pickCount,0))||0).toLocaleString()+'</strong><span>Average community picks</span></div><div class="stat"><strong>'+pack.packet.bothChance+'%</strong><span>Global pack sees both</span></div><div class="stat"><strong>'+pack.table.bothChance+'%</strong><span>Global 8-pack table sees both</span></div>';
      const roles = selectedRole === 'all' ? ['enablers','payoffs','glue'] : [selectedRole];
      let shown = 0;
      q('#theme-groups').innerHTML = roles.map(role => {
        const cards = sortCards(filteredRoleCards[role], sorting, sortDirection);
        shown += cards.length;
        return '<div class="role-section"><div class="role-head"><h3>'+roleLabel(role)+'</h3><span>'+cards.length+' cards</span></div>'+(cards.length ? '<div class="card-gallery">'+cards.map(cardTile).join('')+'</div>' : '<p class="empty">No cards match the selected color, type, and performance filters.</p>')+'</div>';
      }).join('');
      q('#theme-count').textContent = shown+' role assignments shown';
      bindCardButtons(q('#theme-groups'),'#theme-detail');
    };
    ['#theme-select','#theme-role','#theme-function','#theme-performance','#theme-sort'].forEach(sel => q(sel).addEventListener('change',renderThemes));
    q('#theme-search').addEventListener('input',debounce(renderThemes));
    q('#theme-type-mode').querySelectorAll('input').forEach(input=>input.addEventListener('change',renderThemes));
    q('#theme-sort-direction').querySelectorAll('input').forEach(input=>input.addEventListener('change',renderThemes));
    bindColorPool('#theme-colors',renderThemes);
    bindTypePool('#theme-types',renderThemes);
    viewInitializers.themes=renderThemes;

    const averageOf=(cards,getter)=>cards.length?cards.reduce((sum,card)=>sum+getter(card),0)/cards.length:null;
    const themeEvidence = theme => {
      const cards=[...new Map(Object.values(theme.roleCardIds).flat().map(id=>[id,byId.get(id)])).values()].filter(Boolean);
      const rated=cards.filter(card=>card.seventeenLands?.score!=null);
      return {cards,rated,score:averageOf(rated,card=>card.seventeenLands.score),pick:averageOf(rated,card=>card.seventeenLands.avgPick),community:cards.reduce((sum,card)=>sum+card.pickCount,0)};
    };
    const compactRows=(items)=>{const max=Math.max(1,...items.map(([,value])=>value));return items.map(([label,value,extra=''])=>'<div class="compact-row"><span>'+label+'</span><i class="compact-bar" style="width:'+Math.max(2,Math.round(value/max*100))+'%"></i><strong>'+value.toLocaleString()+e(extra)+'</strong></div>').join('');};
    const renderOverviewThemes=()=>{
      const mode=q('#overview-theme-sort').value;
      const items=DATA.themes.map(theme=>({theme,evidence:themeEvidence(theme)})).sort((a,b)=>{
        if(mode==='pick')return (a.evidence.pick??99)-(b.evidence.pick??99)||b.theme.score-a.theme.score;
        if(mode==='score')return (b.evidence.score??-1)-(a.evidence.score??-1)||b.theme.score-a.theme.score;
        if(mode==='community')return b.evidence.community-a.evidence.community||b.theme.score-a.theme.score;
        return b.theme.score-a.theme.score;
      });
      q('#overview-themes').innerHTML=items.map(({theme,evidence})=>'<button class="theme-summary" data-theme-id="'+e(theme.id)+'"><header><strong>'+e(theme.name)+'</strong><span class="status '+statusClass(theme.status)+'">'+e(theme.status)+'</span></header><div class="bar"><i style="width:'+theme.score+'%"></i></div><small>'+theme.enablers+' E | '+theme.payoffs+' P | '+theme.glue+' glue | '+evidence.rated.length+' rated'+(evidence.pick!=null?' | avg pick '+evidence.pick.toFixed(1):'')+(evidence.score!=null?' | 17L '+evidence.score.toFixed(1):'')+'</small></button>').join('');
      q('#overview-themes').querySelectorAll('[data-theme-id]').forEach(button=>button.addEventListener('click',()=>{q('#theme-select').value=button.dataset.themeId;renderThemes();activateView('browse','themes');}));
    };
    const renderOverview=()=>{
      const nonlands=mainboard.filter(card=>!card.isLand);
      const curve=[['0-1',nonlands.filter(card=>card.cmc<=1).length],['2',nonlands.filter(card=>card.cmc===2).length],['3',nonlands.filter(card=>card.cmc===3).length],['4',nonlands.filter(card=>card.cmc===4).length],['5',nonlands.filter(card=>card.cmc===5).length],['6',nonlands.filter(card=>card.cmc===6).length],['7+',nonlands.filter(card=>card.cmc>=7).length]];
      const colors=['W','U','B','R','G','C'].map(color=>[color,mainboard.filter(card=>color==='C'?card.colors.length===0:card.colors.includes(color)).length]);
      const types=['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Land'].map(type=>[e(type),DATA.typeCounts[type]||0]);
      const functions=[['Interaction',DATA.functionCounts.Interaction],['Value',DATA.functionCounts.Value]];
      q('#overview-stats').innerHTML=[['Mainboard',DATA.cube.mainboardCount],['Strict themes',DATA.themes.length],['Themes / card',DATA.overlapDistribution.averageThemesPerCard],['Multi-theme',DATA.overlapDistribution.multiThemePercent+'%'],['17Lands coverage',DATA.summary.seventeenLandsCoverage],['Likely cuts',DATA.summary.likelyCutCount],['Oracle tags',DATA.summary.oracleTagCount],['Snapshot version','v'+DATA.cube.version]].map(([label,value])=>'<div class="overview-stat"><strong>'+e(value)+'</strong><span>'+e(label)+'</span></div>').join('');
      q('#overview-curve').innerHTML=compactRows(curve);
      q('#overview-colors').innerHTML=compactRows(colors.map(([color,value])=>[pips(color==='C'?[]:[color]),value]));
      q('#overview-types').innerHTML=compactRows(types);
      q('#overview-functions').innerHTML=compactRows(functions);
      q('#overview-weak').innerHTML='<div class="compact-list">'+DATA.themes.slice().sort((a,b)=>a.score-b.score).slice(0,7).map(theme=>'<button class="all-card-row" data-theme-id="'+e(theme.id)+'"><strong>'+e(theme.name)+'</strong><br><small>'+e(theme.status)+' | '+theme.enablers+' E | '+theme.payoffs+' P | score '+theme.score+'</small></button>').join('')+'</div>';
      q('#overview-weak').querySelectorAll('[data-theme-id]').forEach(button=>button.addEventListener('click',()=>{q('#theme-select').value=button.dataset.themeId;renderThemes();activateView('browse','themes');}));
      const attention=mainboard.filter(card=>card.weakness?.reviewTier==='Likely cut').sort((a,b)=>b.weakness.reviewScore-a.weakness.reviewScore);
      q('#overview-attention').innerHTML=attention.map(card=>'<button class="all-card-row" data-card-id="'+e(card.id)+'"><strong>'+e(card.name)+'</strong><br><small>'+card.weakness.negativeSignals+' independent signals | '+card.strictThemeCount+' strict themes</small></button>').join('')||'<p class="empty">No likely-cut cards in this snapshot.</p>';
      q('#overview-attention').querySelectorAll('[data-card-id]').forEach(button=>button.addEventListener('click',()=>{activateView('review','cuts');showCard(button.dataset.cardId,'#cut-detail');}));
      renderOverviewThemes();
    };
    q('#overview-theme-sort').addEventListener('change',renderOverviewThemes);
    renderOverview();

    const countNames=cards=>{const counts=new Map();cards.forEach(card=>counts.set(card.name,(counts.get(card.name)||0)+1));return counts;};
    const nameDiff=(before,after)=>{const a=countNames(before),b=countNames(after),added=[],removed=[];for(const [name,count] of b){const delta=count-(a.get(name)||0);for(let i=0;i<delta;i++)added.push(name);}for(const [name,count] of a){const delta=count-(b.get(name)||0);for(let i=0;i<delta;i++)removed.push(name);}return {added,removed};};
    const normalizeLiveEntry=(entry,position,queues)=>{
      const existing=queues.get(entry.cardID)?.shift();
      if(existing)return existing;
      const details=entry.details||{},colors=[...(details.color_identity||[])],tags=entry.tags||[];
      const functionRoles=tags.filter(tag=>['Function: Interaction','Function: Value'].includes(tag)).map(tag=>({id:tag.slice(10).toLowerCase().replaceAll(' ','-'),label:tag.slice(10),reason:'Live Cube Cobra tag; strict snapshot has not been rebuilt.'}));
      const id='live:'+position+':'+(entry.cardID||details.name||'card');
      const card={id,cardID:entry.cardID,board:'mainboard',name:details.name||entry.cardID||'Unknown card',type:details.type||'',layout:details.layout||'normal',faceCount:details.image_flip?2:1,colors,colorLabel:colors.length?colors.join(''):'C',cmc:Number(details.cmc||0),isLand:/\\bLand\\b/i.test(details.type||''),image:details.image_normal||details.image_small||'',oracleText:details.oracle_text||'',printedOracleText:details.oracle_text||'',cubeOracleText:'',hasCubeOverride:false,power:String(details.power||''),toughness:String(details.toughness||''),functionRoles,archetypeRoles:[],adjacentMechanics:[],taxonomyAuditStatus:'live preview pending',taxonomyAuditNotes:[],proposedTags:tags,oracleTags:details.oracle_tags||[],artTags:details.art_tags||[],scryfallUri:details.scryfall_uri||'',pickCount:Number(details.pickCount||0),cubeCount:Number(details.cubeCount||0),strictThemeCount:0,strictThemePercent:0,seventeenLands:null,weakness:null,livePending:true,quality:{standaloneTier:'Pending analysis',score:0,advantageLabel:'n/a',bestAdvantageLabel:'n/a',averageAdvantage:0,bestAdvantage:0,averageCase:'Refetched from Cube Cobra; run the verified local rebuild for quality analysis.',bestCase:'Pending strict analysis.',synergyNeed:'Unknown',elo:Number(details.elo||0),eloPercentile:0,speed:'Unknown',combatEffectiveness:'Unknown',combatRole:'Pending analysis',strengths:[],caveats:['Live preview only']}};
      card.search=[card.name,card.type,card.oracleText,...tags,...card.oracleTags].join(' ').toLowerCase();
      byId.set(id,card);return card;
    };
    const refetchCube=async()=>{
      const buttons=[q('#refetch-button'),q('#overview-refetch')];buttons.forEach(button=>{button.disabled=true;button.textContent='Refetching...';});
      q('#freshness-status').textContent='Reading the public Cube Cobra list...';
      try{
        const response=await fetch('https://cubecobra.com/cube/api/cubeJSON/style',{headers:{Accept:'application/json'}});if(!response.ok)throw new Error('Cube Cobra returned HTTP '+response.status);
        const live=await response.json(),entries=live.cards?.mainboard||[];
        const queues=new Map();mainboard.forEach(card=>{if(!queues.has(card.cardID))queues.set(card.cardID,[]);queues.get(card.cardID).push(card);});
        livePreviewMainboard=entries.map((entry,index)=>normalizeLiveEntry(entry,index,queues));
        const diff=nameDiff(mainboard,livePreviewMainboard),current=Number(live.version||0),same=current===Number(DATA.cube.version)&&diff.added.length===0&&diff.removed.length===0;
        q('#freshness-status').textContent=same?'Snapshot is current at v'+current+'.':'Live Cube Cobra is v'+current+'; strict analysis remains snapshot v'+DATA.cube.version+'.';
        q('#freshness-diff').innerHTML='<strong>'+livePreviewMainboard.length+' live mainboard cards.</strong> Added: '+e(diff.added.join(', ')||'none')+'. Removed: '+e(diff.removed.join(', ')||'none')+'.';
        if(q('#theme-select').value==='all')renderThemes();
      }catch(error){q('#freshness-status').textContent='Refetch failed without changing the snapshot.';q('#freshness-diff').textContent=error.message;}
      finally{buttons.forEach(button=>{button.disabled=false;button.textContent=button.id==='refetch-button'?'Refetch':'Refetch Cube Cobra';});}
    };
    q('#refetch-button').addEventListener('click',refetchCube);q('#overview-refetch').addEventListener('click',refetchCube);

    const experimentResearch = {
      'rg-power-four':'rg-power-four-payoffs',
      'rg-power-matters':'rg-power-matters-payoffs',
      'ug-counters':'ug-counter-payoffs',
      'ug-landfall':'ug-landfall-payoffs',
      'gw-counters':'gw-counter-payoffs'
    };
    q('#guild-select').innerHTML=DATA.guildExperiments.map(x=>'<option value="'+e(x.id)+'">'+e(x.name)+'</option>').join('');
    q('#rg-precedents').innerHTML=DATA.research.precedents.map(x=>'<p class="case"><strong>'+e(x.set)+'</strong><br>'+e(x.finding)+'<br><a href="'+e(x.url)+'" target="_blank" rel="noreferrer">Official article</a></p>').join('');
    const renderGuild = () => {
      const experiment=DATA.guildExperiments.find(x=>x.id===q('#guild-select').value)||DATA.guildExperiments[0];
      const visibility=experiment.visibility;
      q('#guild-verdict').innerHTML='<strong>'+e(experiment.name)+':</strong> '+e(experiment.verdict)+' <strong>Balance goal:</strong> '+(experiment.balanceGoalMet?'met':'not met')+'.';
      q('#guild-stats').innerHTML='<div class="stat"><strong>'+experiment.roleCardIds.enablers.length+'</strong><span>Enablers</span></div><div class="stat"><strong>'+experiment.roleCardIds.payoffs.length+'</strong><span>Hard payoffs</span></div><div class="stat"><strong>'+experiment.colors[0]+': '+experiment.roleColorContributions.payoffs[experiment.colors[0]]+'</strong><span>Hard payoffs using first color</span></div><div class="stat"><strong>'+experiment.colors[1]+': '+experiment.roleColorContributions.payoffs[experiment.colors[1]]+'</strong><span>Hard payoffs using second color</span></div><div class="stat"><strong>'+visibility.packet.bothChance+'%</strong><span>One pack sees both</span></div><div class="stat"><strong>'+visibility.table.bothChance+'%</strong><span>Eight packs see both</span></div><div class="stat"><strong>'+experiment.flexibleCards.length+'</strong><span>Support multiple themes</span></div>';
      q('#guild-content').innerHTML=['enablers','payoffs','glue'].map(role=>roleGallery(roleLabel(role),experiment.roleCardIds[role])).join('')+'<div class="role-section"><div class="role-head"><h3>Flexible support</h3><span>'+experiment.flexibleCards.length+' cards</span></div><div class="card-gallery">'+experiment.flexibleCards.slice(0,80).map(item=>cardTile(byId.get(item.id))).join('')+'</div></div>';
      q('#guild-count').textContent=experiment.supportIds.length+' distinct support cards';
      bindCardButtons(q('#guild-content'),'#guild-detail');
      const research=DATA.research.groups.find(group=>group.id===experimentResearch[experiment.id]);
      q('#guild-candidates').innerHTML=research?'<div class="candidate-gallery">'+research.candidates.map(externalCandidate).join('')+'</div>':'<p class="empty">No dedicated candidate search for this comparison lane.</p>';
    };
    q('#guild-select').addEventListener('change',renderGuild);

    q('#overlap-stats').innerHTML='<div class="stat"><strong>'+DATA.overlapDistribution.averageThemesPerCard+'</strong><span>Average themes / card</span></div><div class="stat"><strong>'+DATA.overlapDistribution.multiThemePercent+'%</strong><span>Two or more</span></div><div class="stat"><strong>'+DATA.overlapDistribution.threePlusPercent+'%</strong><span>Three or more</span></div><div class="stat"><strong>'+DATA.overlapDistribution.themeCount+'</strong><span>Strict concepts tested</span></div>';
    q('#overlap-distribution').innerHTML=DATA.overlapDistribution.buckets.map(x=>'<tr><td><strong>'+e(x.label)+'</strong></td><td class="num">'+x.count+'</td><td class="num">'+x.percent+'%</td></tr>').join('');
    const flexibleIds=DATA.overlapDistribution.mostFlexible.map(x=>x.id);
    q('#overlap-gallery').innerHTML=flexibleIds.map(id=>byId.get(id)).filter(Boolean).map(cardTile).join('');
    bindCardButtons(q('#overlap-gallery'),'#overlap-detail');

    q('#cut-stats').innerHTML='<div class="stat"><strong>'+DATA.weaknessSummary.likelyCuts+'</strong><span>Likely cuts</span></div><div class="stat"><strong>'+DATA.weaknessSummary.review+'</strong><span>Needs review</span></div><div class="stat"><strong>'+DATA.weaknessSummary.noStrictHome+'</strong><span>No strict home</span></div><div class="stat"><strong>'+DATA.weaknessSummary.lowImpact+'</strong><span>Low modeled impact</span></div><div class="stat"><strong>'+DATA.weaknessSummary.lowCommunityDemand+'</strong><span>Low community demand</span></div><div class="stat"><strong>'+DATA.weaknessSummary.poweredUnderperformers+'</strong><span>Powered underperformers</span></div>';
    const cutCards=DATA.weakCards.map(item=>byId.get(item.id)).filter(Boolean);
    const renderCuts=()=>{
      const view=q('#cut-view').value,colors=selectedColorPool('#cut-colors'),sort=q('#cut-sort').value;
      let cards=cutCards.filter(card=>cardColorsMatchPool(card,colors));
      if(view==='likely')cards=cards.filter(card=>card.weakness.reviewTier==='Likely cut');
      if(view==='review')cards=cards.filter(card=>card.weakness.reviewTier==='Review');
      if(view==='owner')cards=cards.filter(card=>card.weakness.userRequestedRemoval);
      if(view==='no-home')cards=cards.filter(card=>card.weakness.noStrictHome);
      if(view==='low-impact')cards=cards.filter(card=>card.weakness.lowImpact);
      if(view==='low-demand')cards=cards.filter(card=>card.weakness.reasons.some(reason=>reason.id==='low-community-demand'));
      if(view==='powered')cards=cards.filter(card=>card.weakness.poweredUnderperformer);
      cards.sort((a,b)=>sort==='quality'?a.quality.score-b.quality.score||b.weakness.reviewScore-a.weakness.reviewScore:sort==='elo'?(a.weakness.communityEloPercentile??101)-(b.weakness.communityEloPercentile??101)||a.name.localeCompare(b.name):sort==='name'?a.name.localeCompare(b.name):b.weakness.reviewScore-a.weakness.reviewScore||b.weakness.negativeSignals-a.weakness.negativeSignals||a.name.localeCompare(b.name));
      q('#cut-gallery').innerHTML=cards.map(cutCardTile).join('')||'<p class="empty">No cards match this evidence view and color pool.</p>';
      q('#cut-count').textContent=cards.length+' cards';
      bindCardButtons(q('#cut-gallery'),'#cut-detail');
    };
    ['#cut-view','#cut-sort'].forEach(sel=>q(sel).addEventListener('change',renderCuts));bindColorPool('#cut-colors',renderCuts);viewInitializers.cuts=renderCuts;

    const reviewThemes=[...new Set(DATA.diagnostics.rejectedNominations.map(x=>x.theme))].sort();
    q('#review-theme').innerHTML=reviewThemes.map(name=>'<option>'+e(name)+'</option>').join('');
    const renderReview = () => {
      const name=q('#review-theme').value;
      const items=DATA.diagnostics.rejectedNominations.filter(x=>x.theme===name);
      q('#review-count').textContent=items.length+' rejected nominations';
      q('#review-list').innerHTML=items.map(item=>'<button class="all-card-row" data-card-id="'+e(item.id)+'"><strong>'+e(item.name)+'</strong><br><small>Scryfall suggested: '+e(item.tags.join(', '))+'</small></button>').join('')||'<p class="empty">No rejected nominations for this theme.</p>';
      bindCardButtons(q('#review-list'),'#review-detail');
    };
    q('#review-theme').addEventListener('change',renderReview);
    viewInitializers.review=()=>{renderReview();q('#ambiguous-power').innerHTML=DATA.diagnostics.ambiguousPowerIds.map(id=>byId.get(id)).filter(Boolean).map(cardTile).join('');bindCardButtons(q('#ambiguous-power'),'#review-detail');};

    const roleGallery = (title, ids) => {
      const cards=ids.map(id=>byId.get(id)).filter(Boolean);return '<div class="role-section"><div class="role-head"><h3>'+e(title)+'</h3><span>'+cards.length+' cards</span></div>'+(cards.length?'<div class="card-gallery">'+sortCards(cards,'quality').map(cardTile).join('')+'</div>':'<p class="empty">No cards in this role.</p>')+'</div>';
    };
    const renderFocus = () => {
      const mode=q('#focus-select').value;let groups=[],stats=[];
      if(mode==='artifacts'){const x=DATA.diagnostics.urArtifact;groups=[['UR artifact enablers',x.enablers],['UR explicit artifact hard payoffs',x.payoffs],['UR artifact glue / soft synergy',x.glue]];stats=[['Enablers',x.enablers.length],['Hard payoffs',x.payoffs.length],['Glue / soft synergy',x.glue.length]];}
      if(mode==='noncreature'){const t=DATA.themes.find(x=>x.id==='noncreature-spells');groups=[['Broad noncreature-only rewards',DATA.diagnostics.broadNoncreatureOnlyIds],['All broad noncreature rewards',DATA.diagnostics.noncreaturePayoffIds]];stats=[['All inputs',t.enablers],['Broad payoffs',t.payoffs],['UR payoffs',t.focusRoleCounts.payoffs]];}
      if(mode==='spells'){groups=[['Specific cast rewards being considered for removal',DATA.diagnostics.specificCastRewardIds],['Every card that mentions instant and/or sorcery',DATA.diagnostics.instantSorcerySpecificIds]];stats=[['Specific mentions',DATA.diagnostics.instantSorcerySpecificIds.length],['Narrow cast rewards',DATA.diagnostics.specificCastRewardIds.length]];}
      if(mode==='enchantress'){const x=DATA.diagnostics.gwEnchantress;groups=[['True GW Enchantress draw engines',x.drawEngines],['All GW explicit Enchantress hard payoffs',x.payoffs],['GW enchantments',x.enablers],['GW tutor and recursion glue',x.glue]];stats=[['Enchantments',x.enablers.length],['Hard payoffs',x.payoffs.length],['Draw engines',x.drawEngines.length],['Glue',x.glue.length]];}
      q('#focus-stats').innerHTML=stats.map(([label,value])=>'<div class="stat"><strong>'+value+'</strong><span>'+e(label)+'</span></div>').join('');q('#focus-content').innerHTML=groups.map(([title,ids])=>roleGallery(title,ids)).join('');q('#focus-count').textContent=groups.reduce((sum,g)=>sum+g[1].length,0)+' role assignments';bindCardButtons(q('#focus-content'),'#focus-detail');
    };
    q('#focus-select').addEventListener('change',renderFocus);viewInitializers.focus=renderFocus;

    const bridgeCards=mainboard.filter(card=>!card.type.includes('Basic Land')).map(card=>({card,count:card.strictThemeCount})).filter(x=>x.count>=2).sort((a,b)=>b.count-a.count||b.card.quality.score-a.card.quality.score).slice(0,80);
    viewInitializers.map=()=>{q('#bridge-gallery').innerHTML=bridgeCards.map(x=>cardTile(x.card)).join('');bindCardButtons(q('#bridge-gallery'),'#map-detail');};
    const drawSynergyMap = () => {
      const canvas=q('#synergy-canvas'),ratio=window.devicePixelRatio||1,width=Math.max(320,canvas.clientWidth),height=Math.max(320,canvas.clientHeight);canvas.width=width*ratio;canvas.height=height*ratio;const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.clearRect(0,0,width,height);const themes=DATA.themes,n=themes.length,cx=width/2,cy=height/2,r=Math.min(width*.38,height*.37);const nodes=themes.map((theme,i)=>({theme,x:cx+Math.cos(-Math.PI/2+i*2*Math.PI/n)*r,y:cy+Math.sin(-Math.PI/2+i*2*Math.PI/n)*r}));const byNameNode=new Map(nodes.map(node=>[node.theme.name,node]));
      DATA.overlaps.slice(0,60).forEach(edge=>{const a=byNameNode.get(edge.a),b=byNameNode.get(edge.b);if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='rgba(98,182,217,'+Math.min(.68,.08+edge.percent/160)+')';ctx.lineWidth=Math.max(1,edge.shared/45);ctx.stroke();});
      nodes.forEach(node=>{const radius=13+node.theme.score/10;ctx.beginPath();ctx.arc(node.x,node.y,radius,0,Math.PI*2);ctx.fillStyle=node.theme.score>=80?'#3d9367':node.theme.score>=50?'#337d9e':'#a77727';ctx.fill();ctx.strokeStyle='#e8ecef';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#f3f2ed';ctx.font='600 11px system-ui';ctx.textAlign='center';ctx.fillText(node.theme.name.length>24?node.theme.name.slice(0,22)+'...':node.theme.name,node.x,node.y+radius+14);});const wrap=canvas.parentElement;if(window.innerWidth<=980&&wrap.scrollWidth>wrap.clientWidth&&wrap.scrollLeft===0)wrap.scrollLeft=(wrap.scrollWidth-wrap.clientWidth)/2;
    };
    window.addEventListener('resize',drawSynergyMap);

    const logChoose = (n,k) => { if(k<0||k>n)return -Infinity; const s=Math.min(k,n-k); let r=0; for(let i=1;i<=s;i++)r+=Math.log(n-s+i)-Math.log(i); return r; };
    const probabilityNone = (n,k,d) => k<=0 ? 1 : d>n-k ? 0 : Math.exp(logChoose(n-k,d)-logChoose(n,d));
    const pct = value => Math.round(value*1000)/10;
    const dynamicVisibility = (archetype, players, size) => {
      const eSet=new Set(archetype.roleCardIds.enablers), pSet=new Set(archetype.roleCardIds.payoffs), union=new Set([...eSet,...pSet]), n=mainboard.length;
      const view = draws => { const ne=probabilityNone(n,eSet.size,draws),np=probabilityNone(n,pSet.size,draws),nu=probabilityNone(n,union.size,draws); return {ee:Math.round(eSet.size*draws/n*100)/100,ep:Math.round(pSet.size*draws/n*100)/100,e:pct(1-ne),p:pct(1-np),both:pct(1-ne-np+nu)}; };
      const packet=view(size),table=view(Math.min(n,players*size));
      const signal=table.both>=95&&table.ee>=2&&table.ep>=2?'High visibility':table.both>=80?'Visible':table.both>=60?'Inconsistent':'Scarce';
      return {packet,table,signal,coherent:Math.round(players*packet.both)/100};
    };
    const renderPacketMath = () => {
      const players=Math.max(2,Math.min(16,Number(q('#packet-players').value)||8));
      const size=Math.max(1,Math.min(45,Number(q('#packet-size').value)||15));
      q('#packet-players').value=players; q('#packet-size').value=size;
      q('#packet-body').innerHTML=DATA.themes.map(a=>{const m=dynamicVisibility(a,players,size);return '<tr><td><strong>'+e(a.name)+'</strong></td><td class="status '+statusClass(m.signal)+'">'+e(m.signal)+'</td><td class="num">'+m.table.ee+'</td><td class="num">'+m.table.ep+'</td><td class="num">'+m.packet.e+'%</td><td class="num">'+m.packet.p+'%</td><td class="num">'+m.packet.both+'%</td><td class="num">'+m.coherent+' / '+players+'</td><td class="num">'+m.table.both+'%</td></tr>';}).join('');
    };
    q('#recalculate-packets').addEventListener('click',renderPacketMath);
    const dealPackets = () => {
      const players=Math.max(2,Math.min(16,Number(q('#packet-players').value)||8)),size=Math.max(1,Math.min(45,Number(q('#packet-size').value)||15));
      const archetype=DATA.themes.find(a=>a.id===q('#deal-archetype').value)||DATA.themes[0];
      const deck=[...mainboard]; for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
      const es=new Set(archetype.roleCardIds.enablers),ps=new Set(archetype.roleCardIds.payoffs),gs=new Set(archetype.roleCardIds.glue); let totalE=0,totalP=0,coherent=0;
      q('#packet-deal').innerHTML=Array.from({length:players},(_,i)=>{const packet=deck.slice(i*size,(i+1)*size);const support=packet.filter(c=>es.has(c.id)||ps.has(c.id)||gs.has(c.id));const ec=packet.filter(c=>es.has(c.id)).length,pc=packet.filter(c=>ps.has(c.id)).length,gc=packet.filter(c=>gs.has(c.id)).length;totalE+=ec;totalP+=pc;if(ec&&pc)coherent++;
        const mini=support.map(c=>'<button class="mini-card" data-card-id="'+e(c.id)+'" title="'+e(c.name)+'"><img src="'+e(c.image)+'" alt="'+e(c.name)+'" loading="lazy"><span>'+(es.has(c.id)?'E':'')+(ps.has(c.id)?'P':'')+(gs.has(c.id)?'G':'')+'</span></button>').join('');
        return '<div class="packet"><div class="packet-summary"><strong>Packet '+(i+1)+'</strong>'+ec+' enablers | '+pc+' hard payoffs | '+gc+' soft synergy</div><div class="packet-cards">'+(mini||'<span class="empty">No support cards in this packet.</span>')+'</div></div>';}).join('');
      q('#deal-summary').textContent=totalE+' enablers, '+totalP+' hard payoffs, '+coherent+' coherent packets';
    };
    q('#deal-button').addEventListener('click',dealPackets);q('#deal-archetype').addEventListener('change',dealPackets);viewInitializers.packets=()=>{renderPacketMath();dealPackets();};

    let qualityLimit=160;
    const filteredQualityCards = () => {
      const term=q('#quality-search').value.trim().toLowerCase(),tier=q('#quality-tier').value,speed=q('#quality-speed').value,color=q('#quality-color').value,sort=q('#quality-sort').value;
      return sortCards(mainboard.filter(card => (!term||card.search.includes(term)) && cardColorsMatch(card,color) && (tier==='all'||(tier==='good'&&card.quality.goodOnOwn)||card.quality.standaloneTier===tier) && (speed==='all'||(speed==='combat'&&card.quality.combatSpeed)||card.quality.speed===speed||(speed==='high-combat'&&card.quality.combatEffectiveness==='High'))),sort);
    };
    const renderQuality = (reset=true) => {
      if(reset)qualityLimit=160;const cards=filteredQualityCards(),shown=cards.slice(0,qualityLimit);q('#quality-gallery').innerHTML=shown.map(cardTile).join('')||'<p class="empty">No cards match these filters.</p>';q('#quality-count').textContent='Showing '+shown.length+' of '+cards.length;q('#quality-more').hidden=shown.length>=cards.length;bindCardButtons(q('#quality-gallery'),'#quality-detail');
    };
    ['#quality-tier','#quality-speed','#quality-color','#quality-sort'].forEach(sel=>q(sel).addEventListener('change',()=>renderQuality(true)));q('#quality-search').addEventListener('input',debounce(()=>renderQuality(true)));q('#quality-more').addEventListener('click',()=>{qualityLimit+=160;renderQuality(false);});viewInitializers.quality=()=>renderQuality(true);

    const cutSet=new Set(DATA.seventeenLands.cutCandidateIds);
    const renderSeventeen = () => {
      const term=q('#lands-search').value.trim().toLowerCase(),view=q('#lands-view').value,sort=q('#lands-sort').value;let cards=mainboard.filter(card=>card.seventeenLands&&card.seventeenLands.score!==null&&(!term||card.search.includes(term)));
      if(view==='cuts')cards=cards.filter(card=>cutSet.has(card.id));if(view==='top')cards=cards.filter(card=>card.seventeenLands.score>=75);if(view==='bottom')cards=cards.filter(card=>card.seventeenLands.score<=25);
      cards.sort((a,b)=>sort==='pick'?(a.seventeenLands.avgPick??99)-(b.seventeenLands.avgPick??99):sort==='iih'?(b.seventeenLands.improvementInHand??-99)-(a.seventeenLands.improvementInHand??-99):(view==='cuts'||view==='bottom'?a.seventeenLands.score-b.seventeenLands.score:b.seventeenLands.score-a.seventeenLands.score));
      q('#lands-gallery').innerHTML=cards.map(cardTile).join('')||'<p class="empty">No cards match this view.</p>';q('#lands-count').textContent=cards.length+' cards';bindCardButtons(q('#lands-gallery'),'#lands-detail');
    };
    ['#lands-view','#lands-sort'].forEach(sel=>q(sel).addEventListener('change',renderSeventeen));q('#lands-search').addEventListener('input',debounce(renderSeventeen));
    const externalCandidate=(card)=>'<figure class="candidate"><a href="'+e(card.scryfallUri)+'" target="_blank" rel="noreferrer"><img src="'+e(card.image)+'" alt="'+e(card.name)+'" loading="lazy"></a><figcaption><strong>'+e(card.name)+'</strong><small>'+e(card.type)+' | MV '+card.manaValue+(card.seventeenLands?' | 17Lands '+card.seventeenLands.score+' '+e(card.seventeenLands.grade):' | no Powered Cube data')+'</small></figcaption></figure>';
    viewInitializers.guilds=renderGuild;
    viewInitializers.seventeen=()=>{renderSeventeen();q('#signpost-body').innerHTML=DATA.seventeenLands.signposts.map(item=>{const chance=n=>item.tableChanceByCopies.find(x=>x.copies===n)?.chance??0;return '<tr><td><strong>'+e(item.name)+'</strong><br><small>'+e(item.note)+'</small></td><td class="num">'+item.currentCopies+'</td><td class="num">'+item.currentTableChance+'%</td><td class="num">'+chance(2)+'%</td><td class="num">'+chance(3)+'%</td><td class="num">'+chance(6)+'%</td><td>'+(item.rating?'score '+item.rating.score+' ('+e(item.rating.grade)+'), avg pick '+item.rating.avgPick:'No Powered Cube match')+'</td></tr>';}).join('');q('#candidate-groups').innerHTML=DATA.research.groups.map(group=>'<div class="role-section"><div class="role-head"><h3>'+e(group.label)+'</h3><span>Absent from current cube</span></div><div class="candidate-gallery">'+group.candidates.map(externalCandidate).join('')+'</div></div>').join('');};

    const adjacencyPool=[...new Map(mainboard.filter(card=>card.oracleId).map(card=>[card.oracleId,card])).values()];
    const adjacencyAnchors=new Map();
    let adjacencyData=null;
    let adjacencyResults=[];
    let adjacencyRunMetadata=null;
    let adjacencyRevision=0;
    const adjacencyCorpusByOracle=new Map((DATA.cubeAdjacency?.cards||[]).map(card=>[card.oracleId,card]));
    const adjacencyScore=value=>(value>=0?'+':'')+value.toFixed(3);
    const adjacencyCoveragePass=(support,total)=>{const mode=q('#adjacency-coverage').value;if(mode==='all')return support===total;if(mode==='any')return support>=1;return support>=Math.ceil(total/2);};
    const invalidateAdjacency=()=>{adjacencyRevision+=1;if(!adjacencyRunMetadata&&!adjacencyResults.length)return;adjacencyResults=[];adjacencyRunMetadata=null;q('#adjacency-results').innerHTML='<p class="empty">Inputs changed. Analyze again for current results.</p>';q('#adjacency-count').textContent='Results stale';q('#adjacency-stats').innerHTML='';q('#adjacency-detail').innerHTML='<div class="note">Inputs changed. Analyze again before inspecting a result.</div>';q('#adjacency-status').textContent='Inputs changed. The previous ranking was cleared.';};
    const renderAdjacencySearch=()=>{
      const term=q('#adjacency-search').value.trim().toLowerCase();
      const cards=adjacencyPool.filter(card=>!adjacencyAnchors.has(card.oracleId)&&(!term||card.search.includes(term))).sort((a,b)=>term?a.name.localeCompare(b.name):b.strictThemeCount-a.strictThemeCount||a.name.localeCompare(b.name)).slice(0,30);
      q('#adjacency-search-results').innerHTML=cards.map(card=>'<button class="anchor-result" type="button" data-add-anchor="'+e(card.oracleId)+'"><span><strong>'+e(card.name)+'</strong><small>'+e(card.type)+' | '+card.strictThemeCount+' strict themes</small></span><span>Add</span></button>').join('')||(term?'<p class="empty">No unselected cube card matches.</p>':'<p class="empty">All matching cards are selected.</p>');
      q('#adjacency-search-results').querySelectorAll('[data-add-anchor]').forEach(button=>button.addEventListener('click',()=>{const card=adjacencyPool.find(item=>item.oracleId===button.dataset.addAnchor);if(card){invalidateAdjacency();adjacencyAnchors.set(card.oracleId,{card,weight:1});renderAdjacencyAnchors();renderAdjacencySearch();}}));
    };
    const renderAdjacencyAnchors=()=>{
      const anchors=[...adjacencyAnchors.values()];
      q('#adjacency-anchor-count').textContent=anchors.length+' selected';
      q('#adjacency-anchors').innerHTML=anchors.map(({card,weight})=>{const corpus=adjacencyCorpusByOracle.get(card.oracleId);return '<div class="anchor-row"><span><strong>'+e(card.name)+'</strong><small>'+e(card.archetypeRoles.map(role=>role.archetype).filter((name,index,all)=>all.indexOf(name)===index).join(', ')||'No strict theme role')+'</small><small>CubeCobra corpus: '+(corpus?corpus.cubeCount.toLocaleString()+' cubes':'not in this export')+'</small></span><span class="anchor-row-controls"><select data-anchor-weight="'+e(card.oracleId)+'" aria-label="Weight for '+e(card.name)+'"><option value="1"'+(weight===1?' selected':'')+'>1x</option><option value="2"'+(weight===2?' selected':'')+'>2x</option><option value="3"'+(weight===3?' selected':'')+'>3x</option></select><button class="command" type="button" data-remove-anchor="'+e(card.oracleId)+'" title="Remove '+e(card.name)+'">Remove</button></span></div>';}).join('')||'<p class="empty">No anchors selected.</p>';
      q('#adjacency-anchors').querySelectorAll('[data-anchor-weight]').forEach(select=>select.addEventListener('change',()=>{const anchor=adjacencyAnchors.get(select.dataset.anchorWeight);if(anchor){invalidateAdjacency();anchor.weight=Number(select.value);}}));
      q('#adjacency-anchors').querySelectorAll('[data-remove-anchor]').forEach(button=>button.addEventListener('click',()=>{invalidateAdjacency();adjacencyAnchors.delete(button.dataset.removeAnchor);renderAdjacencyAnchors();renderAdjacencySearch();}));
    };
    const loadCubeAdjacency=async()=>{
      if(adjacencyData)return adjacencyData;
      if(DATA.cubeAdjacency){adjacencyData=DATA.cubeAdjacency;return adjacencyData;}
      const response=await fetch('data/cubecobra-adjacency.json');
      if(!response.ok)throw new Error('CubeCobra adjacency data returned HTTP '+response.status);
      adjacencyData=await response.json();
      return adjacencyData;
    };
    const cubeAdjacency=async anchors=>{
      const data=await loadCubeAdjacency(),byOracle=new Map(data.cards.map(card=>[card.oracleId,card])),n=data.source.qualifyingCubes;
      const mappedAnchors=anchors.map(anchor=>({...anchor,source:byOracle.get(anchor.card.oracleId)}));
      const unavailable=mappedAnchors.filter(anchor=>!anchor.source||anchor.source.cubeCount===0).map(anchor=>({name:anchor.card.name,reason:anchor.source?'0 qualifying cubes':'not present in this export'}));
      const sourceAnchors=mappedAnchors.filter(anchor=>anchor.source&&anchor.source.cubeCount>0);
      if(!sourceAnchors.length)throw new Error('None of the selected cards has CubeCobra corpus coverage.');
      const totalWeight=sourceAnchors.reduce((sum,anchor)=>sum+anchor.weight,0);
      const results=[];
      for(const candidate of data.cards){
        if(q('#adjacency-exclude').checked&&adjacencyAnchors.has(candidate.oracleId))continue;
        const contributions=sourceAnchors.map(anchor=>{
          if(anchor.source.index===candidate.index)return {anchor:anchor.card.name,weight:anchor.weight,coCubes:0,raw:null,adjusted:0};
          const coCubes=data.pairCounts[anchor.source.index][candidate.index],raw=coCubes>0&&anchor.source.cubeCount>0&&candidate.cubeCount>0?Math.log10((coCubes*n)/(anchor.source.cubeCount*candidate.cubeCount)):null;
          const adjusted=raw===null?0:raw*(coCubes/(coCubes+20));
          return {anchor:anchor.card.name,weight:anchor.weight,coCubes,raw,adjusted};
        });
        const support=contributions.filter(item=>item.coCubes>0).length;
        if(!adjacencyCoveragePass(support,sourceAnchors.length))continue;
        const score=contributions.reduce((sum,item)=>sum+item.weight*item.adjusted,0)/totalWeight;
        if(score<=0)continue;
        const localCard=byId.get(candidate.localCardIds[0]);
        results.push({source:'cubecobra',name:candidate.name,image:localCard?.image||candidate.image,type:localCard?.type||candidate.type,currentCard:localCard,score,support,totalAnchors:sourceAnchors.length,pairCount:contributions.reduce((sum,item)=>sum+item.coCubes,0),contributions,candidateCubeCount:candidate.cubeCount,oracleId:candidate.oracleId});
      }
      results.sort((a,b)=>b.score-a.score||b.support-a.support||b.pairCount-a.pairCount||a.name.localeCompare(b.name));
      adjacencyRunMetadata={source:'cubecobra',data,anchors:sourceAnchors.length,unavailable};
      return results.slice(0,160);
    };
    const edhrecSlug=name=>String(name).split(' // ')[0].normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const fetchEdhrecAnchor=async anchor=>{
      const slug=edhrecSlug(anchor.card.name),response=await fetch('https://json.edhrec.com/pages/cards/'+encodeURIComponent(slug)+'.json');
      if(!response.ok)throw new Error(anchor.card.name+' returned HTTP '+response.status);
      const body=await response.json(),lists=body.container?.json_dict?.cardlists||[],byCandidate=new Map();
      for(const list of lists)for(const view of list.cardviews||[]){if(!(view.lift>0)||!String(view.url||'').startsWith('/cards/'))continue;const key=String(view.name||'').toLowerCase(),prior=byCandidate.get(key);if(!prior||Number(view.num_decks||0)>Number(prior.num_decks||0))byCandidate.set(key,view);}
      return {anchor,slug,candidates:byCandidate};
    };
    const enrichAdjacencyCandidates=async results=>{
      const byIdResult=new Map();
      const ids=[...new Set(results.map(result=>result.scryfallId).filter(Boolean))];
      for(let offset=0;offset<ids.length;offset+=75){
        try{const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifiers:ids.slice(offset,offset+75).map(id=>({id}))})});if(!response.ok)continue;const body=await response.json();for(const card of body.data||[])byIdResult.set(card.id,card);}catch{}
      }
      for(const result of results){const card=byIdResult.get(result.scryfallId);if(!card)continue;result.image=discoveryImage(card);result.type=card.type_line||result.type;result.scryfallUri=card.scryfall_uri||'';result.currentCard=cubeByOracle.get(card.oracle_id)||cubeByName.get(card.name.toLowerCase())||result.currentCard;}
    };
    const edhrecAdjacency=async anchors=>{
      if(anchors.length>12)throw new Error('EDHREC mode accepts at most 12 weighted anchors per request.');
      const settled=await Promise.allSettled(anchors.map(fetchEdhrecAnchor)),successful=settled.filter(item=>item.status==='fulfilled').map(item=>item.value),failed=settled.filter(item=>item.status==='rejected').map(item=>item.reason.message);
      if(!successful.length)throw new Error('EDHREC returned no usable anchor pages. '+failed.join('; '));
      const totalWeight=successful.reduce((sum,item)=>sum+item.anchor.weight,0),candidates=new Map();
      for(const item of successful)for(const view of item.candidates.values()){
        const key=String(view.name).toLowerCase();let candidate=candidates.get(key);if(!candidate){candidate={source:'edhrec',name:view.name,scryfallId:view.id,slug:view.slug||edhrecSlug(view.name),type:'',image:'',currentCard:cubeByName.get(key)||null,contributions:[]};candidates.set(key,candidate);}
        const logLift=Math.log10(Number(view.lift));candidate.contributions.push({anchor:item.anchor.card.name,weight:item.anchor.weight,rawLift:Number(view.lift),logLift,numDecks:Number(view.num_decks||0),potentialDecks:Number(view.potential_decks||0)});
      }
      const selectedNames=new Set(anchors.map(anchor=>anchor.card.name.toLowerCase())),results=[];
      for(const candidate of candidates.values()){
        if(q('#adjacency-exclude').checked&&selectedNames.has(candidate.name.toLowerCase()))continue;
        candidate.support=candidate.contributions.length;candidate.totalAnchors=successful.length;
        if(!adjacencyCoveragePass(candidate.support,successful.length))continue;
        candidate.score=candidate.contributions.reduce((sum,item)=>sum+item.weight*item.logLift,0)/totalWeight;
        candidate.pairCount=candidate.contributions.reduce((sum,item)=>sum+item.numDecks,0);
        if(candidate.score>0)results.push(candidate);
      }
      results.sort((a,b)=>b.score-a.score||b.support-a.support||b.pairCount-a.pairCount||a.name.localeCompare(b.name));
      const limited=results.slice(0,160);await enrichAdjacencyCandidates(limited);
      adjacencyRunMetadata={source:'edhrec',anchors:successful.length,failed};
      return limited;
    };
    const showAdjacencyResult=index=>{
      const result=adjacencyResults[index];if(!result)return;
      const contributions=result.source==='cubecobra'?result.contributions.map(item=>'<tr><td>'+e(item.anchor)+'</td><td class="num">'+item.weight+'x</td><td class="num">'+item.coCubes.toLocaleString()+'</td><td class="num">'+(item.raw===null?'unavailable':adjacencyScore(item.raw))+'</td><td class="num">'+adjacencyScore(item.adjusted)+'</td></tr>').join(''):result.contributions.map(item=>'<tr><td>'+e(item.anchor)+'</td><td class="num">'+item.weight+'x</td><td class="num">'+item.numDecks.toLocaleString()+'</td><td class="num">'+item.rawLift.toFixed(2)+'x</td><td class="num">'+adjacencyScore(item.logLift)+'</td></tr>').join('');
      const headers=result.source==='cubecobra'?'<th>Anchor</th><th>Weight</th><th>Co-cubes</th><th>Raw log lift</th><th>Adjusted</th>':'<th>Anchor</th><th>Weight</th><th>Decks</th><th>Raw Lift</th><th>log10 Lift</th>';
      const sourceText=result.source==='cubecobra'?'CubeCobra: '+adjacencyRunMetadata.data.source.qualifyingCubes.toLocaleString()+' public cubes between '+adjacencyRunMetadata.data.source.minimumCubeSize+' and '+adjacencyRunMetadata.data.source.maximumCubeSize+' cards. Candidate appears in '+result.candidateCubeCount.toLocaleString()+' qualifying cubes.':'EDHREC card-to-card Lift from '+result.support+' of '+result.totalAnchors+' successful anchor pages.';
      const links=(result.currentCard?'<button class="command" type="button" id="adjacency-open-current">Inspect current card</button> ':'')+(result.scryfallUri?'<a href="'+e(result.scryfallUri)+'" target="_blank" rel="noreferrer">Open on Scryfall</a> ':'')+(result.source==='edhrec'?'<a href="https://edhrec.com/cards/'+e(result.slug)+'" target="_blank" rel="noreferrer">Open on EDHREC</a>':'');
      q('#adjacency-detail').innerHTML=(result.image?'<img src="'+e(result.image)+'" alt="'+e(result.name)+'">':'')+'<h3>'+e(result.name)+'</h3><p>'+e(result.type)+'</p><div class="case-grid"><div><span>Weighted score</span><strong>'+adjacencyScore(result.score)+'</strong></div><div><span>Anchor coverage</span><strong>'+result.support+' / '+result.totalAnchors+'</strong></div></div><p>'+e(sourceText)+'</p><div class="table-wrap"><table><thead><tr>'+headers+'</tr></thead><tbody>'+contributions+'</tbody></table></div><p>'+links+'</p>';
      q('#adjacency-open-current')?.addEventListener('click',()=>showCard(result.currentCard.id,'#adjacency-detail'));
    };
    const renderAdjacencyResults=()=>{
      q('#adjacency-count').textContent=adjacencyResults.length+' ranked cards';
      q('#adjacency-results').innerHTML=adjacencyResults.map((result,index)=>'<figure class="candidate"><button class="candidate-button" type="button" data-adjacency-index="'+index+'">'+(result.image?'<img src="'+e(result.image)+'" alt="'+e(result.name)+'" loading="lazy">':'')+'<figcaption><strong>'+e(result.name)+'</strong><small>'+e(result.type||'Card')+'</small><small class="adjacency-score">'+adjacencyScore(result.score)+'</small><small>'+result.support+'/'+result.totalAnchors+' anchors | '+result.pairCount.toLocaleString()+' '+(result.source==='cubecobra'?'pair co-cubes':'deck inclusions')+'</small></figcaption></button></figure>').join('')||'<p class="empty">No positive-lift card meets the selected anchor coverage.</p>';
      q('#adjacency-results').querySelectorAll('[data-adjacency-index]').forEach(button=>button.addEventListener('click',()=>showAdjacencyResult(Number(button.dataset.adjacencyIndex))));
    };
    const runAdjacency=async()=>{
      const anchors=[...adjacencyAnchors.values()],source=q('#adjacency-source input:checked').value,button=q('#adjacency-run');
      if(!anchors.length){q('#adjacency-status').textContent='Select at least one anchor card.';return;}
      const runRevision=++adjacencyRevision;
      button.disabled=true;button.textContent='Analyzing...';q('#adjacency-status').textContent=source==='cubecobra'?'Loading the reduced CubeCobra co-cube matrix...':'Reading EDHREC Lift pages for the selected anchors...';
      try{const nextResults=source==='cubecobra'?await cubeAdjacency(anchors):await edhrecAdjacency(anchors);if(runRevision!==adjacencyRevision){adjacencyRunMetadata=null;return;}adjacencyResults=nextResults;renderAdjacencyResults();if(source==='cubecobra'){const d=adjacencyRunMetadata.data,unavailable=adjacencyRunMetadata.unavailable;q('#adjacency-status').innerHTML='<strong>'+d.source.qualifyingCubes.toLocaleString()+' qualifying CubeCobra lists analyzed.</strong> Public export last modified '+e(d.source.sourceLastModified||'unavailable')+'. Scores rank current cube cards only.'+(unavailable.length?' Skipped anchors with no corpus evidence: '+e(unavailable.map(item=>item.name+' ('+item.reason+')').join(', '))+'.':'');q('#adjacency-stats').innerHTML='<div class="stat"><strong>'+adjacencyRunMetadata.anchors+'</strong><span>Modeled anchors</span></div><div class="stat"><strong>'+unavailable.length+'</strong><span>Skipped anchors</span></div><div class="stat"><strong>'+adjacencyResults.length+'</strong><span>Positive results shown</span></div><div class="stat"><strong>'+d.source.qualifyingCubes.toLocaleString()+'</strong><span>Qualifying cubes</span></div><div class="stat"><strong>'+d.cards.length+'</strong><span>Current cards modeled</span></div>';}else{q('#adjacency-status').innerHTML='<strong>'+adjacencyRunMetadata.anchors+' EDHREC anchor pages analyzed.</strong> '+(adjacencyRunMetadata.failed.length?'Unavailable: '+e(adjacencyRunMetadata.failed.join('; '))+'.':'All selected anchors returned data.')+' Missing candidate-anchor pairs contribute zero and coverage remains visible.';q('#adjacency-stats').innerHTML='<div class="stat"><strong>'+adjacencyRunMetadata.anchors+'</strong><span>EDHREC anchors</span></div><div class="stat"><strong>'+adjacencyResults.length+'</strong><span>Positive results shown</span></div><div class="stat"><strong>'+adjacencyRunMetadata.failed.length+'</strong><span>Unavailable anchors</span></div>';} }catch(error){if(runRevision!==adjacencyRevision)return;adjacencyResults=[];adjacencyRunMetadata=null;renderAdjacencyResults();q('#adjacency-stats').innerHTML='';q('#adjacency-status').textContent='Adjacency analysis failed: '+error.message;}finally{button.disabled=false;button.textContent='Analyze adjacency';}
    };
    q('#adjacency-search').addEventListener('input',debounce(renderAdjacencySearch));
    q('#adjacency-run').addEventListener('click',runAdjacency);
    q('#adjacency-coverage').addEventListener('change',invalidateAdjacency);
    q('#adjacency-exclude').addEventListener('change',invalidateAdjacency);
    q('#adjacency-source').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{invalidateAdjacency();q('#adjacency-status').textContent=input.value==='cubecobra'?'CubeCobra mode ranks current cube cards from other public cube lists.':'EDHREC mode can surface external cards from Commander deck Lift.';}));
    viewInitializers.adjacency=()=>{renderAdjacencySearch();renderAdjacencyAnchors();};

    const cubeByOracle=new Map(DATA.cards.filter(card=>card.oracleId).map(card=>[card.oracleId,card]));
    const cubeByName=new Map(DATA.cards.map(card=>[card.name.toLowerCase(),card]));
    const discoveryByName=new Map(mainboard.filter(card=>card.seventeenLands).map(card=>[card.name.toLowerCase(),card.seventeenLands]));
    let discoveryResults=[];
    const quoteQuery=value=>JSON.stringify(String(value));
    const buildDiscoverQuery=()=>{
      const terms=['game:paper'];
      const raw=q('#discover-text').value.trim();
      if(raw)terms.push(/[():<>=]/.test(raw)||/\\b(?:o|oracle|name|t|type|id|c|mv|cmc|pow|otag):/i.test(raw)?raw:'(name:'+quoteQuery(raw)+' OR o:'+quoteQuery(raw)+')');
      q('#discover-tags').value.split(',').map(tag=>tag.trim()).filter(Boolean).forEach(tag=>terms.push('otag:'+quoteQuery(tag)));
      const colors=[...selectedColorPool('#discover-colors')],colored=colors.filter(color=>color!=='C');
      if(colored.length)terms.push('id<='+colored.join(''));else if(colors.includes('C'))terms.push('id:c');
      const types=[...selectedTypePool('#discover-types')].map(type=>type.toLowerCase());
      if(types.length){const typeTerms=types.map(type=>'t:'+quoteQuery(type));terms.push(selectedTypeMode('#discover-type-mode')==='all'?typeTerms.join(' '):'('+typeTerms.join(' OR ')+')');}
      const rarities=[...q('#discover-rarities').querySelectorAll('input:checked')].map(input=>'r:'+input.value);if(rarities.length)terms.push('('+rarities.join(' OR ')+')');
      const min=q('#discover-mv-min').value,max=q('#discover-mv-max').value;if(min!=='')terms.push('mv>='+Number(min));if(max!=='')terms.push('mv<='+Number(max));
      return terms.join(' ');
    };
    const previewDiscoverQuery=()=>{q('#discover-query').textContent=buildDiscoverQuery();};
    const discoveryImage=card=>card.image_uris?.normal||card.card_faces?.find(face=>face.image_uris)?.image_uris?.normal||'';
    const discoveryText=card=>card.oracle_text||card.card_faces?.map(face=>face.oracle_text||'').filter(Boolean).join('\\n')||'';
    const discoveryMembership=card=>cubeByOracle.get(card.oracle_id)||cubeByName.get(card.name.toLowerCase())||null;
    const discoverySeventeen=card=>discoveryByName.get(card.name.toLowerCase())||null;
    const sortDiscovery=cards=>[...cards].sort((a,b)=>{
      const mode=q('#discover-sort').value,am=discoveryMembership(a),bm=discoveryMembership(b),as=discoverySeventeen(a),bs=discoverySeventeen(b);
      if(mode==='seventeen-pick')return (as?.avgPick??99)-(bs?.avgPick??99)||a.name.localeCompare(b.name);
      if(mode==='seventeen-score')return (bs?.score??-1)-(as?.score??-1)||a.name.localeCompare(b.name);
      if(mode==='community')return (bm?.cubeCount??-1)-(am?.cubeCount??-1)||a.name.localeCompare(b.name);
      if(mode==='mv')return (a.cmc??0)-(b.cmc??0)||a.name.localeCompare(b.name);
      if(mode==='name')return a.name.localeCompare(b.name);
      return (a.edhrec_rank??999999)-(b.edhrec_rank??999999)||a.name.localeCompare(b.name);
    });
    const showDiscoveryCard=card=>{
      const member=discoveryMembership(card),sl=discoverySeventeen(card),image=discoveryImage(card);
      q('#discover-detail').innerHTML=(image?'<img src="'+e(image)+'" alt="'+e(card.name)+'">':'')+'<h3>'+e(card.name)+'</h3><p>'+e(card.type_line)+' | MV '+e(card.cmc)+' | '+e(card.rarity)+'</p><h3>Rules text</h3><p>'+e(discoveryText(card))+'</p><h3>Evidence</h3><p>EDHREC rank: '+e(card.edhrec_rank??'unavailable')+'<br>17Lands Powered Cube: '+(sl?'score '+sl.score+' ('+e(sl.grade)+'), avg pick '+sl.avgPick:'unavailable')+'<br>Cube Cobra demand: '+(member?member.cubeCount.toLocaleString()+' cubes, '+member.pickCount.toLocaleString()+' picks':'unavailable for an external candidate')+'</p><h3>Current cube</h3><p>'+(member?'Already present as '+e(member.board)+'.':'Absent from the analyzed snapshot.')+'</p><p><a href="'+e(card.scryfall_uri)+'" target="_blank" rel="noreferrer">Open on Scryfall</a></p>';
    };
    const renderDiscovery=()=>{
      const exclude=q('#discover-exclude').checked,cards=sortDiscovery(discoveryResults.filter(card=>!exclude||!discoveryMembership(card)));
      q('#discover-count').textContent='Showing '+cards.length+' candidates';
      q('#discover-results').innerHTML=cards.map((card,index)=>{const member=discoveryMembership(card),sl=discoverySeventeen(card),image=discoveryImage(card);return '<figure class="candidate"><button class="candidate-button" data-discovery-index="'+index+'">'+(image?'<img src="'+e(image)+'" alt="'+e(card.name)+'" loading="lazy">':'')+'<figcaption><strong>'+e(card.name)+'</strong><small>'+e(card.type_line)+' | MV '+e(card.cmc)+'</small><small>EDHREC '+e(card.edhrec_rank??'unavailable')+(sl?' | 17L '+sl.score+' | pick '+sl.avgPick:' | 17L unavailable')+(member?' | '+member.cubeCount.toLocaleString()+' CC cubes':' | CC demand unavailable')+'</small></figcaption></button></figure>';}).join('')||'<p class="empty">No candidates match the current query and cube-membership filter.</p>';
      q('#discover-results').querySelectorAll('[data-discovery-index]').forEach((button,index)=>button.addEventListener('click',()=>showDiscoveryCard(cards[index])));
    };
    const runDiscovery=async()=>{
      const query=buildDiscoverQuery(),button=q('#discover-search');q('#discover-query').textContent=query;button.disabled=true;button.textContent='Searching...';q('#discover-status').textContent='Searching Scryfall with the visible query...';
      try{const url=new URL('https://api.scryfall.com/cards/search');url.searchParams.set('q',query);url.searchParams.set('unique','cards');url.searchParams.set('order','edhrec');url.searchParams.set('dir','asc');const response=await fetch(url);const body=await response.json();if(!response.ok)throw new Error(body.details||'Scryfall returned HTTP '+response.status);discoveryResults=body.data||[];renderDiscovery();q('#discover-status').innerHTML='<strong>'+body.total_cards.toLocaleString()+' Scryfall matches.</strong> Showing this page after local cube-membership and evidence sorting. Strict theme membership still requires the local proof rules.';}catch(error){discoveryResults=[];renderDiscovery();q('#discover-status').textContent='Scryfall search failed: '+error.message;}finally{button.disabled=false;button.textContent='Search Scryfall';}
    };
    const clearDiscoverControls=()=>{q('#discover-text').value='';q('#discover-tags').value='';q('#discover-mv-min').value='';q('#discover-mv-max').value='';q('#discover-colors').querySelectorAll('input').forEach(input=>{input.checked=false;});q('#discover-types').querySelectorAll('input').forEach(input=>{input.checked=false;});};
    const discoverPresets={
      cheat:{text:'(otag:reanimate OR otag:cheat-into-play OR o:"without paying its mana cost" OR o:/put .* creature card .* onto the battlefield/)'},
      payoffs:{text:'(otag:finisher OR otag:etb-trigger OR otag:attack-trigger)',types:['Creature'],min:6},
      domain:{text:'(o:domain OR o:converge OR o:"basic land type among lands you control")'},
      power:{text:'(pow>=4 OR o:"power 4 or greater" OR otag:scales-with-power)',types:['Creature'],colors:['R','G']},
      counters:{text:'(otag:add-counters OR otag:counter-multipler OR o:"+1/+1 counter")'},
      blink:{text:'(otag:flicker OR otag:etb-trigger OR o:"enters the battlefield")'},
    };
    q('#discover-results').innerHTML='<p class="empty">Choose a saved search or build a query, then search Scryfall.</p>';
    document.querySelectorAll('[data-discover-preset]').forEach(button=>button.addEventListener('click',()=>{clearDiscoverControls();const preset=discoverPresets[button.dataset.discoverPreset];q('#discover-text').value=preset.text||'';q('#discover-mv-min').value=preset.min??'';(preset.types||[]).forEach(type=>{const input=[...q('#discover-types').querySelectorAll('input')].find(item=>item.value===type);if(input)input.checked=true;});(preset.colors||[]).forEach(color=>{const input=[...q('#discover-colors').querySelectorAll('input')].find(item=>item.value===color);if(input)input.checked=true;});previewDiscoverQuery();runDiscovery();}));
    ['#discover-text','#discover-tags','#discover-mv-min','#discover-mv-max'].forEach(selector=>q(selector).addEventListener('input',previewDiscoverQuery));
    ['#discover-colors','#discover-types','#discover-rarities','#discover-type-mode'].forEach(selector=>q(selector).querySelectorAll('input').forEach(input=>input.addEventListener('change',previewDiscoverQuery)));
    bindColorPool('#discover-colors',previewDiscoverQuery);bindTypePool('#discover-types',previewDiscoverQuery);bindTypePool('#discover-rarities',previewDiscoverQuery);
    q('#discover-search').addEventListener('click',runDiscovery);q('#discover-sort').addEventListener('change',renderDiscovery);q('#discover-exclude').addEventListener('change',renderDiscovery);previewDiscoverQuery();

    q('#health-body').innerHTML = DATA.themes.map(a => '<tr><td><strong>'+e(a.name)+'</strong><br><code>best '+e(a.bestColors.join(''))+'</code></td><td class="status '+statusClass(a.status)+'">'+e(a.status)+'</td><td><div class="bar"><i style="width:'+a.score+'%"></i></div><span>'+a.score+'</span></td><td class="num">'+a.enablers+'</td><td class="num">'+a.payoffs+'</td><td class="num">'+a.glue+'</td><td class="num">'+a.enablerPayoffRatio+'</td><td class="num">'+a.supportPer45+'</td><td>'+e(a.description)+'<br>'+chips(a.sourceTags)+'</td></tr>').join('');
    q('#overlap-body').innerHTML = DATA.overlaps.slice(0,30).map(x => '<tr><td>'+e(x.a)+'</td><td>'+e(x.b)+'</td><td class="num">'+x.shared+'</td><td class="num">'+x.percent+'%</td></tr>').join('');
    q('#blink-body').innerHTML = DATA.blink.map(x => '<tr><td>'+pips(x.color==='C'?[]:[x.color])+'</td><td class="num">'+x.enablers+'</td><td class="num">'+x.copy+'</td><td class="num">'+x.recursion+'</td><td class="num">'+x.selfBounce+'</td><td class="num">'+x.payoffs+'</td><td class="num">'+x.ratio+'</td><td class="status '+statusClass(x.coverage)+'">'+e(x.coverage)+'</td><td>'+e(x.examples.join(', '))+'</td><td>'+e(x.adjacentExamples.join(', '))+'</td></tr>').join('');
    q('#hidden-body').innerHTML = DATA.hiddenThemes.map(x => '<tr><td><strong>'+e(x.name)+'</strong></td><td class="status '+statusClass(x.signal)+'">'+e(x.signal)+'</td><td>'+pips(x.bestColors==='C'?[]:x.bestColors.split(''))+'</td><td class="num">'+x.enablers+'</td><td class="num">'+x.payoffs+'</td><td class="num">'+x.ratio+'</td><td>'+e(x.examples.join(', '))+'</td></tr>').join('');
    q('#tribe-body').innerHTML = DATA.tribes.map(x => '<tr><td><strong>'+e(x.type)+'</strong></td><td class="num">'+x.bodies+'</td><td class="num">'+x.payoffs+'</td><td class="status '+statusClass(x.signal)+'">'+e(x.signal)+'</td></tr>').join('');

    const censusTypes=['Creature','Instant','Sorcery','Instant or Sorcery','Artifact','Enchantment','Planeswalker','Land','Battle'];
    const renderTypes = () => {
      const colors=selectedColorPool('#type-colors'),type=q('#type-select').value,fn=q('#type-function').value;
      const pool=mainboard.filter(card=>cardColorsMatchPool(card,colors)&&cardMatchesFunction(card,fn));
      const cards=sortCards(pool.filter(card=>cardMatchesType(card,type)),'quality');
      const count=t=>pool.filter(card=>cardMatchesType(card,t)).length;
      q('#type-stats').innerHTML='<div class="stat"><strong>'+cards.length+'</strong><span>'+e(type==='all'?'Cards selected':type+' selected')+'</span></div><div class="stat"><strong>'+count('Instant')+'</strong><span>Instants</span></div><div class="stat"><strong>'+count('Sorcery')+'</strong><span>Sorceries</span></div><div class="stat"><strong>'+count('Artifact')+'</strong><span>Artifacts</span></div><div class="stat"><strong>'+pool.filter(card=>cardMatchesFunction(card,'interaction')).length+'</strong><span>Interaction</span></div><div class="stat"><strong>'+pool.filter(card=>cardMatchesFunction(card,'value')).length+'</strong><span>Value</span></div>';
      q('#type-body').innerHTML=censusTypes.map(label=>'<tr><td><strong>'+e(label)+'</strong></td><td class="num">'+count(label)+'</td></tr>').join('');
      const shown=cards.slice(0,350);
      q('#type-gallery').innerHTML=shown.map(cardTile).join('')||'<p class="empty">No cards match this color, type, and function combination.</p>';
      q('#type-count').textContent='Showing '+shown.length+' of '+cards.length;
      bindCardButtons(q('#type-gallery'),'#type-detail');
    };
    ['#type-select','#type-function'].forEach(sel=>q(sel).addEventListener('change',renderTypes));bindColorPool('#type-colors',renderTypes);viewInitializers.types=renderTypes;

    const renderAllCards = () => {
      const term=q('#card-search').value.trim().toLowerCase(),board=q('#card-board').value,color=q('#card-color').value,type=q('#card-type').value,fn=q('#card-function').value;const cards=DATA.cards.filter(c=>(board==='all'||c.board===board)&&cardColorsMatch(c,color)&&cardMatchesType(c,type)&&cardMatchesFunction(c,fn)&&(!term||c.search.includes(term)));const shown=cards.slice(0,350);q('#all-card-count').textContent='Showing '+shown.length+' of '+cards.length;
      q('#card-body').innerHTML=shown.map(c=>'<tr class="all-card-row" data-card-id="'+e(c.id)+'"><td><strong>'+e(c.name)+'</strong><br><small>'+e(c.type)+'</small></td><td>'+pips(c.colors)+'</td><td class="num">'+c.cmc+'</td><td>'+chips(c.functionRoles.map(role=>role.label))+'</td><td class="status '+statusClass(c.quality.standaloneTier)+'">'+e(c.quality.standaloneTier)+' '+c.quality.score+'</td><td class="num">'+e(c.quality.advantageLabel)+'</td><td>'+chips(c.archetypeRoles.map(r=>r.archetype+' - '+roleLabel(r.role)))+'</td><td>'+chips(c.proposedTags)+'</td></tr>').join('');bindCardButtons(q('#card-body'),'#card-detail');
    };
    ['#card-board','#card-color','#card-type','#card-function'].forEach(sel=>q(sel).addEventListener('change',renderAllCards));q('#card-search').addEventListener('input',debounce(renderAllCards));viewInitializers.cards=renderAllCards;
    const renderTagTables=()=>{const term=q('#tag-search').value.trim().toLowerCase();const render=(rows,target)=>{q(target).innerHTML=rows.filter(x=>!term||x.tag.includes(term)).slice(0,500).map(x=>'<tr><td><code>'+e(x.tag)+'</code></td><td class="num">'+x.count+'</td></tr>').join('');};render(DATA.oracleTagFrequency,'#oracle-tag-body');render(DATA.artTagFrequency,'#art-tag-body');};q('#tag-search').addEventListener('input',debounce(renderTagTables));viewInitializers.tags=renderTagTables;
  </script>
</body>
</html>`;
}
