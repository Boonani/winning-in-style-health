import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createDraftSimulation} from './primer-draft-simulation.mjs';
import {layoutDraftPacks} from './primer-draft-layout.mjs';

const require = createRequire(import.meta.url);
const icon = name => fs.readFileSync(require.resolve('lucide-static/icons/' + name + '.svg'), 'utf8')
  .replace('<svg', '<svg aria-hidden="true" focusable="false"');
const colors = ['#FF94AC', '#45D6C5', '#FFD166', '#F7F8FA'];
const positions = [[250, 64], [436, 250], [250, 436], [64, 250]];
const hands = [[250, 146], [354, 250], [250, 354], [146, 250]];

export const draftAnimationCSS = `
.draft-animation {--red:#FF94AC;--aqua:#45D6C5;--yellow:#FFD166;margin:24px 0}
.draft-animation svg.draft-table {display:block;width:100%;max-width:620px;aspect-ratio:1;margin:auto;overflow:visible}
.draft-animation .instruction {font-size:24px;line-height:1.25;font-weight:750;max-width:520px;min-height:90px;margin:0 auto;text-align:center;color:var(--ink)}
.draft-animation .letter {display:inline-block;white-space:pre}
.draft-animation .word {display:inline-block;white-space:normal;max-width:100%}
.draft-animation:not([data-playing="true"]) .letter {animation-play-state:paused}
.draft-animation.running .letter {animation:letter-in .48s both;animation-delay:calc(var(--letter)*.038s)}
@keyframes letter-in {from{opacity:0;transform:translateY(7px) scale(.94)}to{opacity:1;transform:none}}
.draft-animation .motion-controls {display:flex;justify-content:center;gap:8px;align-items:center}
.draft-animation button {display:grid;place-items:center;width:48px;height:48px;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:6px;cursor:pointer;touch-action:manipulation}
.draft-animation button:hover {border-color:var(--aqua)}
.draft-animation button:focus-visible {outline:3px solid var(--aqua);outline-offset:3px}
.draft-animation button svg {width:22px;height:22px}
.draft-animation button:disabled {opacity:.4;cursor:default}
.draft-animation .motion-status {font-size:13px;color:var(--muted);text-align:center;min-height:40px;margin:10px auto}
.draft-animation [hidden] {display:none}
.draft-animation .seat-label {fill:#F7F8FA;font-size:13px;font-weight:650;text-anchor:middle}
.draft-animation .pack-count {fill:#090C12;font-size:15px;font-weight:800;text-anchor:middle}
.draft-animation .queue-label {fill:#A9B1BD;font-size:11px;text-anchor:middle}
.draft-animation .sr-only {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
@media(max-width:400px){.draft-animation .instruction{font-size:21px;min-height:80px}}
@media(prefers-reduced-motion:reduce){.draft-animation.running .letter{animation:none!important}}
`;

