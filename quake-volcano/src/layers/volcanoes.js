import { volcanoPopup } from '../ui/popup.js';
import { visibleWorldOffsets } from './geoWrap.js';
import { buildEruptionEvents } from './volcanoEvents.js';

export const VOLCANO_CATEGORIES = ['recent', 'modern', 'historical'];

export function eruptionCategory(volcano) {
  const code = String(volcano.lastEruptionCode || '');
  if (code === 'D1') return 'recent';
  if (code === 'D2' || code === 'D3') return 'modern';
  if (['D4', 'D5', 'D6', 'D7'].includes(code)) return 'historical';
  return 'uncertain';
}

const AGE_ORDER = { D7: 0, D6: 1, D5: 2, D4: 3, D3: 4, D2: 5, D1: 6 };

export function ageRank(volcano) {
  return AGE_ORDER[String(volcano.lastEruptionCode || '')] ?? -1;
}

function eruptionStyle(volcano) {
  const styles = {
    recent: { fill: '#c0392b', stroke: '#fff0e6', opacity: 0.96, size: 18 },
    modern: { fill: '#e67e22', stroke: '#fff4df', opacity: 0.86, size: 14 },
    historical: { fill: '#8e7cc3', stroke: '#f1eaff', opacity: 0.7, size: 10 },
    uncertain: { fill: '#8e7cc3', stroke: '#f1eaff', opacity: 0.4, size: 8 },
  };
  return styles[eruptionCategory(volcano)];
}

function triangleIcon(volcano) {
  const style = eruptionStyle(volcano);
  const half = style.size / 2;
  const height = style.size;
  return L.divIcon({
    className: 'volcano-icon',
    html: `<svg width="${style.size}" height="${height}" viewBox="0 0 ${style.size} ${height}" aria-hidden="true"><path d="M${half} 1.2 ${style.size - 1.2} ${height - 1.2} 1.2 ${height - 1.2}Z" fill="${style.fill}" fill-opacity="${style.opacity}" stroke="${style.stroke}" stroke-width="1.4"/></svg>`,
    iconSize: [style.size, height],
    iconAnchor: [half, height - 1],
    popupAnchor: [0, -12],
  });
}

function makeMarker(volcano, offset) {
  const marker = L.marker([volcano.lat, volcano.lon + offset], {
    icon: triangleIcon(volcano),
    title: `${volcano.name} · ${volcano.lastEruptionLabel || '분화 시기 정보 없음'}`,
    keyboard: true,
  });
  marker.bindPopup(volcanoPopup(volcano));
  return marker;
}

export async function addVolcanoLayer(map) {
  const res = await fetch('./public/volcanoes.json');
  if (!res.ok) throw new Error(`Volcano request failed: ${res.status}`);
  const raw = await res.json();
  const data = buildEruptionEvents(raw).sort((a, b) => ageRank(a) - ageRank(b));
  const group = L.layerGroup();
  let renderedOffsetsKey = '';
  let animationLimit = data.length;
  let activeCategories = new Set(VOLCANO_CATEGORIES);

  function currentOffsets() {
    return visibleWorldOffsets(map.getBounds());
  }

  function render() {
    group.clearLayers();
    const offsets = currentOffsets();
    renderedOffsetsKey = offsets.join(',');
    const limit = Math.min(animationLimit, data.length);
    for (let i = 0; i < limit; i += 1) {
      const volcano = data[i];
      if (!activeCategories.has(eruptionCategory(volcano))) continue;
      for (const offset of offsets) {
        group.addLayer(makeMarker(volcano, offset));
      }
    }
  }

  let visible = false;
  render();

  map.on('moveend zoomend', () => {
    const nextKey = currentOffsets().join(',');
    if (visible && nextKey !== renderedOffsetsKey) render();
  });

  function countVisible() {
    let total = 0;
    const limit = Math.min(animationLimit, data.length);
    for (let i = 0; i < limit; i += 1) {
      if (activeCategories.has(eruptionCategory(data[i]))) total += 1;
    }
    return total;
  }

  return {
    show() {
      if (!visible) {
        const nextKey = currentOffsets().join(',');
        if (nextKey !== renderedOffsetsKey) render();
        group.addTo(map);
        visible = true;
      }
    },
    hide() {
      if (visible) {
        map.removeLayer(group);
        visible = false;
      }
    },
    toggle(nextVisible) {
      if (nextVisible) this.show();
      else this.hide();
      return visible;
    },
    setActiveCategories(categories) {
      const next = new Set(Array.isArray(categories) ? categories : VOLCANO_CATEGORIES);
      const sameSize = next.size === activeCategories.size;
      const sameItems = sameSize && [...next].every((c) => activeCategories.has(c));
      if (sameItems) return;
      activeCategories = next;
      render();
    },
    getActiveCategories() {
      return new Set(activeCategories);
    },
    count() {
      return countVisible();
    },
    totalCount() {
      return data.length;
    },
    isVisible() {
      return visible;
    },
    beginAnimation() {
      animationLimit = 0;
      if (visible) render();
    },
    setAnimationProgress(progress) {
      const ratio = Math.max(0, Math.min(1, Number(progress) || 0));
      animationLimit = Math.round(ratio * data.length);
      if (visible) render();
    },
    endAnimation() {
      animationLimit = data.length;
      if (visible) render();
    },
  };
}
