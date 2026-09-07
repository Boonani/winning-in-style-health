import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const icon=name=>fs.readFileSync(require.resolve('lucide-static/icons/'+name+'.svg'),'utf8').replace('<svg','<svg aria-hidden="true"');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export const MANA_EXAMPLES=[
 {id:'forest',name:'Forest',cardID:'19e71532-3f79-4fec-974f-b0e85c7fe701',kind:'land',colors:['G'],url:'https://scryfall.com/card/unh/140/forest'},
 {id:'pool',name:'Breeding Pool',cardID:'b98b2a35-ec2b-47fe-903d-dd292e469a3c',kind:'land',colors:['G','U'],url:'https://scryfall.com/card/dis/172/breeding-pool'},
 {id:'heath',name:'Windswept Heath',cardID:'26343f80-4d60-407a-a44a-ee6295d2e5ec',kind:'fetch',colors:[],url:'https://scryfall.com/card/mh3/360/windswept-heath'},
 {id:'elves',name:'Llanowar Elves',cardID:'cd43a84a-cde2-48f8-b6ab-1ec023c9e0c3',kind:'spell',colors:['G'],url:'https://scryfall.com/card/fdn/429/llanowar-elves'},
];

// Each example examines one card, not a deck or probabilities of casting.
export function manaExample(index=0,hasPoolTarget=false,examples=MANA_EXAMPLES){
 const card=examples[index];
 if(!card)throw new RangeError('Unknown mana example');
 const colors=card.kind==='fetch'?(hasPoolTarget?['G','U']:['G']):card.colors;
 return {landSources:card.kind==='spell'?[]:[...colors],castDependent:card.kind==='spell'?[...colors]:[],
   fetchTargets:card.kind==='fetch'?(hasPoolTarget?['Forest','Breeding Pool']:['Forest']):[],cardCount:1};
}
export function deckComposition(lands=17){
 if(!Number.isInteger(lands)||lands<14||lands>20)throw new RangeError('Illustration supports 14-20 lands');
 return {lands,nonlands:40-lands,total:40,landPercent:lands/40*100};
}

export const visualLessonCSS=`
.visual-lesson{margin:26px 0;position:relative}
.visual-lesson label{font-size:14px;display:block;margin:12px 0 6px}
.visual-lesson select{max-width:100%;width:100%;min-height:48px;background:var(--paper);color:var(--ink);border:1px solid #65717E;border-radius:4px;padding:8px;font:inherit}
.visual-lesson select:focus-visible,.visual-lesson button:focus-visible{outline:3px solid var(--mint);outline-offset:3px}
.visual-lesson .heatmap{width:100%;border-collapse:collapse;font-size:14px;margin:22px 0}
.visual-lesson th,.visual-lesson td{height:54px;padding:5px;text-align:center;border-bottom:1px solid var(--line)}
.visual-lesson th:first-child{text-align:left;width:42%;font-weight:500}
.visual-lesson th img{width:24px;height:24px;vertical-align:middle}
.visual-lesson .source-cell{background:rgba(69,214,197,.15);color:var(--mint);font-weight:800}
.visual-lesson .conditional-cell{background:rgba(255,209,102,.13);color:var(--gold);font-weight:800}
.visual-lesson .target-toggle{display:flex;align-items:center;gap:12px;min-height:48px}
.visual-lesson input[type=checkbox]{width:22px;height:22px;accent-color:var(--mint)}
.visual-lesson .explanation{min-height:100px;font-size:16px}
.visual-lesson [hidden]{display:none!important}
.visual-lesson .composition{display:block;width:100%;max-width:420px;aspect-ratio:1;margin:auto}
.visual-lesson .deck-adjustment{display:flex;align-items:center;justify-content:center;gap:16px;min-height:52px}
.visual-lesson button{display:grid;place-items:center;width:48px;height:48px;background:transparent;border:1px solid #65717E;color:var(--ink);border-radius:4px;touch-action:manipulation;cursor:pointer}
.visual-lesson button svg{width:22px;height:22px}
.visual-lesson button:disabled{opacity:.4;cursor:default}
.visual-lesson output{font-size:18px;min-width:96px;text-align:center}
.visual-lesson .composition-legend{display:flex;justify-content:center;gap:28px;flex-wrap:wrap}
.visual-lesson .composition-legend strong{font-size:28px;display:block}
.visual-lesson .land-count{color:var(--mint)}
.visual-lesson .nonland-count{color:var(--gold)}
.visual-lesson .composition-card{transform-origin:200px 200px}
.visual-lesson.changing .composition-card{animation:deck-transfer .75s both}
.visual-lesson .deck-trailing{transform-origin:200px 200px}
.visual-lesson.changing .deck-trailing{animation:deck-overlap .9s both}
.visual-lesson.changing [data-land-arc]{animation:deck-response .8s both}
@keyframes deck-overlap{0%,15%{transform:rotate(0)}50%{transform:rotate(-6deg)}85%{transform:rotate(3deg)}100%{transform:rotate(0)}}
@keyframes deck-response{0%,65%,100%{stroke-opacity:1}80%{stroke-opacity:.65}}
@keyframes deck-transfer{
 0%{transform:translate(0,0) rotate(0) scale(1)}
 16%{transform:translate(-8px,4px) rotate(-9deg) scale(.96,1.04)}
 55%{transform:translate(16px,-30px) rotate(12deg) scale(1.08,.926)}
 82%{transform:translate(0,3px) rotate(-3deg) scale(1.04,.96)}
 100%{transform:translate(0,0) rotate(0) scale(1)}
}
@media(prefers-reduced-motion:reduce){.visual-lesson.changing .composition-card,.visual-lesson.changing .deck-trailing,.visual-lesson.changing [data-land-arc]{animation:none}}
`;

