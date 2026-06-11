export function classifyDepth(depth) {
  const value = Number(depth);
  if (!Number.isFinite(value)) return 'unknown';
  if (value < 70) return 'shallow';
  if (value < 300) return 'intermediate';
  return 'deep';
}

export function matchesDepthFilter(feature, depthFilter = 'all') {
  if (depthFilter === 'all') return true;
  const depth = feature.geometry?.coordinates?.[2];
  return classifyDepth(depth) === depthFilter;
}

function featureMag(feature) {
  return Number(feature?.properties?.mag ?? 0);
}

function featureTime(feature) {
  return Number(feature?.properties?.time ?? 0);
}

export function filterQuakes(features = [], filter = {}, options = {}) {
  const { magMin = 0, days = 30, depth = 'all' } = filter;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const cutoff = now - days * 86400000;

  const within = features.filter((feature) => (
    featureMag(feature) >= magMin
      && featureTime(feature) >= cutoff
      && matchesDepthFilter(feature, depth)
  ));

  if (depth !== 'deep' || !Array.isArray(options.deepHistoryFeatures)) {
    return within;
  }

  const seen = new Set(within);
  for (const feature of options.deepHistoryFeatures) {
    if (seen.has(feature)) continue;
    if (featureMag(feature) < magMin) continue;
    if (!matchesDepthFilter(feature, 'deep')) continue;
    seen.add(feature);
    within.push(feature);
  }
  return within;
}

export function summarizeQuakes(features = []) {
  const depthCounts = {
    shallow: 0,
    intermediate: 0,
    deep: 0,
    unknown: 0,
  };

  let strongest = null;
  for (const feature of features) {
    depthCounts[classifyDepth(feature.geometry?.coordinates?.[2])] += 1;
    const mag = Number(feature.properties?.mag);
    const strongestMag = Number(strongest?.properties?.mag);
    if (Number.isFinite(mag) && (!strongest || mag > strongestMag)) {
      strongest = feature;
    }
  }

  return {
    count: features.length,
    depthCounts,
    strongest,
  };
}
