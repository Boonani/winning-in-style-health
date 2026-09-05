export const designCSS = `
    .design-intro {display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:18px}
    .design-intro h2 {font-size:24px}
    .design-intro p,.design-copy {color:var(--muted);line-height:1.5;margin:6px 0 14px}
    .primer-link {display:inline-flex;align-items:center;min-height:44px;color:var(--accent);font-weight:650}
    .design-lanes {border-top:1px solid var(--line)}
    .design-lane {border-bottom:1px solid var(--line)}
    .design-lane>summary {min-height:64px;padding:14px 4px;cursor:pointer;display:flex;gap:12px;align-items:center;list-style:none}
    .design-lane>summary::-webkit-details-marker {display:none}
    .design-lane>summary:after {content:'+';font-size:22px;margin-left:8px}
    .design-lane[open]>summary:after {content:'\\2212'}
    .design-title {flex:1;min-width:0}
    .design-title strong {display:block;font-size:17px}
    .design-title small {display:block;color:var(--muted);margin-top:4px}
    .design-pair-count {text-align:right;font-variant-numeric:tabular-nums}
    .design-pair-count strong {color:var(--green);display:block}
    .design-pair-count small {color:var(--muted)}
    .design-body {padding:4px 4px 20px}
    .design-controls {display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:8px 0 18px}
    .design-controls select {font-size:16px;min-height:44px;max-width:100%}
    .design-controls label {min-height:44px;display:inline-flex;align-items:center;gap:8px}
    .design-charts {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;border-block:1px solid var(--line);padding:18px 0;margin-bottom:16px}
    .design-chart {margin:0;min-width:0}
    .design-chart figcaption {font-weight:700;margin-bottom:12px;font-size:14px}
    .design-pie-row {display:flex;gap:14px;align-items:center}
    .design-pie {flex:0 0 88px;width:88px;height:88px;border-radius:50%;position:relative;background:var(--segments)}
    .design-pie:after {content:'';position:absolute;inset:25px;border-radius:50%;background:var(--paper)}
    .design-legend {list-style:none;padding:0;margin:0;font-size:12px;line-height:1.8}
    .design-legend i {display:inline-block;width:9px;height:9px;margin-right:6px;border-radius:2px;background:var(--swatch)}
    .design-foot {font-size:12px;color:var(--muted);line-height:1.5;margin:10px 0}
    .design-curve {height:94px;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;align-items:end}
    .design-curve>div {height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:11px;gap:3px}
    .design-curve i {display:block;width:100%;background:var(--accent);height:var(--height);min-height:1px}
    .design-roles {border-top:1px solid var(--line);margin-top:8px}
    .design-roles>summary {padding:12px 0;min-height:48px;font-weight:700;cursor:pointer}
    .design-gallery {display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:12px;margin:10px 0}
    .design-card {border:0;background:transparent;padding:0;min-width:0;color:var(--ink);text-align:left;align-self:start}
    .design-card img {width:100%;aspect-ratio:488/680;object-fit:contain;border-radius:6px}
    .design-card strong {display:block;font-size:12px;line-height:1.4;margin-top:5px;overflow-wrap:anywhere}
    .design-card small {display:block;font-size:11px;color:var(--muted);line-height:1.4}
    .design-gallery.preview {grid-template-columns:repeat(3,minmax(0,180px))}
    .design-heat-wrap {overflow:auto;max-width:100%;border:1px solid var(--line);margin:12px 0;overscroll-behavior-inline:contain}
    .design-heat {font-size:12px;min-width:590px}
    .design-heat button {min-height:44px;width:100%;border:0;color:var(--ink);background:var(--heat);font-weight:700;padding:8px}
    .design-heat th {text-transform:none;letter-spacing:0;background:var(--panel);position:static}
    .design-heat th:first-child {min-width:165px}
    .design-heat td {padding:3px;vertical-align:middle}
    .design-cross {min-width:670px}
    .design-cross th:first-child {min-width:90px}
    .design-selected {min-height:24px;color:var(--muted);font-size:13px}
    .design-dialog {width:min(780px,calc(100% - 24px));max-height:85dvh;overflow:auto;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:20px}
    .design-dialog::backdrop {background:rgba(0,0,0,.75)}
    .design-dialog form {position:sticky;top:0;text-align:right;z-index:3}
    .design-dialog form button {width:44px;height:44px;font-size:26px}
    .design-dialog .detail {position:static;width:100%;max-height:none}
    .design-dialog .hero-card {max-width:260px}
    .legacy-overview>summary,.design-method>summary {min-height:48px;padding:14px 0;cursor:pointer;font-weight:700}
    .design-status {color:var(--gold);font-size:13px;margin:8px 0}
    .design-color-counts {display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin:8px 0 16px}
    .design-color-counts span {display:inline-flex;align-items:center;gap:7px}
    .role-section>summary {cursor:pointer;min-height:48px;padding:12px 0;font-weight:700}
    button:focus-visible,summary:focus-visible,a:focus-visible {outline:2px solid var(--accent);outline-offset:3px}
    * {letter-spacing:0}
    @media(max-width:700px) {
      .design-intro {align-items:flex-start;flex-direction:column;gap:0}
      .design-intro h2 {font-size:21px}
      .design-charts {grid-template-columns:1fr 1fr;gap:16px}
      .design-chart:last-child {grid-column:1 / -1}
      .design-pie-row {align-items:flex-start;flex-direction:column;gap:8px}
      .design-gallery.preview {grid-template-columns:repeat(3,minmax(0,1fr))}
      .design-lane>summary {gap:8px}
      .design-title strong {font-size:15px}
      .design-pair-count {font-size:12px}
      .design-title small {font-size:11px}
      .design-lane>summary>.colors {gap:2px}
    }
`;

