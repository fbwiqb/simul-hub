const DEPTH_KEY = `
  <div class="legend-row"><span class="depth-dot shallow"></span><span>천발 · 채운 점 (&lt; 70 km)</span></div>
  <div class="legend-row"><span class="depth-dot intermediate"></span><span>중발 · 굵은 테두리 (70-300 km)</span></div>
  <div class="legend-row"><span class="depth-dot deep"></span><span>심발 · 속 빈 원 (&gt; 300 km)</span></div>
`;

export function mountLegend(rootEl, plateHandle) {
  function render() {
    if (plateHandle.getMode?.() === 'subduction') {
      rootEl.innerHTML = `
        <div class="legend-title">심발 지진과 섭입형 경계</div>
        <div class="legend-row"><span class="legend-line convergent"></span><span>섭입형(수렴) 경계</span></div>
        ${DEPTH_KEY}
      `;
      return;
    }

    rootEl.innerHTML = `
      <div class="legend-title">판 경계 종류</div>
      <div class="legend-row"><span class="legend-line divergent"></span><span>발산형 경계</span></div>
      <div class="legend-row"><span class="legend-line convergent"></span><span>수렴형 경계</span></div>
      <div class="legend-row"><span class="legend-line transform"></span><span>보존형 경계</span></div>
      <div class="legend-row"><span class="legend-line default"></span><span>기타/미분류</span></div>
      ${DEPTH_KEY}
    `;
  }

  render();

  return {
    sync() {
      render();
      rootEl.style.display = plateHandle.isVisible() ? 'block' : 'none';
    },
  };
}
