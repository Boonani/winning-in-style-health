// Presentation only: reserve space for waiting packs, then separate their full silhouettes.
// The finite draft simulation and its pick order are never modified.
export function layoutDraftPacks(state, hands, reduced = false) {
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => n*n*(3-2*n);
  const offsets = [[-76,0],[0,-76],[76,0],[0,76]];
  const slot = (seat, index) => {
    const base = hands[seat], offset = offsets[seat];
    return [base[0]+offset[0]*index, base[1]+offset[1]*index];
  };
  const poses = state.packs.filter(p => p.status !== 'empty').map(pack => {
    let [x,y] = hands[pack.seat], angle=0, stretch=1;
    if (pack.status === 'flight') {
      const receiver = state.players[pack.to];
      const waiting = receiver.queue.length + (receiver.held === null ? 0 : 1);
      const a = hands[pack.from], b = slot(pack.to, waiting);
      const raw = clamp((state.time-pack.departure)/.95), t = reduced ? 1 : ease(raw);
      const cx=a[0]+b[0]-250, cy=a[1]+b[1]-250;
      x=(1-t)*(1-t)*a[0]+2*(1-t)*t*cx+t*t*b[0];
      y=(1-t)*(1-t)*a[1]+2*(1-t)*t*cy+t*t*b[1];
      angle=reduced?0:Math.sin(t*Math.PI)*12;
      stretch=reduced?1:1+.06*Math.sin(raw*Math.PI);
    } else if (pack.status === 'queued') {
      [x,y]=slot(pack.seat,state.players[pack.seat].queue.indexOf(pack.id)+1);
    } else if (!reduced) {
      const anticipation=clamp(1-(state.players[pack.seat].due-state.time)/.25);
      angle=Math.sin(anticipation*Math.PI)*-6;
    }
    return {id:pack.id,x,y,angle,stretch};
  });
  // 80 units encloses both rotated card fans, including stretch, with a visible gap.
  // Deterministic projection keeps crowded queues inside the table's safe area.
  for(let pass=0;pass<120;pass++) {
    for(const p of poses) {
      p.x=Math.max(104,Math.min(396,p.x));
      p.y=Math.max(104,Math.min(396,p.y));
    }
    let overlap=false;
    for(let i=0;i<poses.length;i++) for(let j=i+1;j<poses.length;j++) {
      const a=poses[i],b=poses[j];
      let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
      if(d>=80)continue;
      if(d<.000001){dx=1;dy=0;d=1;}
      const shift=(80-d)/2+.00001;
      a.x-=dx/d*shift;a.y-=dy/d*shift;
      b.x+=dx/d*shift;b.y+=dy/d*shift;
      overlap=true;
    }
    if(!overlap)break;
  }
  return poses;
}
