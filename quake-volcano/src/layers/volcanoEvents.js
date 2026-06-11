const KNOWN_ERUPTION_CODES = new Set(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']);

export function isKnownEruptionCode(code) {
  return KNOWN_ERUPTION_CODES.has(String(code ?? ''));
}

function hasValidCoordinate(volcano) {
  const { lat, lon } = volcano ?? {};
  if (lat == null || lon == null) return false;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
}

export function buildEruptionEvents(volcanoes = []) {
  const events = [];
  for (const volcano of volcanoes) {
    if (!hasValidCoordinate(volcano)) continue;
    if (!isKnownEruptionCode(volcano.lastEruptionCode)) continue;
    events.push({ ...volcano, eventKind: 'eruption-record' });
  }
  return events;
}
