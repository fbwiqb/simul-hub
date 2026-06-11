export const EXPLORER_PRESETS = [
  {
    id: 'world',
    label: '세계 전체',
    hint: '전체 분포를 다시 봅니다.',
    bounds: [[-62, -180], [76, 180]],
  },
  {
    id: 'ring-of-fire',
    label: '환태평양',
    hint: '가장 빽빽한 고리 모양을 찾습니다.',
    bounds: [[-58, 105], [66, -68]],
    center: [18, 165],
    zoom: 3,
    showPlates: true,
  },
  {
    id: 'mid-atlantic',
    label: '대서양 해령',
    hint: '바다 한가운데 길게 이어진 선을 봅니다.',
    bounds: [[-55, -45], [66, 8]],
    center: [7, -29],
    zoom: 4,
    showPlates: true,
  },
  {
    id: 'east-africa',
    label: '동아프리카',
    hint: '대륙 안쪽의 갈라지는 흔적을 봅니다.',
    bounds: [[-36, 18], [16, 54]],
    showPlates: true,
  },
  {
    id: 'alpine-himalaya',
    label: '지중해-히말라야',
    hint: '대륙 충돌대의 지진 띠를 봅니다.',
    bounds: [[-2, -12], [46, 104]],
    showPlates: true,
  },
];

export function buildObservation(summary, filter) {
  if (!summary || summary.count === 0) {
    return '조건을 조금 낮추면 지진 띠가 다시 나타납니다. 규모나 기간을 완화해 보세요.';
  }

  if (filter.depth === 'deep') {
    return '깊은 지진(심발)은 아무 곳에나 퍼지기보다 수렴형 경계 근처에 줄지어 나타나는지 확인해 보세요.';
  }

  if (filter.depth === 'shallow') {
    return '얕은 지진(천발)은 해령, 변환 단층, 섭입대 모두에서 넓게 보입니다. 판 경계를 켜고 겹쳐 보세요.';
  }

  if (filter.magMin >= 4.5) {
    return '큰 지진만 남기면 점의 수는 줄지만 판 경계 주변의 띠 모양은 여전히 남는지 살펴보세요.';
  }

  const mag = Number(summary.strongest?.properties?.mag);
  if (Number.isFinite(mag) && mag >= 6) {
    return `가장 큰 지진은 M${mag.toFixed(1)}입니다. 주변 화산과 판 경계가 함께 몰려 있는지 클릭해 확인해 보세요.`;
  }

  return '지진과 화산이 판 경계 가까이에 몰리는지, 판 경계를 켜고 지도 전체를 훑어보세요.';
}

export function mountExplorer(rootEl, actions) {
  rootEl.innerHTML = `
    <div class="panel-section">
      <div class="panel-title">탐험 프리셋</div>
      <div class="preset-grid">
        ${EXPLORER_PRESETS.map((preset) => `
          <button class="preset-button" type="button" data-preset="${preset.id}">
            <span>${preset.label}</span>
            <small>${preset.hint}</small>
          </button>
        `).join('')}
      </div>
      <button class="action-button" type="button" id="show-strongest">가장 큰 지진으로 이동</button>
      <button class="action-button secondary" type="button" id="plate-assist">판 경계와 함께 보기</button>
    </div>
  `;

  rootEl.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = EXPLORER_PRESETS.find((item) => item.id === button.dataset.preset);
      actions.onPreset?.(preset);
    });
  });

  rootEl.querySelector('#show-strongest').addEventListener('click', () => actions.onStrongest?.());
  rootEl.querySelector('#plate-assist').addEventListener('click', () => actions.onPlateAssist?.());
}

export function mountObservation(rootEl) {
  rootEl.innerHTML = `
    <div class="panel-section">
      <div class="panel-title">관찰 미션</div>
      <div class="mission-card">
        <div id="mission-text">데이터를 불러오고 있어요.</div>
        <div class="depth-mini" id="depth-mini"></div>
      </div>
    </div>
  `;

  const missionText = rootEl.querySelector('#mission-text');
  const depthMini = rootEl.querySelector('#depth-mini');

  return {
    update(summary, filter) {
      missionText.textContent = buildObservation(summary, filter);
      depthMini.innerHTML = `
        <span><i class="depth-dot shallow"></i>천발 ${summary?.depthCounts.shallow ?? 0}</span>
        <span><i class="depth-dot intermediate"></i>중발 ${summary?.depthCounts.intermediate ?? 0}</span>
        <span><i class="depth-dot deep"></i>심발 ${summary?.depthCounts.deep ?? 0}</span>
      `;
    },
  };
}
