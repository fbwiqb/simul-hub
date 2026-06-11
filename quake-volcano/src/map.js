export function createMap(containerId) {
  const map = L.map(containerId, {
    center: [8, 165],
    zoom: 2,
    minZoom: 2,
    maxZoom: 9,
    preferCanvas: true,
    worldCopyJump: true,
    zoomControl: false,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  return map;
}
