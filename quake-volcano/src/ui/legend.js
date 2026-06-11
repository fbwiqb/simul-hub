export function mountLegend(rootEl, plateHandle) {
  function render() {
    if (plateHandle.getMode?.() === 'subduction') {
      rootEl.innerHTML = `
        <div class="legend-title">심발 지진과 섭입형 경계</div>
        <div class="legend-row"><span class="legend-line convergent"></span><span>섭입형 경계</span></div>
      `;
      return;
    }

    rootEl.innerHTML = `
      <div class="legend-title">판 경계 종류</div>
      <div class="legend-row"><span class="legend-line divergent"></span><span>발산형 경계</span></div>
      <div class="legend-row"><span class="legend-line convergent"></span><span>수렴형 경계</span></div>
      <div class="legend-row"><span class="legend-line transform"></span><span>보존형 경계</span></div>
      <div class="legend-row"><span class="legend-line default"></span><span>기타/미분류</span></div>
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
