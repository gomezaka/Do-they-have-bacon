export function calculateBaconStatus(reports = []) {
  const yes = reports.filter((r) => r.status === 'yes').length;
  const no = reports.filter((r) => r.status === 'no').length;
  const unsure = reports.filter((r) => r.status === 'unsure').length;
  const total = yes + no + unsure;
  const last = reports
    .map((r) => r.observed_date || r.observedDate || r.created_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  if (!total) {
    return {
      key: 'unscouted',
      emoji: '🕵️',
      label: 'Unscouted bacon territory',
      description: 'No scout has reported from this hotel yet.',
      yes,
      no,
      unsure,
      total,
      last
    };
  }

  if (yes >= 2 && no >= 2 && Math.abs(yes - no) <= 1) {
    return {
      key: 'contested',
      emoji: '⚠️',
      label: 'Bacon status contested',
      description: 'The breakfast truth is unclear.',
      yes,
      no,
      unsure,
      total,
      last
    };
  }

  if (yes > no && yes >= unsure) {
    return {
      key: 'bacon_confirmed',
      emoji: '🥓',
      label: 'Bacon confirmed',
      description: 'Civilization survives.',
      yes,
      no,
      unsure,
      total,
      last
    };
  }

  if (no > yes && no >= unsure) {
    return {
      key: 'no_bacon_reported',
      emoji: '🌵',
      label: 'No bacon reported',
      description: 'Stay strong.',
      yes,
      no,
      unsure,
      total,
      last
    };
  }

  return {
    key: 'uncertain',
    emoji: '🤔',
    label: 'Bacon uncertainty detected',
    description: 'Suspicious breakfast matter.',
    yes,
    no,
    unsure,
    total,
    last
  };
}

export function formatDate(value) {
  if (!value) return 'not yet';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
