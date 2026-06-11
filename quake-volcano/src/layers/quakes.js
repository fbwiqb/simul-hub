import { quakePopup } from '../ui/popup.js';
import { filterQuakes, summarizeQuakes } from './quakeFilters.js';
import { closestWrappedLng, visibleWorldOffsets } from './geoWrap.js';

const FEEDS = {
  week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
  month: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson',
};

function colorForDepth(depth) {
  const d = Number(depth);
  if (!Number.isFinite(d)) return '#7f8c8d';
  if (d < 70) return '#d84a3a';
  if (d < 300) return '#f0a43a';
  return '#2879b8';
}

function radiusForMagnitude(magnitude) {
  const mag = Math.max(0, Number(magnitude) || 0);
  return Math.max(1.8, Math.min(10, 1.35 + mag * 1.22));
}

function featureKey(feature) {
  return feature.id || `${feature.properties?.time}-${feature.properties?.place}`;
}

async function loadFeed(kind) {
  const res = await fetch(FEEDS[kind]);
  if (!res.ok) throw new Error(`USGS ${kind} feed failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.features) ? data.features : [];
}

function buildMarker(feature, offset, renderer) {
  const [lon, lat, depth] = feature.geometry?.coordinates ?? [];
  const mag = feature.properties?.mag ?? 0;
  const marker = L.circleMarker([lat, lon + offset], {
    renderer,
    radius: radiusForMagnitude(mag),
    fillColor: colorForDepth(depth),
    color: '#ffffff',
    weight: 0.55,
    opacity: 0.9,
    fillOpacity: 0.72,
  });
  marker.bindPopup(quakePopup(feature));
  return marker;
}

export async function addQuakeLayer(map, options = {}) {
  const renderer = L.canvas({ padding: 0.45 });
  const group = L.layerGroup();
  let allFeatures = await loadFeed('month');
  let sourceKind = 'month';
  let deepHistoryFeatures = Array.isArray(options.deepHistoryFeatures) ? options.deepHistoryFeatures : [];
  let filter = { magMin: 0, days: 30, depth: 'all' };
  let visible = false;
  let visibleCount = 0;
  let animationTimer = null;
  let markerByKey = new Map();
  let renderedOffsetsKey = '';
  let onUpdate = () => {};

  function stopAnimationTimer() {
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

  function filteredFeatures() {
    return filterQuakes(allFeatures, filter, { deepHistoryFeatures });
  }

  function currentOffsets() {
    return visibleWorldOffsets(map.getBounds());
  }

  function offsetsKey(offsets) {
    return offsets.join(',');
  }

  function addFeature(feature, offsets = currentOffsets()) {
    const key = featureKey(feature);
    const markers = [];
    for (const offset of offsets) {
      const marker = buildMarker(feature, offset, renderer);
      markers.push(marker);
      group.addLayer(marker);
    }
    markerByKey.set(key, markers);
  }

  function applyFilter() {
    stopAnimationTimer();
    group.clearLayers();
    markerByKey = new Map();
    const features = filteredFeatures();
    const offsets = currentOffsets();
    renderedOffsetsKey = offsetsKey(offsets);
    for (const feature of features) addFeature(feature, offsets);
    visibleCount = features.length;
    onUpdate();
  }

  applyFilter();

  map.on('moveend zoomend', () => {
    const nextKey = offsetsKey(currentOffsets());
    if (visible && !animationTimer && nextKey !== renderedOffsetsKey) applyFilter();
  });

  return {
    setFilter(newFilter, shouldApply = true) {
      filter = { ...filter, ...newFilter };
      if (shouldApply) applyFilter();
    },
    async ensureMonth() {
      if (sourceKind !== 'month') {
        allFeatures = await loadFeed('month');
        sourceKind = 'month';
        applyFilter();
      }
    },
    playAnimation(onProgress, playOptions = {}) {
      stopAnimationTimer();
      const features = filteredFeatures().sort((a, b) => a.properties.time - b.properties.time);
      group.clearLayers();
      markerByKey = new Map();
      visibleCount = 0;
      onUpdate();
      if (features.length === 0) {
        onProgress?.(1);
        return;
      }
      const targetDurationMs = Math.max(300, Number(playOptions.durationMs) || 1400);
      const stepMs = 16;
      const batchSize = Math.max(1, Math.ceil(features.length / (targetDurationMs / stepMs)));
      const offsets = currentOffsets();
      let index = 0;
      animationTimer = setInterval(() => {
        if (index >= features.length) {
          stopAnimationTimer();
          onProgress?.(1);
          return;
        }
        const nextIndex = Math.min(features.length, index + batchSize);
        for (; index < nextIndex; index += 1) addFeature(features[index], offsets);
        visibleCount = index;
        onProgress?.(index / features.length);
        onUpdate();
      }, stepMs);
    },
    stopAnimation() {
      stopAnimationTimer();
      applyFilter();
    },
    show() {
      if (!visible) {
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
    setOnUpdate(fn) {
      onUpdate = typeof fn === 'function' ? fn : () => {};
    },
    setDeepHistory(features) {
      deepHistoryFeatures = Array.isArray(features) ? features : [];
      if (visible && filter.depth === 'deep') applyFilter();
    },
    hasDeepHistory() {
      return deepHistoryFeatures.length > 0;
    },
    getFilter() {
      return { ...filter };
    },
    getSummary() {
      return summarizeQuakes(filteredFeatures());
    },
    getStrongestFeature() {
      return summarizeQuakes(filteredFeatures()).strongest;
    },
    focusStrongest() {
      const strongest = summarizeQuakes(filteredFeatures()).strongest;
      if (!strongest) return null;
      const [lon, lat] = strongest.geometry.coordinates;
      const key = featureKey(strongest);
      const displayLng = closestWrappedLng(lon, map.getCenter().lng);
      if (!visible) this.show();
      if (!markerByKey.has(key)) applyFilter();
      const markers = markerByKey.get(key) || [];
      const marker = markers.reduce((best, item) => (
        !best || Math.abs(item.getLatLng().lng - displayLng) < Math.abs(best.getLatLng().lng - displayLng) ? item : best
      ), null);
      map.setView([lat, displayLng], Math.max(map.getZoom(), 5), { animate: true });
      setTimeout(() => marker?.openPopup(), 350);
      return strongest;
    },
    getVisibleCount() {
      return visibleCount;
    },
    getAllCount() {
      return allFeatures.length;
    },
    getSourceKind() {
      return sourceKind;
    },
    isVisible() {
      return visible;
    },
  };
}