export const designShell = `
<div id="design-workspace">
  <div class="design-intro"><div><h2>Designed archetypes</h2><p>Two-color cores. Shared cards. Clear rewards.</p></div><a class="primer-link" href="draft-primer.html">First draft? Start here &rarr;</a></div>
  <div id="design-lanes" class="design-lanes"></div>
  <div class="band"><h2>Two-color health</h2><p class="design-copy">Payoffs first. Color intensity shows cards per 100 in-pair cards, not a win rate.</p><div id="design-health" class="design-heat-wrap"></div></div>
  <div class="band"><h2>Where archetypes intersect</h2><p class="design-copy">Shared cards that fit both two-color cores, including colorless.</p><div id="design-overlap" class="design-heat-wrap"></div><p id="design-selection" class="design-selected" aria-live="polite">Choose a pair of archetypes to see their shared cards.</p><div id="design-bridges" class="design-gallery"></div></div>
  <details class="design-method"><summary>What the numbers mean</summary><p class="design-copy">Payoff: rewards the plan. Enabler: supplies what it needs. Both: one card does both jobs. Colorless cards are included by default. Color identity is a conservative fit screen, not a guarantee of easy casting.</p><p class="design-copy">Health is structural evidence, not a tested power ranking. Fewer than six payoffs or six enablers is flagged for review, not declared unplayable. Heatmap values are exact card counts; shading uses the same 0 to 15 cards per 100 scale. Shared-card shading uses a separate 0 to 20 scale. Repeated colors can count a multicolor card twice; the total does not.</p><p class="design-copy">Sources: <a href="https://developer.apple.com/design/human-interface-guidelines/charts">Apple chart guidelines</a>, <a href="https://developer.apple.com/videos/play/wwdc2022/110340/">accessible chart design</a>, <a href="https://www.datawrapper.de/blog/chart-types-guide">chart selection</a>. Designed pairs come from this cube's primer; all other detected themes remain below.</p></details>
</div>
<dialog id="design-card-dialog" class="design-dialog"><form method="dialog"><button aria-label="Close card details" title="Close card details">&times;</button></form><div id="design-card-detail" class="detail"></div></dialog>
`;

