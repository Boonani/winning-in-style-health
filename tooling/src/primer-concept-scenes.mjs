import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const icon=name=>fs.readFileSync(require.resolve('lucide-static/icons/'+name+'.svg'),'utf8').replace('<svg','<svg aria-hidden="true"');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const CONCEPTS={
 removal:{actor:'Removal',obstacle:'Threat',result:'Threat answered',symbol:'sparkles',name:'An answer for their threat'},
 finish:{actor:'Flying attacker',obstacle:'Ground blocker',result:'Past the blocker',symbol:'wind',name:'A way past ground blockers'},
 'plan-lesson':{actor:'Early play',obstacle:'Interaction',result:'Finisher',symbol:'swords',name:'Cards working toward a plan'},
};

// Pose-to-pose staging with an analytic arc and overlapping settle.
// This function only returns illustration coordinates, never game actions.
export function conceptPose(kind,seconds,concepts=CONCEPTS){
 if(!Object.prototype.hasOwnProperty.call(concepts,kind))throw new RangeError('Unknown concept');
 if(!Number.isFinite(seconds))throw new RangeError('Expected finite illustration time');
 const u=Math.max(0,Math.min(1,seconds/4)), t=Math.max(0,Math.min(1,(u-.18)/.58));
 const ease=t*t*(3-2*t),wind=u<.18?Math.sin(u/.18*Math.PI):0;
 const settle=u>.76?Math.sin((u-.76)/.24*Math.PI*3)*Math.exp(-(u-.76)*16):0;
 return {u,x:95+410*ease-10*wind,y:kind==='finish'?175-360*t*(1-t):175-100*t*(1-t),
   angle:-10*wind+12*Math.sin(t*Math.PI)+6*settle,scale:1+.08*Math.sin(t*Math.PI)-.08*settle,
   trail:-8*Math.sin(t*Math.PI)+5*settle,answered:kind==='removal'?Math.max(0,Math.min(1,(u-.6)/.2)):0,
   focus:kind==='plan-lesson'?(u<.35?0:u<.72?1:2):0};
}
export const conceptSceneCSS=`
.concept-scene{margin:22px 0 30px}
.concept-scene>svg{display:block;width:100%;aspect-ratio:2/1}
.concept-scene .scene-controls{display:flex;gap:8px;justify-content:center}
.concept-scene button{display:grid;place-items:center;width:48px;height:48px;border:1px solid #65717E;border-radius:4px;color:var(--ink);background:transparent;cursor:pointer;touch-action:manipulation}
.concept-scene button svg{width:22px;height:22px}
.concept-scene button:focus-visible{outline:3px solid var(--mint);outline-offset:4px}
.concept-scene .scene-caption{font-size:13px;color:var(--muted);text-align:center;min-height:22px}
.concept-scene [hidden]{display:none}
`;
export function conceptSceneMarkup(kind,section){
 const base=CONCEPTS[kind];if(!base)throw new RangeError('Unknown concept');
 const c={...base,name:section?.heading??base.name,actor:section?.body[0]??base.actor,obstacle:section?.body[1]??base.obstacle,result:section?.body[2]??base.result};
 const plan=kind==='plan-lesson';
 const labelHeight=Math.max(48,Math.ceil(Math.max(c.actor.length,c.obstacle.length,c.result.length)/8)*24);
 const sceneHeight=Math.max(310,245+labelHeight);
 const label=(value,x,y)=>`<foreignObject x="${x}" y="${y}" width="180" height="${labelHeight}"><div xmlns="http://www.w3.org/1999/xhtml" style="font:20px/24px system-ui,sans-serif;color:#D8DDE5;text-align:center;overflow-wrap:anywhere">${esc(value)}</div></foreignObject>`;
 return `<div class="concept-scene" data-concept="${kind}">
 <svg viewBox="0 0 600 ${sceneHeight}" style="aspect-ratio:600/${sceneHeight}" role="img" aria-label="${esc(c.name)}">
 <path d="M70 245H535" stroke="#29313D" stroke-width="2"/>
 ${plan?'<path d="M95 175H505" stroke="#45D6C5" stroke-width="3" stroke-dasharray="5 7"/>':''}
 <g data-obstacle transform="translate(300 175)"><rect x="-31" y="-44" width="62" height="88" rx="4" fill="#252C34" stroke="#65717E"/><path d="M-12 0H12M0 -12V12" stroke="#A9B1BD" stroke-width="3"/>
 ${label(c.obstacle,-90,58)}</g>
 <g data-destination transform="translate(505 175)"><circle r="33" fill="none" stroke="#45D6C5" stroke-width="2" stroke-dasharray="3 5"/><path d="M-12 0L-3 9L15 -10" stroke="#45D6C5" stroke-width="4" fill="none" opacity="0" data-check/>
 ${plan?label(c.result,-90,58):''}</g>
 <g data-actor transform="translate(95 175)"><g data-trail><rect x="-29" y="-44" width="58" height="82" rx="4" fill="#090C12" stroke="#FFD166" transform="rotate(-9)"/></g>
 <rect x="-29" y="-42" width="58" height="82" rx="4" fill="#FF94AC"/>
 <g transform="translate(-16 -18)" color="#090C12">${icon(c.symbol).replace('width="24"','width="32"').replace('height="24"','height="32"')}</g></g>
 ${label(c.actor,5,233)}
 </svg>
 <div class="scene-controls" hidden><button data-play aria-label="Play ${esc(c.name)}" title="Play ${esc(c.name)}">${icon('play')}</button><button data-restart aria-label="Restart ${esc(c.name)}" title="Restart ${esc(c.name)}">${icon('rotate-ccw')}</button></div>
 <p class="scene-caption" aria-live="polite">Illustration</p>
 <script>(${mountScene.toString()})(${JSON.stringify(kind)},${JSON.stringify({...CONCEPTS,[kind]:c}).replaceAll('<','\\u003c')},${conceptPose.toString()},${JSON.stringify({play:icon('play'),pause:icon('pause')})});</script>
 </div>`;
}
function mountScene(kind,concepts,pose,icons){
 const root=document.currentScript.closest('[data-concept]'),c=concepts[kind];
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const play=root.querySelector('[data-play]'),caption=root.querySelector('.scene-caption');
 let time=0,playing=false,last=0,frame=0,visible=false;
 const calculate=seconds=>pose(kind,seconds,concepts);
 function draw(){
   const p=calculate(time),actor=root.querySelector('[data-actor]');
   actor.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+p.angle+') scale('+p.scale+' '+(1/p.scale)+')');
   root.querySelector('[data-trail]').setAttribute('transform','rotate('+p.trail+')');
   root.querySelector('[data-obstacle]').setAttribute('opacity',1-p.answered);
   root.querySelector('[data-check]').setAttribute('opacity',p.u>.8?'1':'0');
   if(kind==='plan-lesson'){
     root.querySelector('[data-obstacle] rect').setAttribute('stroke',p.focus===1?'#FFD166':'#65717E');
     root.querySelector('[data-destination] circle').setAttribute('stroke',p.focus===2?'#FFD166':'#45D6C5');
   }
   root.dataset.progress=p.u.toFixed(3);
   caption.textContent=p.u===1?c.result:'Illustration';
   const label=(playing?'Pause ':'Play ')+c.name;
   if(play.getAttribute('aria-label')!==label)play.innerHTML=playing?icons.pause:icons.play;
   play.setAttribute('aria-label',label);play.title=label;
 }
 function tick(now){
   frame=0;if(!playing||!visible||document.hidden){last=0;return;}
   if(last)time=(time+Math.min((now-last)/1000,.1))%5;last=now;
   draw();
   if(playing)frame=requestAnimationFrame(tick);
 }
 function schedule(){last=0;if(!frame&&playing&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
 play.onclick=()=>{
   if(media.matches){playing=false;time=time===4?0:4;draw();return;}
   playing=!playing;draw();schedule();
 };
 root.querySelector('[data-restart]').onclick=()=>{time=0;playing=false;draw();};
 media.addEventListener('change',()=>{if(media.matches){playing=false;draw();}});
 document.addEventListener('visibilitychange',schedule);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.2}).observe(root);
 root.querySelector('.scene-controls').hidden=false;draw();
}
