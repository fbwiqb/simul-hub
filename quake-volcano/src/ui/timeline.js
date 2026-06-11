const SPEED_PRESETS = [
  { id: 'slow', label: '느림', durationMs: 3000 },
  { id: 'normal', label: '보통', durationMs: 1400 },
  { id: 'fast', label: '빠름', durationMs: 600 },
];

export function mountTimeline(rootEl, quakeHandle, options = {}) {
  rootEl.innerHTML = `
    <div class="timeline-row">
      <button class="icon-button" id="timeline-play" type="button" aria-label="30일 시간 애니메이션 재생">▶</button>
      <div class="timeline-meta">
        <div class="timeline-label"><span>시간순 재생 (지진 30일 + 화산 시기순)</span><span id="timeline-percent">0%</span></div>
        <div class="progress-track"><div class="progress-bar" id="timeline-bar"></div></div>
        <div class="timeline-speed" role="group" aria-label="재생 속도">
          ${SPEED_PRESETS.map((preset) => `
            <button type="button" class="speed-button" data-speed="${preset.id}">${preset.label}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  rootEl.style.display = 'block';

  const button = rootEl.querySelector('#timeline-play');
  const percent = rootEl.querySelector('#timeline-percent');
  const bar = rootEl.querySelector('#timeline-bar');
  const speedButtons = rootEl.querySelectorAll('[data-speed]');
  let playing = false;
  let activeSpeed = 'normal';

  function setProgress(value) {
    const pct = Math.round(value * 100);
    percent.textContent = `${pct}%`;
    bar.style.width = `${pct}%`;
  }

  function setPlaying(nextPlaying) {
    playing = nextPlaying;
    button.dataset.playing = String(playing);
    button.textContent = playing ? '■' : '▶';
    button.setAttribute('aria-label', playing ? '시간 애니메이션 정지' : '시간 애니메이션 재생');
  }

  function syncSpeedButtons() {
    speedButtons.forEach((el) => {
      el.classList.toggle('active', el.dataset.speed === activeSpeed);
    });
  }

  function currentDuration() {
    return SPEED_PRESETS.find((preset) => preset.id === activeSpeed)?.durationMs ?? 1400;
  }

  function handleProgress(progress) {
    setProgress(progress);
    options.volcanoes?.setAnimationProgress(progress);
    if (progress >= 1) {
      options.volcanoes?.endAnimation();
      setPlaying(false);
    }
  }

  function startQuakePlayback() {
    options.volcanoes?.beginAnimation();
    quakeHandle.playAnimation(handleProgress, { durationMs: currentDuration() });
  }

  speedButtons.forEach((el) => {
    el.addEventListener('click', () => {
      activeSpeed = el.dataset.speed;
      syncSpeedButtons();
      if (playing) startQuakePlayback();
    });
  });

  syncSpeedButtons();

  button.addEventListener('click', async () => {
    if (playing) {
      quakeHandle.stopAnimation();
      options.volcanoes?.endAnimation();
      setPlaying(false);
      setProgress(0);
      return;
    }

    setPlaying(true);
    setProgress(0);
    button.disabled = true;
    try {
      await options.prepareAnimation?.();
      button.disabled = false;
      startQuakePlayback();
    } catch (error) {
      button.disabled = false;
      setPlaying(false);
      options.onError?.(error);
    }
  });
}
