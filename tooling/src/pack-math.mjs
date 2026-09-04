const round = (value, digits = 2) => Number(value.toFixed(digits));

function logChoose(n, k) {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  const shorter = Math.min(k, n - k);
  let result = 0;
  for (let i = 1; i <= shorter; i += 1) result += Math.log(n - shorter + i) - Math.log(i);
  return result;
}

function probabilityNone(population, successes, draws) {
  if (successes <= 0) return 1;
  if (draws > population - successes) return 0;
  return Math.exp(logChoose(population - successes, draws) - logChoose(population, draws));
}

export function chanceAtLeastOne(population, copies, draws) {
  return round((1 - probabilityNone(population, copies, draws)) * 100, 1);
}

function visibility(population, enablers, payoffs, union, draws) {
  const noEnabler = probabilityNone(population, enablers, draws);
  const noPayoff = probabilityNone(population, payoffs, draws);
  const noSupport = probabilityNone(population, union, draws);
  return {
    draws,
    expectedEnablers: round((enablers * draws) / population),
    expectedPayoffs: round((payoffs * draws) / population),
    expectedSupport: round((union * draws) / population),
    enablerChance: round((1 - noEnabler) * 100, 1),
    payoffChance: round((1 - noPayoff) * 100, 1),
    supportChance: round((1 - noSupport) * 100, 1),
    bothChance: round((1 - noEnabler - noPayoff + noSupport) * 100, 1),
  };
}

export function packVisibility(archetypes, population, players = 8, packetSize = 15) {
  return archetypes.map((archetype) => {
    const enablerIds = new Set(archetype.roleCardIds.enablers);
    const payoffIds = new Set(archetype.roleCardIds.payoffs);
    const supportIds = new Set([...enablerIds, ...payoffIds, ...archetype.roleCardIds.glue]);
    const coreIds = new Set([...enablerIds, ...payoffIds]);
    const packet = visibility(population, enablerIds.size, payoffIds.size, coreIds.size, packetSize);
    const table = visibility(population, enablerIds.size, payoffIds.size, coreIds.size, players * packetSize);
    const expectedCoherentPackets = round((players * packet.bothChance) / 100);
    const tableReady = table.bothChance >= 95 && table.expectedEnablers >= 2 && table.expectedPayoffs >= 2
      ? 'High visibility'
      : table.bothChance >= 80
        ? 'Visible'
        : table.bothChance >= 60
          ? 'Inconsistent'
          : 'Scarce';
    return {
      archetypeId: archetype.id,
      name: archetype.name,
      population,
      players,
      packetSize,
      sampleSize: players * packetSize,
      enablers: enablerIds.size,
      payoffs: payoffIds.size,
      coreCards: coreIds.size,
      supportCards: supportIds.size,
      packet,
      table,
      expectedPacketsWithEnabler: round((players * packet.enablerChance) / 100),
      expectedPacketsWithPayoff: round((players * packet.payoffChance) / 100),
      expectedCoherentPackets,
      tableReady,
    };
  });
}