export function mountDesignWorkspace({ DATA, byId, pips, showCard, summarizeLane }) {
  const model = DATA.designed;
  const e = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const root = document.querySelector('#design-workspace');
  const colors = ['#70c996','#79b8ff','#e7b85b'];
  const cardHTML = id => {
    const card = byId.get(id);
    const homes = model.lanes.filter(lane => lane.pair.union.includes(id));
    return '<button class="design-card" data-design-card="'+e(id)+'"><img src="'+e(card.image)+'" alt="'+e(card.name)+'" loading="lazy"><strong>'+e(card.name)+'</strong><small>'+e(homes.map(l=>l.guild).join(' / ') || 'Outside the designed pairs')+'</small></button>';
  };
  const sorted = ids => [...ids].sort((a,b) => (byId.get(b).quality?.score||0)-(byId.get(a).quality?.score||0));
  const pie = (title, parts, foot) => {
    const total = parts.reduce((n,p)=>n+p[1],0);
    let cursor=0;
    const stops=parts.filter(p=>p[1]).map((p)=>{const index=parts.indexOf(p),start=cursor;cursor+=p[1]/total*100;return colors[index]+' '+start+'% '+cursor+'%';});
    return '<figure class="design-chart"><figcaption>'+title+'</figcaption><div class="design-pie-row"><div class="design-pie" role="img" aria-label="'+e(title+': '+(total?parts.map(p=>p[0]+' '+p[1]).join(', '):'No cards'))+'" style="--segments:'+(total?'conic-gradient('+stops.join(',')+')':'#30353a')+'"></div><ul class="design-legend">'+parts.map((p,i)=>'<li><i style="--swatch:'+colors[i]+'"></i>'+p[1]+' '+p[0]+'</li>').join('')+'</ul></div><p class="design-foot">'+foot+'</p></figure>';
  };
  const charts = s => {
    const max=Math.max(1,...s.curve);
    const ratio=s.payoffs.length?(s.enablers.length/s.payoffs.length).toFixed(1)+':1':'No payoffs';
    return '<div class="design-charts">'+pie('Enablers : payoffs',[['Payoff only',s.payoffOnly.length],['Enabler only',s.enablerOnly.length],['Both',s.both.length]],s.enablers.length+' enablers / '+s.payoffs.length+' payoffs = '+ratio+'. Each card occupies one slice.')+
      pie('Creatures : noncreatures',[['Creatures',s.creatures],['Noncreatures',s.noncreatures]],s.lands+' lands excluded. Unique support spells.')+
      '<figure class="design-chart"><figcaption>Support mana curve</figcaption><div class="design-curve" role="img" aria-label="'+e(s.curve.map((n,i)=>(i===6?'6+':i)+' mana: '+n).join(', '))+'">'+s.curve.map((n,i)=>'<div><span>'+n+'</span><i style="--height:'+Math.round(n/max*60)+'px"></i><span>'+(i===6?'6+':i)+'</span></div>').join('')+'</div><p class="design-foot">Mana value of unique nonland support.</p></figure></div>';
  };
  function renderLaneBody(lane, scope='pair', includeColorless=true) {
    const body=root.querySelector('[data-lane-body="'+lane.id+'"]');
    const s=summarizeLane(DATA.cards,lane,scope,includeColorless);
    const warning=lane.id==='UB'?'Theft engines are counted as enablers. Separate theft rewards are optional, not a requirement.':s.payoffs.length<6?'Thin rewards: '+s.payoffs.length+' payoffs. Check their quality and availability.':s.enablers.length<6?'Thin inputs: '+s.enablers.length+' enablers. Rewards may need more reliable support.':'Both roles are present; density alone does not prove a strong draft deck.';
    const group=(role,label,open)=>'<details class="design-roles" '+(open?'open':'')+'><summary>'+label+' <span>('+s[role].length+')</span></summary><div class="design-gallery preview">'+sorted(s[role]).slice(0,3).map(cardHTML).join('')+'</div>'+(s[role].length>3?'<details class="design-roles"><summary>All '+s[role].length+' '+label.toLowerCase()+'</summary><div class="design-gallery">'+sorted(s[role]).slice(3).map(cardHTML).join('')+'</div></details>':'')+(s[role].length?'':'<p class="design-foot">No cards in this scope.</p>')+'</details>';
    body.innerHTML='<p class="design-copy">'+e(lane.plan)+'</p><div class="design-controls"><select data-lane-scope="'+lane.id+'" aria-label="'+lane.guild+' card scope"><option value="pair" '+(scope==='pair'?'selected':'')+'>'+lane.guild+' core</option><option value="outside" '+(scope==='outside'?'selected':'')+'>Off-color options</option><option value="all" '+(scope==='all'?'selected':'')+'>All colors</option></select><label><input type="checkbox" data-lane-colorless="'+lane.id+'" '+(includeColorless?'checked':'')+'> Include colorless</label></div>'+group('payoffs','Payoffs',true)+'<div class="design-status">'+e(warning)+'</div>'+charts(s)+'<div class="design-color-counts">'+Object.entries(s.colors).map(([color,counts])=>'<span>'+pips(color==='C'?[]:[color])+counts.payoffs+' payoffs / '+counts.enablers+' enablers</span>').join('')+'</div><p class="design-foot">'+e(lane.note||'Cards can contribute to several plans; inspect a card to see its exact roles.')+'</p>'+group('enablers','Enablers',false);
  }
  root.querySelector('#design-lanes').innerHTML=model.lanes.map((lane,i)=>'<details class="design-lane" data-lane="'+lane.id+'" '+(i===0?'open':'')+'><summary>'+pips(lane.colors)+'<span class="design-title"><strong>'+e(lane.name)+'</strong><small>'+e(lane.guild)+(i===0?' / Cube centerpiece':'')+'</small></span><span class="design-pair-count"><strong>'+lane.pair.payoffs.length+' payoffs</strong><small>'+lane.pair.enablers.length+' enablers</small></span></summary><div class="design-body" data-lane-body="'+lane.id+'"></div></details>').join('');
  model.lanes.forEach(lane=>renderLaneBody(lane));
  root.addEventListener('change', event=>{
    const target=event.target, id=target.dataset.laneScope||target.dataset.laneColorless;
    if(!id)return;
    const body=root.querySelector('[data-lane-body="'+id+'"]');
    const scope=body.querySelector('select').value,include=body.querySelector('input').checked;
    renderLaneBody(model.lanes.find(l=>l.id===id),scope,include);
    const replacement=root.querySelector(target.dataset.laneScope?'[data-lane-scope="'+id+'"]':'[data-lane-colorless="'+id+'"]');
    replacement.focus();
  });
  const heat=(value,scale=15)=>'rgba(65,165,125,'+(0.08+Math.min(1,value/scale)*.65).toFixed(3)+')';
  const columns=[['payoffs','Payoffs'],['enablers','Enablers'],['both','Both'],['union','Total']];
  root.querySelector('#design-health').innerHTML='<table class="design-heat"><caption class="design-foot">In-pair + colorless. Numbers are cards; darker means denser support.</caption><thead><tr><th>Designed pair</th>'+columns.map(c=>'<th>'+c[1]+'</th>').join('')+'<th>Off-color payoffs</th></tr></thead><tbody>'+model.lanes.map(l=>'<tr><th>'+pips(l.colors)+' '+e(l.guild)+'<br>'+e(l.name)+'</th>'+columns.map(([key,label])=>'<td><button data-health-lane="'+l.id+'" data-health-role="'+key+'" title="'+e(l.guild+' '+label+': '+l.pair[key].length+' cards / '+l.pair.pairPool+' in-pair cards')+'" aria-label="'+e(l.guild+' '+label+' '+l.pair[key].length)+'" style="--heat:'+heat(l.pair[key].length/Math.max(1,l.pair.pairPool)*100)+'">'+l.pair[key].length+'</button></td>').join('')+'<td><button data-health-lane="'+l.id+'" data-health-role="outside" aria-label="'+l.guild+' off-color payoffs '+l.outside.payoffs.length+'" style="--heat:#24282c">'+l.outside.payoffs.length+'</button></td></tr>').join('')+'</tbody></table>';
  root.querySelector('#design-overlap').innerHTML='<table class="design-heat design-cross"><caption class="design-foot">Shared cards. Diagonal = each core total. Tap a number for card images.</caption><thead><tr><th>Core</th>'+model.lanes.map(l=>'<th title="'+e(l.guild+' '+l.name)+'">'+pips(l.colors)+'</th>').join('')+'</tr></thead><tbody>'+model.lanes.map((a,i)=>'<tr><th>'+pips(a.colors)+' '+e(a.guild)+'</th>'+model.lanes.map((b,j)=>'<td><button data-cross-a="'+i+'" data-cross-b="'+j+'" aria-label="'+e(a.guild+' with '+b.guild+': '+model.overlap[i][j].length+' shared cards')+'" style="--heat:'+(i===j?'#24282c':heat(model.overlap[i][j].length,20))+'">'+model.overlap[i][j].length+'</button></td>').join('')+'</tr>').join('')+'</tbody></table>';
  root.addEventListener('click',event=>{
    const card=event.target.closest('[data-design-card]');
    if(card){const dialog=document.querySelector('#design-card-dialog');dialog.showModal();showCard(card.dataset.designCard,'#design-card-detail');return;}
    const cross=event.target.closest('[data-cross-a]');
    const health=event.target.closest('[data-health-lane]');
    if(cross||health){
      let ids,label;
      if(cross){const a=Number(cross.dataset.crossA),b=Number(cross.dataset.crossB);ids=model.overlap[a][b];label=model.lanes[a].guild+' + '+model.lanes[b].guild;}
      else {const lane=model.lanes.find(l=>l.id===health.dataset.healthLane),role=health.dataset.healthRole;ids=role==='outside'?lane.outside.payoffs:lane.pair[role];label=lane.guild+' '+(role==='outside'?'off-color payoffs':role);}
      root.querySelector('#design-selection').textContent=label+': '+ids.length+' cards';
      root.querySelector('#design-bridges').innerHTML=sorted(ids).map(cardHTML).join('')||'<p>No shared cards in these cores.</p>';
      root.querySelector('#design-selection').scrollIntoView({block:'center'});
    }
  });
  const requested=new URL(location.href).searchParams.get('pair');
  if(requested&&model.lanes.some(l=>l.id===requested)){
    root.querySelectorAll('.design-lane').forEach(d=>d.open=d.dataset.lane===requested);
    requestAnimationFrame(()=>root.querySelector('[data-lane="'+requested+'"]').scrollIntoView({block:'center'}));
  }
}
