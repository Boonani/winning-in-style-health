export const CUBE_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];

export const ROLE_KEYS = ['enablers', 'payoffs'];

function cardSupportColors(card) {
  return card?.colors?.length ? card.colors.filter((color) => CUBE_COLORS.includes(color)) : ['C'];
}

export function circleDiameter(count, scaleMax, maxDiameter = 76) {
  const safeCount = Math.max(0, Number(count) || 0);
  const safeMax = Math.max(1, Number(scaleMax) || 1);
  return Math.round(maxDiameter * Math.sqrt(safeCount / safeMax) * 100) / 100;
}

export function buildThemeSupportModel(data) {
  const cardsById = new Map((data.cards || []).map((card) => [card.id, card]));
  const themes = (data.themes || []).map((theme) => {
    const roles = Object.fromEntries(ROLE_KEYS.map((role) => {
      const cards = (theme.roleCardIds?.[role] || []).map((id) => cardsById.get(id)).filter(Boolean);
      const colors = Object.fromEntries(CUBE_COLORS.map((color) => [color, 0]));
      for (const card of cards) {
        for (const color of cardSupportColors(card)) colors[color] += 1;
      }
      const highest = Math.max(0, ...Object.values(colors));
      return [role, {
        count: cards.length,
        colors,
        dominantColors: highest ? CUBE_COLORS.filter((color) => colors[color] === highest) : [],
      }];
    }));
    return {
      id: theme.id,
      name: theme.name,
      glue: theme.roleCardIds?.glue?.length || 0,
      roles,
    };
  });
  const scaleMax = Math.max(1, ...themes.flatMap((theme) => ROLE_KEYS.map((role) => theme.roles[role].count)));
  for (const theme of themes) {
    for (const role of ROLE_KEYS) {
      theme.roles[role].diameter = circleDiameter(theme.roles[role].count, scaleMax);
      for (const color of CUBE_COLORS) {
        theme.roles[role].colorDiameter ??= {};
        theme.roles[role].colorDiameter[color] = circleDiameter(theme.roles[role].colors[color], scaleMax);
      }
    }
  }
  return { scaleMax, maxDiameter: 76, themes };
}

export function groupUpdateEvents(events, period) {
  const groups = new Map();
  for (const event of events) {
    let key = 'undated', label = 'Undated';
    if (event.date != null) {
      const date = new Date(event.date);
      if (period === 'month') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
      key = period === 'week' || period === 'month' ? [date.getFullYear(), date.getMonth(), date.getDate()].join('-') : [date.getFullYear(), date.getMonth()].join('-');
      label = (period === 'month' ? 'Week of ' : '') + new Intl.DateTimeFormat(undefined, period === 'week' || period === 'month' ? {month:'short',day:'numeric',year:'numeric'} : {month:'long',year:'numeric'}).format(date);
    }
    if (!groups.has(key)) groups.set(key, { key, label, events: [] });
    groups.get(key).events.push(event);
  }
  return [...groups.values()];
}

export function updateWindowStart(period, now = new Date()) {
  if (period === 'all') return null;
  const days = { week: 7, month: 30, quarter: 90 }[period];
  if (!days) throw new Error(`Unknown update period: ${period}`);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function filterUpdateEvents(events, period, now = new Date()) {
  const start = updateWindowStart(period, now);
  return (events || [])
    .filter((event) => {
      if (event.date == null) return period === 'all';
      const date = new Date(event.date);
      return !Number.isNaN(date.getTime()) && (!start || date >= start) && date <= now;
    })
    .sort((a, b) => {
      if (a.date == null) return 1;
      if (b.date == null) return -1;
      return new Date(b.date) - new Date(a.date);
    });
}