export function manaLessonMarkup(section){
 const copy=section?.body || [
  'A Forest gives you green mana.',
  'Breeding Pool can give you green or blue. It is still one land and makes one mana per tap, not both colors at once. It enters tapped unless you pay 2 life.',
  'Windswept Heath finds a Forest or Plains in your library. Breeding Pool has the Forest type, so it can be a target too. No target left means no mana from the fetch.',
  'Llanowar Elves is not a land. You need green mana to cast it before it can help, and it cannot tap immediately unless it has haste.',
 ];
 const heading=section?.heading||'Which colors can this card help with?';
 return `<div class="visual-lesson" data-mana-lesson>
 <label for="mana-example">${esc(heading)}</label>
 <select id="mana-example" disabled>${MANA_EXAMPLES.map((card,i)=>`<option value="${i}">${esc(card.name)}</option>`).join('')}</select>
 <label class="target-toggle" hidden><input type="checkbox" data-pool-target>Breeding Pool in the library (alongside a Forest)</label>
 <table class="heatmap"><caption class="sr-only">One-card source illustration</caption><thead><tr><th scope="col">One card</th>${['W','U','B','R','G'].map(color=>`<th scope="col"><img src="assets/mana/${color}.svg" alt="${({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'})[color]}"></th>`).join('')}</tr></thead>
 <tbody><tr data-land-row><th scope="row">Land sources</th>${['W','U','B','R','G'].map(c=>`<td data-color="${c}" class="${c==='G'?'source-cell':''}">${c==='G'?'1':'0'}</td>`).join('')}</tr>
 <tr data-spell-row><th scope="row">After casting</th>${['W','U','B','R','G'].map(c=>`<td data-color="${c}">0</td>`).join('')}</tr></tbody></table>
 <p class="explanation" aria-live="polite">${esc(copy[0])}</p>
 <details><summary>See the card</summary><div class="card-gallery"><figure class="primer-card"><img data-example-image src="https://cards.scryfall.io/normal/front/1/9/${MANA_EXAMPLES[0].cardID}.jpg" alt="Forest" loading="lazy"><figcaption><a data-example-source href="${MANA_EXAMPLES[0].url}">Forest</a></figcaption></figure></div></details>
 <noscript>${copy.slice(1).map(line=>`<p>${esc(line)}</p>`).join('')}</noscript>
 <script>(${mountMana.toString()})(${JSON.stringify(MANA_EXAMPLES)},${JSON.stringify(copy).replaceAll('<','\\u003c')},${manaExample.toString()});</script>
 </div>`;
}
function mountMana(cards,copy,calculate){
 const root=document.currentScript.closest('[data-mana-lesson]');
 const select=root.querySelector('select'),target=root.querySelector('[data-pool-target]');
 function render(){
   const index=Number(select.value),card=cards[index],state=calculate(index,target.checked,cards);
   root.querySelector('.target-toggle').hidden=card.kind!=='fetch';
   for(const [selector,colors,className] of [['[data-land-row]',state.landSources,'source-cell'],['[data-spell-row]',state.castDependent,'conditional-cell']]){
     for(const cell of root.querySelectorAll(selector+' td')){
       const matches=colors.includes(cell.dataset.color);cell.textContent=matches?'1':'0';cell.className=matches?className:'';
     }
   }
   root.querySelector('.explanation').textContent=copy[index]||'';
   const img=root.querySelector('[data-example-image]'),id=card.cardID;
   img.src='https://cards.scryfall.io/normal/front/'+id[0]+'/'+id[1]+'/'+id+'.jpg';img.alt=card.name;
   const source=root.querySelector('[data-example-source]');source.href=card.url;source.textContent=card.name;
 }
 select.disabled=false;select.addEventListener('change',render);target.addEventListener('change',render);render();
}

