export function historyCard(entry, details) {
  const cardID = entry?.cardID;
  const d = details[cardID];
  if (!cardID || !d?.name) throw new Error(`Unresolved history card: ${cardID}`);
  return { name: d.name, imageUrl: d.image_normal ?? d.imageUrl ?? '', cardId: cardID, oracleId: d.oracle_id ?? d.oracleId ?? '' };
}

export function buildUpdateHistory(posts, details, coverage) {
  const seen = new Set();
  const events = [];
  for (const post of posts) {
    if (!post.id || seen.has(post.id)) continue;
    seen.add(post.id);
    if (!Number.isFinite(Number(post.date)) || Number(post.date) <= 0) throw new Error(`Invalid changelog date: ${post.id}`);
    const change = post.changelog?.mainboard;
    if (!change) continue;
    const added = (change.adds ?? []).map((c) => historyCard(c, details));
    const removed = (change.removes ?? []).map((c) => historyCard(c.oldCard ?? c, details));
    const replacements = [];
    let printingChanges = 0;
    for (const edit of [...(change.swaps ?? []), ...(change.edits ?? [])]) {
      const next = edit.card ?? edit.newCard;
      if (!next || !edit.oldCard || next.cardID === edit.oldCard.cardID) continue;
      const from = historyCard(edit.oldCard, details);
      const to = historyCard(next, details);
      if ((from.oracleId && from.oracleId === to.oracleId) || from.name === to.name) { printingChanges += 1; continue; }
      replacements.push({ from, to });
    }
    if (!added.length && !removed.length && !replacements.length) continue;
    events.push({ id: post.id, date: new Date(Number(post.date)).toISOString(), title: 'Cube update', sourceUrl: `https://cubecobra.com/cube/changelog/${post.cubeId}/${post.id}`, added, removed, replacements, printingChanges });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return { available: true, coverage, events };
}
