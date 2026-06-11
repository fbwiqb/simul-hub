export const WORLD_OFFSETS = [-360, 0, 360];

function offsetPosition(position, offset) {
  if (!Array.isArray(position) || position.length < 2) return position;
  return [Number(position[0]) + offset, ...position.slice(1)];
}

function offsetCoordinates(coordinates, offset, depth) {
  if (depth === 0) return offsetPosition(coordinates, offset);
  return coordinates.map((item) => offsetCoordinates(item, offset, depth - 1));
}

export function offsetGeometry(geometry, offset) {
  if (!geometry || !geometry.type || !geometry.coordinates) return geometry;
  const depths = {
    Point: 0,
    MultiPoint: 1,
    LineString: 1,
    MultiLineString: 2,
    Polygon: 2,
    MultiPolygon: 3,
  };
  const depth = depths[geometry.type];
  if (depth === undefined) return geometry;
  return {
    ...geometry,
    coordinates: offsetCoordinates(geometry.coordinates, offset, depth),
  };
}

export function wrapFeature(feature, offset) {
  return {
    ...feature,
    id: feature.id ? `${feature.id}:${offset}` : undefined,
    properties: {
      ...(feature.properties || {}),
      wrapOffset: offset,
    },
    geometry: offsetGeometry(feature.geometry, offset),
  };
}

export function wrapFeatureCollection(data, offsets = WORLD_OFFSETS) {
  return {
    ...data,
    features: offsets.flatMap((offset) => data.features.map((feature) => wrapFeature(feature, offset))),
  };
}

export function closestWrappedLng(lng, centerLng, offsets = WORLD_OFFSETS) {
  return offsets
    .map((offset) => Number(lng) + offset)
    .reduce((best, value) => (
      Math.abs(value - centerLng) < Math.abs(best - centerLng) ? value : best
    ), Number(lng));
}

export function visibleWorldOffsets(bounds, offsets = WORLD_OFFSETS) {
  const west = bounds.getWest();
  const east = bounds.getEast();
  const visible = offsets.filter((offset) => east >= -180 + offset && west <= 180 + offset);
  return visible.length ? visible : [0];
}