export function deckLessonMarkup(section){
 const copy=section?.body||['Start with 17 lands + 23 nonlands.','Your curve and your fixing may call for a different balance. The deck stays at 40 cards in this illustration.'];
 return `<div class="visual-lesson" data-deck-lesson>
 <svg class="composition" viewBox="0 0 400 400" role="img" aria-label="40 cards: 17 lands and 23 nonlands">
 <circle cx="200" cy="200" r="138" fill="none" stroke="#FFD166" stroke-width="36"/>
 <circle data-land-arc cx="200" cy="200" r="138" fill="none" stroke="#45D6C5" stroke-width="36" pathLength="40" stroke-dasharray="17 23" transform="rotate(-90 200 200)"/>
 <g class="composition-card"><g class="deck-trailing"><rect x="167" y="153" width="70" height="94" rx="4" fill="#090C12" stroke="#FFD166" transform="rotate(-9 200 200)"/><rect x="164" y="151" width="70" height="94" rx="4" fill="#12161B" stroke="#45D6C5" transform="rotate(7 200 200)"/></g><rect x="164" y="150" width="70" height="94" rx="4" fill="#FF94AC"/>
 <text x="199" y="195" text-anchor="middle" fill="#090C12" font-size="28" font-weight="800">40</text><text x="199" y="219" text-anchor="middle" fill="#090C12" font-size="13">cards</text></g></svg>
 <div class="composition-legend"><span><strong class="land-count">17</strong>lands</span><span><strong class="nonland-count">23</strong>nonlands</span></div>
 <div class="deck-adjustment" hidden><button data-less-land aria-label="One fewer land" title="One fewer land">${icon('minus')}</button><output>17 lands</output><button data-more-land aria-label="One more land" title="One more land">${icon('plus')}</button><button data-reset-land aria-label="Reset to 17 lands" title="Reset to 17 lands">${icon('rotate-ccw')}</button></div>
 <p class="explanation">${esc(copy[1]||copy[0])}</p>
 <script>(${mountDeck.toString()})(${deckComposition.toString()});</script>
 </div>`;
}
function mountDeck(composition){
 const root=document.currentScript.closest('[data-deck-lesson]'),less=root.querySelector('[data-less-land]'),more=root.querySelector('[data-more-land]');
 let lands=17;
 function render(){
   const state=composition(lands);
   root.querySelector('[data-land-arc]').setAttribute('stroke-dasharray',state.lands+' '+state.nonlands);
   root.querySelector('.land-count').textContent=state.lands;root.querySelector('.nonland-count').textContent=state.nonlands;
   root.querySelector('output').textContent=lands+' lands';
   root.querySelector('svg').setAttribute('aria-label','40 cards: '+state.lands+' lands and '+state.nonlands+' nonlands');
   less.disabled=lands===14;more.disabled=lands===20;
   root.classList.remove('changing');
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches){void root.offsetWidth;root.classList.add('changing');}
 }
 less.onclick=()=>{lands=Math.max(14,lands-1);render();};
 more.onclick=()=>{lands=Math.min(20,lands+1);render();};
 root.querySelector('[data-reset-land]').onclick=()=>{lands=17;render();};
 root.querySelector('.deck-adjustment').hidden=false;
}
