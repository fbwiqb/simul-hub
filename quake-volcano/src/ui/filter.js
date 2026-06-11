function daysLabel(days) {
  if (days === 0) return '표시 안 함';
  if (days === 1) return '최근 24시간';
  return `최근 ${days}일`;
}

export function mountFilter(rootEl, onChange) {
  let state = { magMin: 0, days: 0, depth: 'all' };

  rootEl.innerHTML = `
    <div class="panel-section">
      <div class="panel-title">지진 필터</div>
      <div class="range-group">
        <div class="range-head"><span>최소 규모</span><span class="range-value" id="mag-value">M0.0+</span></div>
        <input class="range-input" id="mag-range" type="range" min="0" max="7" step="0.5" value="0" aria-label="최소 지진 규모">
        <div class="range-scale"><span>M0</span><span>M3.5</span><span>M7+</span></div>
      </div>
      <div class="range-group">
        <div class="range-head"><span>기간</span><span class="range-value" id="days-value">표시 안 함</span></div>
        <input class="range-input" id="days-range" type="range" min="0" max="30" step="1" value="0" aria-label="지진 표시 기간">
        <div class="range-scale"><span>0</span><span>15일</span><span>30일</span></div>
      </div>
      <div class="range-group">
        <div class="range-head"><span>깊이</span><span class="range-value" id="depth-value">전체</span></div>
        <div class="segmented" id="depth-filter" role="group" aria-label="지진 깊이 필터">
          <button type="button" data-depth-filter="all">전체</button>
          <button type="button" data-depth-filter="shallow">천발</button>
          <button type="button" data-depth-filter="intermediate">중발</button>
          <button type="button" data-depth-filter="deep">심발</button>
        </div>
      </div>
    </div>
  `;

  const magRange = rootEl.querySelector('#mag-range');
  const daysRange = rootEl.querySelector('#days-range');
  const magValue = rootEl.querySelector('#mag-value');
  const daysValue = rootEl.querySelector('#days-value');
  const depthValue = rootEl.querySelector('#depth-value');
  const depthButtons = rootEl.querySelectorAll('[data-depth-filter]');
  const depthLabels = {
    all: '전체',
    shallow: '천발',
    intermediate: '중발',
    deep: '심발',
  };

  function render() {
    magRange.value = String(state.magMin);
    daysRange.value = String(state.days);
    magValue.textContent = `M${state.magMin.toFixed(1)}+`;
    daysValue.textContent = daysLabel(state.days);
    depthValue.textContent = depthLabels[state.depth];
    depthButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.depthFilter === state.depth);
    });
  }

  function emit() {
    render();
    onChange({ ...state });
  }

  magRange.addEventListener('input', () => {
    state.magMin = Number(magRange.value);
    emit();
  });

  daysRange.addEventListener('input', () => {
    state.days = Number(daysRange.value);
    emit();
  });

  depthButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.depth = button.dataset.depthFilter;
      emit();
    });
  });

  render();

  return {
    setState(nextState, shouldEmit = true) {
      state = { ...state, ...nextState };
      render();
      if (shouldEmit) onChange({ ...state });
    },
    getState() {
      return { ...state };
    },
  };
}