export function draftAnimationMarkup(phrase = 'Pick 1 card, pass the pack to the left') {
  const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  let letterIndex = 0;
  const letters = phrase.split(' ').map(word => '<span class="word">' + [...word].map(c => '<span class="letter" style="--letter:' + letterIndex++ + '">' + esc(c) + '</span>').join('') + '</span>').join(' ');
  const people = positions.map(([x,y], i) => `
    <g data-player="${i}" transform="translate(${x} ${y})">
      <g data-body><path d="M-24 22 Q-27 -5 0 -5 Q27 -5 24 22Z" fill="${colors[i]}"/>
      <circle cy="-25" r="16" fill="#F7F8FA"/></g>
      <text class="seat-label" y="48" data-picks>0 picked</text>
    </g>`).join('');
  const packs = hands.map(([x,y],i) => `
    <g data-pack="${i}" transform="translate(${x} ${y})">
      <g data-fan><rect x="-19" y="-26" width="36" height="49" rx="3" fill="#090C12" stroke="${colors[i]}" transform="rotate(-12)"/>
      <rect x="-15" y="-25" width="36" height="49" rx="3" fill="#090C12" stroke="${colors[i]}" transform="rotate(9)"/></g>
      <rect x="-18" y="-25" width="36" height="49" rx="3" fill="${colors[i]}"/>
      <path d="M-12 -19H12 M-12 17H12" stroke="#090C12" stroke-opacity=".4"/>
      <text class="pack-count" y="5" data-count>15</text>
      <text class="pack-count" y="-10" style="font-size:8px">${String.fromCharCode(65+i)}</text>
    </g>`).join('');
  return `<div class="draft-animation" data-draft-animation>
    <h2 class="instruction"><span class="sr-only">${esc(phrase)}</span><span aria-hidden="true">${letters}</span></h2>
    <svg class="draft-table" viewBox="0 0 500 500" role="img" aria-label="Four players around a table, each holding a pack of fifteen cards. Packs pass clockwise to each player's left.">
      <rect x="105" y="105" width="290" height="290" rx="80" fill="#12161B" stroke="#29313D"/>
      <path d="M285 115 Q370 120 385 205 M385 285 Q370 370 285 385 M215 385 Q130 370 115 285 M115 215 Q130 130 215 115" fill="none" stroke="#45D6C5" stroke-opacity=".3" stroke-width="2"/>
      <text x="250" y="244" text-anchor="middle" fill="#F7F8FA" font-size="16" font-weight="750">PACK 1</text>
      <text x="250" y="265" text-anchor="middle" fill="#A9B1BD" font-size="12">Pass left</text>
      ${people}
      ${hands.map(([x,y],i)=>`<text data-queue="${i}" class="queue-label" x="${x}" y="${y+44}"></text>`).join('')}
      ${packs}
      ${positions.map((_,i)=>`<rect data-picked-card="${i}" width="20" height="28" x="-10" y="-14" rx="2" fill="${colors[i]}" opacity="0"/>`).join('')}
    </svg>
    <div class="motion-controls" hidden>
      <button type="button" data-toggle aria-label="Play animation" title="Play animation">${icon('play')}</button>
      <button type="button" data-step aria-label="Next pick" title="Next pick">${icon('step-forward')}</button>
      <button type="button" data-replay aria-label="Restart animation" title="Restart animation">${icon('rotate-ccw')}</button>
    </div>
    <p class="motion-status" aria-live="polite">Four players. One card at a time.</p>
    <noscript><p>Each player keeps one card, then passes the remaining pack to their left. Packs wait in order when another player is still choosing.</p></noscript>
    <script>(${mountDraftAnimation.toString()})(${createDraftSimulation.toString()}, ${layoutDraftPacks.toString()}, ${JSON.stringify({positions,hands,play:icon('play'),pause:icon('pause')})});</script>
  </div>`;
}

