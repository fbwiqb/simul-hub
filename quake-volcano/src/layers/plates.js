import { wrapFeatureCollection } from './geoWrap.js';

const STYLE = {
  divergent: { color: '#2f9d69', weight: 2.1, opacity: 0.92 },
  convergent: { color: '#d97a20', weight: 2.4, opacity: 0.94 },
  transform: { color: '#2879b8', weight: 2.0, opacity: 0.9 },
  default: { color: '#8a9088', weight: 1.4, opacity: 0.72 },
};

export const PLATE_TYPES = ['divergent', 'convergent', 'transform'];

export function classifyPlateBoundary(properties = {}) {
  const raw = String(properties.STEPCLASS || properties.Type || properties.type || '').toUpperCase();
  if (['OSR', 'CRB', 'RS'].some((key) => raw.includes(key))) return 'divergent';
  if (['SUB', 'CCB', 'OCB', 'COL', 'CON'].some((key) => raw.includes(key))) return 'convergent';
  if (['OTF', 'CTF', 'TF', 'TRF'].some((key) => raw.includes(key))) return 'transform';
  return 'default';
}

export function isSubductionBoundary(properties = {}) {
  const raw = String(properties.STEPCLASS || properties.Type || properties.type || '').toUpperCase();
  return raw.includes('SUB');
}

export async function addPlateLayer(map) {
  const res = await fetch('./public/plates.geojson');
  if (!res.ok) throw new Error(`Plate boundary request failed: ${res.status}`);
  const data = await res.json();
  const wrappedData = wrapFeatureCollection(data);

  let activeTypes = new Set(PLATE_TYPES);
  let subductionOnly = false;

  function shouldInclude(feature) {
    if (subductionOnly) return isSubductionBoundary(feature.properties);
    const kind = classifyPlateBoundary(feature.properties);
    return activeTypes.has(kind);
  }

  function buildLayer() {
    return L.geoJSON(wrappedData, {
      style(feature) {
        return STYLE[classifyPlateBoundary(feature.properties)];
      },
      filter: shouldInclude,
      interactive: false,
    });
  }

  let layer = null;
  let visible = false;

  function getLayer() {
    if (!layer) layer = buildLayer();
    return layer;
  }

  function rebuild() {
    const wasVisible = visible;
    if (visible && layer) map.removeLayer(layer);
    layer = null;
    visible = false;
    if (wasVisible) {
      getLayer().addTo(map);
      visible = true;
    }
  }

  return {
    show() {
      if (!visible) {
        getLayer().addTo(map);
        visible = true;
      }
    },
    hide() {
      if (visible) {
        map.removeLayer(layer);
        visible = false;
      }
    },
    toggle(nextVisible) {
      if (nextVisible) this.show();
      else this.hide();
      return visible;
    },
    setMode(nextMode) {
      const nextSubduction = nextMode === 'subduction';
      if (nextSubduction === subductionOnly) return;
      subductionOnly = nextSubduction;
      rebuild();
    },
    setActiveTypes(types) {
      const next = new Set(Array.isArray(types) ? types : PLATE_TYPES);
      const sameSize = next.size === activeTypes.size;
      const sameItems = sameSize && [...next].every((t) => activeTypes.has(t));
      if (sameItems) return;
      activeTypes = next;
      subductionOnly = false;
      rebuild();
    },
    getActiveTypes() {
      return new Set(activeTypes);
    },
    isSubductionOnly() {
      return subductionOnly;
    },
    getMode() {
      return subductionOnly ? 'subduction' : 'all';
    },
    isVisible() {
      return visible;
    },
  };
}
