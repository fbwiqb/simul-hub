import { createMap } from './map.js';
import { addPlateLayer, PLATE_TYPES } from './layers/plates.js';
import { addVolcanoLayer } from './layers/volcanoes.js';
import { addQuakeLayer } from './layers/quakes.js';
import { mountLegend } from './ui/legend.js';
import { mountFilter } from './ui/filter.js';
import { mountTimeline } from './ui/timeline.js';
import { mountExplorer, mountObservation } from './ui/explorer.js';

const lastUpdatedEl = document.getElementById('last-updated');
const sidebarEl = document.getElementById('sidebar');
const toastRoot = document.getElementById('toast-root');

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastRoot.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

function timestamp() {
  return new Date().toLocaleString('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function renderSidebar() {
  sidebarEl.innerHTML = `
    <div class="panel-section">
      <div class="panel-title">레이어</div>
      <label class="layer-toggle">
        <span><i class="layer-mark plate"></i>판 경계</span>
        <input id="toggle-plates" type="checkbox">
      </label>
      <div class="plate-types" id="plate-types" hidden>
        <label class="plate-type-toggle">
          <input type="checkbox" data-plate-type="divergent" checked>
          <i class="plate-swatch divergent"></i><span>발산형</span>
        </label>
        <label class="plate-type-toggle">
          <input type="checkbox" data-plate-type="convergent" checked>
          <i class="plate-swatch convergent"></i><span>수렴형</span>
        </label>
        <label class="plate-type-toggle">
          <input type="checkbox" data-plate-type="transform" checked>
          <i class="plate-swatch transform"></i><span>변환형</span>
        </label>
      </div>
      <label class="layer-toggle">
        <span><i class="layer-mark volcano"></i>활화산</span>
        <input id="toggle-volcanoes" type="checkbox" checked>
      </label>
      <div class="plate-types" id="volcano-types">
        <label class="plate-type-toggle">
          <input type="checkbox" data-volcano-category="recent">
          <i class="volcano-swatch recent"></i><span>1964년 이후 (빨강)</span>
        </label>
        <label class="plate-type-toggle">
          <input type="checkbox" data-volcano-category="modern">
          <i class="volcano-swatch modern"></i><span>1800-1963년 (주황)</span>
        </label>
        <label class="plate-type-toggle">
          <input type="checkbox" data-volcano-category="historical">
          <i class="volcano-swatch historical"></i><span>홀로세-1799년 (보라)</span>
        </label>
      </div>
      <label class="layer-toggle">
        <span><i class="layer-mark quake"></i>지진</span>
        <input id="toggle-quakes" type="checkbox" checked>
      </label>
    </div>
    <div id="filter-root"></div>
    <div id="explorer-root"></div>
    <div id="observation-root"></div>
    <div class="panel-section">
      <div class="panel-title">현재 표시</div>
      <div class="stat-grid">
        <div class="stat-box"><span class="stat-label">지진</span><span class="stat-value" id="quake-count">-</span></div>
        <div class="stat-box"><span class="stat-label">화산</span><span class="stat-value" id="volcano-count">-</span></div>
      </div>
    </div>
    <div class="panel-section map-key">
      <div class="panel-title">지도 읽는 법</div>
      <div><i class="depth-dot shallow"></i>천발 지진 &lt; 70 km</div>
      <div><i class="depth-dot intermediate"></i>중발 지진 70-300 km</div>
      <div><i class="depth-dot deep"></i>심발 지진 &gt; 300 km</div>
      <div><i class="mini-triangle recent"></i>1964년 이후 분화 (큰 삼각형)</div>
      <div><i class="mini-triangle modern"></i>1800-1963년 분화</div>
      <div><i class="mini-triangle historical"></i>홀로세-1799년 분화 기록</div>
    </div>
  `;
}

function setLastUpdated(quakes) {
  const detail = quakes && quakes.isVisible?.()
    ? ` · 지진 ${quakes.getVisibleCount().toLocaleString('ko-KR')}개 표시`
    : '';
  lastUpdatedEl.textContent = `마지막 갱신: ${timestamp()}${detail}`;
}

function updateStats(quakes, volcanoes, observation) {
  const quakeCount = document.getElementById('quake-count');
  const volcanoCount = document.getElementById('volcano-count');
  if (quakeCount) {
    quakeCount.textContent = quakes && quakes.isVisible?.()
      ? quakes.getVisibleCount().toLocaleString('ko-KR')
      : '-';
  }
  if (volcanoCount) {
    volcanoCount.textContent = volcanoes && volcanoes.isVisible?.()
      ? volcanoes.count().toLocaleString('ko-KR')
      : '-';
  }
  if (quakes && observation) observation.update(quakes.getSummary(), quakes.getFilter());
  setLastUpdated(quakes);
}

function readActivePlateTypes() {
  const checks = document.querySelectorAll('[data-plate-type]');
  const active = [];
  checks.forEach((el) => {
    if (el.checked) active.push(el.dataset.plateType);
  });
  return active;
}

function readActiveVolcanoCategories() {
  const checks = document.querySelectorAll('[data-volcano-category]');
  const active = [];
  checks.forEach((el) => {
    if (el.checked) active.push(el.dataset.volcanoCategory);
  });
  return active;
}

async function main() {
  renderSidebar();
  const map = createMap('map');
  let plates = null;
  let volcanoes = null;
  let quakes = null;
  let filterControl = null;
  let observationControl = null;

  const deepHistoryPromise = fetch('./public/deep-quakes-history.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((payload) => (payload && Array.isArray(payload.features) ? payload.features : []))
    .catch((error) => {
      console.warn('Deep history fetch failed:', error);
      return [];
    });

  const layerResults = await Promise.allSettled([
    addPlateLayer(map),
    addVolcanoLayer(map),
    addQuakeLayer(map),
  ]);

  if (layerResults[0].status === 'fulfilled') {
    plates = layerResults[0].value;
  } else {
    console.error(layerResults[0].reason);
    showToast('판 경계 데이터를 불러오지 못했어요.');
  }

  if (layerResults[1].status === 'fulfilled') {
    volcanoes = layerResults[1].value;
    volcanoes.setActiveCategories?.([]);
    if (document.getElementById('toggle-volcanoes').checked) volcanoes.show();
  } else {
    console.error(layerResults[1].reason);
    showToast('화산 데이터를 불러오지 못했어요.');
  }

  if (layerResults[2].status === 'fulfilled') {
    quakes = layerResults[2].value;
    if (document.getElementById('toggle-quakes').checked) quakes.show();
  } else {
    console.error(layerResults[2].reason);
    showToast('USGS 지진 데이터를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }

  const legend = plates ? mountLegend(document.getElementById('legend'), plates) : null;

  const platesTypesPanel = document.getElementById('plate-types');

  document.getElementById('toggle-plates').addEventListener('change', (event) => {
    plates?.toggle(event.target.checked);
    if (platesTypesPanel) {
      platesTypesPanel.hidden = !(event.target.checked && plates?.getMode?.() !== 'subduction');
    }
    legend?.sync();
  });

  document.querySelectorAll('[data-plate-type]').forEach((el) => {
    el.addEventListener('change', () => {
      const active = readActivePlateTypes();
      plates?.setActiveTypes?.(active);
      legend?.sync();
    });
  });

  const volcanoTypesPanel = document.getElementById('volcano-types');

  document.getElementById('toggle-volcanoes').addEventListener('change', (event) => {
    volcanoes?.toggle(event.target.checked);
    if (volcanoTypesPanel) volcanoTypesPanel.hidden = !event.target.checked;
    updateStats(quakes, volcanoes, observationControl);
  });

  document.querySelectorAll('[data-volcano-category]').forEach((el) => {
    el.addEventListener('change', () => {
      volcanoes?.setActiveCategories?.(readActiveVolcanoCategories());
      updateStats(quakes, volcanoes, observationControl);
    });
  });

  document.getElementById('toggle-quakes').addEventListener('change', (event) => {
    event.target.checked ? quakes?.show() : quakes?.hide();
    updateStats(quakes, volcanoes, observationControl);
  });

  deepHistoryPromise.then((features) => {
    if (quakes && features.length > 0) quakes.setDeepHistory(features);
  });

  if (quakes) {
    observationControl = mountObservation(document.getElementById('observation-root'));
    quakes.setOnUpdate(() => updateStats(quakes, volcanoes, observationControl));
    filterControl = mountFilter(document.getElementById('filter-root'), async (state) => {
      try {
        if (state.days > 7) await quakes.ensureMonth();
        quakes.setFilter(state);
      } catch (error) {
        console.error(error);
        showToast('30일 지진 데이터를 불러오지 못했어요.');
      }
    });
    quakes.setFilter(filterControl.getState());

    mountExplorer(document.getElementById('explorer-root'), {
      onPreset(preset) {
        if (!preset) return;
        if (preset.center) map.setView(preset.center, preset.zoom, { animate: true });
        else map.fitBounds(preset.bounds, { padding: [28, 28] });
        if (preset.showPlates) {
          const plateToggle = document.getElementById('toggle-plates');
          const typesPanel = document.getElementById('plate-types');
          plates?.show();
          if (plateToggle) plateToggle.checked = true;
          if (typesPanel) typesPanel.hidden = false;
          legend?.sync();
        }
      },
      onStrongest() {
        const focused = quakes.focusStrongest();
        if (!focused) showToast('현재 조건에 맞는 지진이 없어요.');
      },
      onPlateAssist() {
        const typesPanel = document.getElementById('plate-types');
        document.getElementById('toggle-plates').checked = true;
        plates?.show();
        if (typesPanel) typesPanel.hidden = false;
        legend?.sync();
      },
    });

    mountTimeline(document.getElementById('timeline-control'), quakes, {
      volcanoes,
      async prepareAnimation() {
        await quakes.ensureMonth();
        filterControl.setState({ days: 30 }, false);
        quakes.setFilter({ days: 30 }, false);
      },
      onError(error) {
        console.error(error);
        showToast('시간 애니메이션을 시작하지 못했어요.');
      },
    });
  }

  updateStats(quakes, volcanoes, observationControl);
}

main().catch((error) => {
  console.error(error);
  showToast('페이지를 초기화하지 못했어요.');
});