function mountDraftAnimation(createSimulation, layoutPacks, assets) {
  const root = document.currentScript.closest('[data-draft-animation]');
  const svg = root.querySelector('.draft-table');
  const toggle = root.querySelector('[data-toggle]');
  const step = root.querySelector('[data-step]');
  const status = root.querySelector('.motion-status');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let simulation = createSimulation(), playing = false, visible = false, frame = 0, last = 0, elapsed = 0, cycles = 0;
  const clamp = n => Math.max(0, Math.min(1,n));
  const ease = n => n*n*(3-2*n);
  const packNodes = [...root.querySelectorAll('[data-pack]')];
  const playerNodes = [...root.querySelectorAll('[data-player]')];
  function render() {
    const s = simulation.state;
    root.dataset.time = s.time.toFixed(3);
    root.dataset.finished = String(s.finished);
    const poses = layoutPacks(s, assets.hands, media.matches);
    root.dataset.cycles = String(cycles);
    for (const pack of s.packs) {
      const node = packNodes[pack.id];
      node.style.display = pack.status === 'empty' ? 'none' : '';
      node.dataset.status = pack.status;
      node.querySelector('[data-count]').textContent = pack.remaining;
      if (pack.status === 'empty') continue;
      const {x,y,angle,stretch} = poses.find(p => p.id === pack.id);
      node.setAttribute('transform', 'translate('+x+' '+y+') rotate('+angle+') scale('+stretch+' '+(1/stretch)+')');
      node.querySelector('[data-fan]').setAttribute('transform', 'rotate('+(-angle*.45)+')');
    }
    for (const player of s.players) {
      const node = playerNodes[player.id];
      node.querySelector('[data-picks]').textContent = player.picks.length+' picked';
      root.querySelector('[data-queue="'+player.id+'"]').textContent = player.queue.length ? player.queue.length+' waiting' : '';
      const lastPick = [...s.events].reverse().find(e => e.type==='pick' && e.player===player.id);
      const age = lastPick ? s.time-lastPick.time : Infinity;
      const bounce = !media.matches && age<.6 ? Math.sin(age/.6*Math.PI)*4 : 0;
      const squash = !media.matches && age<.6 ? 1 + .16*Math.sin(age/.6*Math.PI*2) : 1;
      node.querySelector('[data-body]').setAttribute('transform','translate(0 '+(22-bounce)+') scale('+squash+' '+(1/squash)+') translate(0 -22)');
      const card = root.querySelector('[data-picked-card="'+player.id+'"]');
      const t = ease(clamp(age/.48)), a = assets.hands[player.id], b = assets.positions[player.id];
      card.setAttribute('opacity', !media.matches && age<.48 ? '1' : '0');
      card.setAttribute('transform','translate('+(a[0]+(b[0]-a[0])*t)+' '+(a[1]+(b[1]-a[1])*t-12*Math.sin(t*Math.PI))+') rotate('+(t*12)+')');
    }
    svg.setAttribute('aria-label',s.players.map(p=>'Player '+(p.id+1)+': '+p.picks.length+' picked, '+p.queue.length+' packs waiting').join('. '));
    if (s.finished) {
      status.textContent = 'Pack 1 complete. Each player picked 15 cards.';
    }
    updateControls();
  }
  function updateControls() {
    root.dataset.playing = String(playing);
    const label = playing ? 'Pause animation' : 'Play animation';
    if (toggle.getAttribute('aria-label') !== label) toggle.innerHTML = playing ? assets.pause : assets.play;
    toggle.setAttribute('aria-label',playing ? 'Pause animation' : 'Play animation');
    toggle.title = toggle.getAttribute('aria-label');
    toggle.disabled = false;
    step.disabled = simulation.state.finished;
  }
  function tick(now) {
    frame = 0;
    if (!playing || !visible || document.hidden) {last=0;return;}
    if (last) {
      const delta=Math.min((now-last)/1000,.1);
      elapsed+=delta;
      // A short pick/pass excerpt with an end hold, not a sped-up full draft.
      if(elapsed>=9) {
        simulation=createSimulation();elapsed=0;cycles++;
        status.textContent='';
      } else if(simulation.state.time<6.5) simulation.advance(Math.min(delta,6.5-simulation.state.time));
    }
    last = now;
    render();
    if (playing) frame = requestAnimationFrame(tick);
  }
  function schedule() {
    last=0;
    if (!frame && playing && visible && !document.hidden) frame=requestAnimationFrame(tick);
  }
  toggle.addEventListener('click',()=>{
    if(simulation.state.finished){simulation=createSimulation();elapsed=0;}
    playing=!playing;
    status.textContent=playing?'':'Paused';
    root.classList.add('running');
    updateControls();
    schedule();
  });
  step.addEventListener('click',()=>{
    playing=false;
    const s=simulation.state;
    const next=Math.min(...s.players.map(p=>p.due));
    if(Number.isFinite(next)) simulation.advance(Math.max(0,next-s.time));
    else simulation.advance(.95);
    render();
    if(!s.finished) status.textContent=s.players.map(p=>p.picks.length).join(' / ')+' cards picked';
  });
  root.querySelector('[data-replay]').addEventListener('click',()=>{
    simulation=createSimulation();elapsed=0;cycles=0;
    playing=false;
    root.classList.remove('running');
    status.textContent='Four players. One card at a time.';
    render();
  });
  media.addEventListener('change',()=>{
    if(media.matches){playing=false;status.textContent='Paused';render();}
  });
  document.addEventListener('visibilitychange',schedule);
  new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    schedule();
  },{threshold:.15}).observe(root);
  root.querySelector('.motion-controls').hidden=false;
  render();
}
