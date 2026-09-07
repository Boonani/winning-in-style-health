// A teaching simulation only. No draft, deck or bot state is read or written.
export function createDraftSimulation({cardsPerPack = 15, speeds = [1.2, 3.8, 1.7, 2.1]} = {}) {
  if (!Number.isInteger(cardsPerPack) || cardsPerPack < 1 || cardsPerPack > 15
      || speeds.length !== 4 || speeds.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Invalid simulation settings');
  const state = {
    time: 0, finished: false, events: [],
    players: speeds.map((speed, id) => ({id, speed, queue: [id], held: null, due: Infinity, picks: []})),
    packs: speeds.map((_, id) => ({id, remaining: cardsPerPack, status: 'queued', seat: id, from: id, to: id, departure: 0, arrival: Infinity})),
  };
  function receive() {
    for (const player of state.players) {
      if (player.held !== null || !player.queue.length) continue;
      const id = player.queue.shift(), pack = state.packs[id];
      player.held = id;
      pack.status = 'held';
      pack.seat = player.id;
      player.due = state.time + player.speed * (1 + .13 * Math.sin(player.picks.length * 2 + player.id));
      state.events.push({type: 'receive', time: state.time, player: player.id, pack: id});
    }
  }
  receive();
  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid time increment');
    const target = state.time + seconds;
    while (!state.finished) {
      const due = Math.min(...state.players.map(p => p.due), ...state.packs.map(p => p.arrival));
      if (due > target || !Number.isFinite(due)) break;
      state.time = due;
      for (const pack of state.packs) {
        if (pack.arrival !== due) continue;
        pack.arrival = Infinity;
        pack.status = 'queued';
        pack.seat = pack.to;
        state.players[pack.to].queue.push(pack.id);
        state.events.push({type: 'arrive', time: due, player: pack.to, pack: pack.id});
      }
      for (const player of state.players) {
        if (player.due !== due) continue;
        const pack = state.packs[player.held];
        player.picks.push(pack.id + ':' + pack.remaining);
        state.events.push({type: 'pick', time: due, player: player.id, pack: pack.id});
        pack.remaining--;
        player.held = null;
        player.due = Infinity;
        if (pack.remaining) {
          pack.status = 'flight';
          pack.from = player.id;
          pack.to = (player.id + 1) % 4;
          pack.departure = due;
          pack.arrival = due + .95;
        } else pack.status = 'empty';
      }
      receive();
      state.finished = state.packs.every(p => p.status === 'empty');
    }
    state.time = target;
    return state;
  }
  return {state, advance};
}
