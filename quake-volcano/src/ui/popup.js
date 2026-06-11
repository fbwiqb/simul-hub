function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(ms) {
  if (!Number.isFinite(ms)) return '시각 정보 없음';
  return new Date(ms).toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatNumber(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '?';
}

function depthLabel(depth) {
  const d = Number(depth);
  if (!Number.isFinite(d)) return '정보 없음';
  if (d < 70) return '천발 (< 70 km)';
  if (d < 300) return '중발 (70-300 km)';
  return '심발 (> 300 km)';
}

export function quakePopup(feature) {
  const p = feature.properties ?? {};
  const [lon, lat, depth] = feature.geometry?.coordinates ?? [];
  const mag = Number(p.mag);
  const title = Number.isFinite(mag) ? `규모 ${mag.toFixed(1)}` : '규모 정보 없음';
  return `
    <div class="popup-card">
      <div class="popup-title">${escapeHtml(title)}</div>
      <div class="popup-subtitle">${escapeHtml(p.place || '위치 정보 없음')}</div>
      <div class="popup-row"><b>깊이</b><span>${formatNumber(depth, 1)} km</span></div>
      <div class="popup-row"><b>구분</b><span>${escapeHtml(depthLabel(depth))}</span></div>
      <div class="popup-row"><b>좌표</b><span>${formatNumber(lat, 2)}, ${formatNumber(lon, 2)}</span></div>
      <div class="popup-row"><b>시각</b><span>${escapeHtml(formatDate(p.time))}</span></div>
    </div>
  `;
}

export function volcanoPopup(volcano) {
  return `
    <div class="popup-card">
      <div class="popup-title">▲ ${escapeHtml(volcano.name || '이름 없음')}</div>
      <div class="popup-subtitle">${escapeHtml(volcano.country || '국가 정보 없음')}</div>
      <div class="popup-row"><b>종류</b><span>${escapeHtml(volcano.type || '정보 없음')}</span></div>
      <div class="popup-row"><b>높이</b><span>${Number(volcano.elevation).toLocaleString('ko-KR')} m</span></div>
      <div class="popup-row"><b>좌표</b><span>${formatNumber(volcano.lat, 2)}, ${formatNumber(volcano.lon, 2)}</span></div>
      <div class="popup-row"><b>분화 기록</b><span>${escapeHtml(volcano.lastEruptionLabel || '정보 없음')}</span></div>
      <div class="popup-row"><b>근거</b><span>${escapeHtml(volcano.evidence || '정보 없음')}</span></div>
    </div>
  `;
}
