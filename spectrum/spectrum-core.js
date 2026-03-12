const ELEMENTS = {
  'H': [410.2, 434.0, 486.1, 656.3],
  'He': [447.1, 471.3, 492.2, 501.6, 587.6, 667.8, 706.5],
  'Ne': [540.1, 585.2, 614.3, 640.2, 650.7, 703.2],
  'Na': [498.3, 568.3, 568.8, 588.9, 589.6, 615.4, 616.1],
  'Hg': [404.7, 435.8, 546.1, 577.0, 579.1],
  'Li': [460.3, 497.2, 610.4, 670.8],
  'Kr': [427.4, 431.9, 436.3, 450.2, 557.0, 587.1, 760.2, 769.5],
  'Ca': [393.4, 396.8, 422.7, 445.5, 527.0, 612.2, 616.2, 643.9],
  'Fe': [404.6, 438.4, 466.8, 495.8, 516.7, 527.0, 532.8],
  'Ba': [455.4, 493.4, 553.5, 585.4, 611.1, 649.7, 659.5]
};

const ELEMENT_NAMES = {
  'H':'수소','He':'헬륨','Ne':'네온','Na':'나트륨',
  'Hg':'수은','Li':'리튬','Kr':'크립톤',
  'Ca':'칼슘','Fe':'철','Ba':'바륨'
};

const ALL_ELEMENTS = Object.keys(ELEMENTS);

function wavelengthToRgb(wavelength, gamma) {
  gamma = gamma || 0.8;
  let r = 0, g = 0, b = 0;
  if (wavelength < 380 || wavelength > 750) return 'rgb(0,0,0)';
  if (wavelength < 440) { r = -(wavelength - 440) / 60; b = 1; }
  else if (wavelength < 490) { g = (wavelength - 440) / 50; b = 1; }
  else if (wavelength < 510) { g = 1; b = -(wavelength - 510) / 20; }
  else if (wavelength < 580) { r = (wavelength - 510) / 70; g = 1; }
  else if (wavelength < 645) { r = 1; g = -(wavelength - 645) / 65; }
  else { r = 1; }
  let factor = 1.0;
  if (wavelength < 420) factor = 0.3 + 0.7 * (wavelength - 380) / 40;
  else if (wavelength > 645) factor = 0.3 + 0.7 * (750 - wavelength) / 105;
  return 'rgb(' + Math.round(Math.pow(r * factor, gamma) * 255) + ',' +
    Math.round(Math.pow(g * factor, gamma) * 255) + ',' +
    Math.round(Math.pow(b * factor, gamma) * 255) + ')';
}

function wlToPercent(wl) {
  return ((wl - 380) / 370) * 100;
}

function createSpectralLine(wl, cls) {
  const line = document.createElement('div');
  line.className = cls || 'spectral-line';
  line.style.backgroundColor = wavelengthToRgb(wl);
  line.style.left = wlToPercent(wl) + '%';
  const tip = document.createElement('span');
  tip.className = 'wl-tooltip';
  tip.textContent = wl + 'nm';
  line.appendChild(tip);
  return line;
}

function buildRefSpectrum(container) {
  container.innerHTML = '';
  const stops = [];
  for (let wl = 380; wl <= 750; wl += 5) {
    stops.push(wavelengthToRgb(wl) + ' ' + wlToPercent(wl) + '%');
  }
  container.style.background = 'linear-gradient(to right, ' + stops.join(', ') + ')';
}

function renderMiniSpectrum(element) {
  const container = document.createElement('div');
  container.className = 'mini-spectrum';
  ELEMENTS[element].forEach(function(wl) {
    if (wl >= 380 && wl <= 750) {
      const line = document.createElement('div');
      line.style.cssText = 'position:absolute;top:0;bottom:0;width:3px;left:' + wlToPercent(wl) + '%;background:' + wavelengthToRgb(wl);
      container.appendChild(line);
    }
  });
  return container;
}

function renderSpectrum(container, elements, mode) {
  container.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'spectrum-bar';

  if (mode === 'emission') {
    bar.style.background = '#000';
    elements.forEach(function(el) {
      ELEMENTS[el].forEach(function(wl) {
        if (wl >= 380 && wl <= 750) bar.appendChild(createSpectralLine(wl));
      });
    });
  } else {
    for (let wl = 380; wl <= 750; wl++) {
      const px = document.createElement('div');
      px.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;left:' + wlToPercent(wl) + '%;background:' + wavelengthToRgb(wl);
      bar.appendChild(px);
    }
    elements.forEach(function(el) {
      ELEMENTS[el].forEach(function(wl) {
        if (wl >= 380 && wl <= 750) {
          const line = document.createElement('div');
          line.style.cssText = 'position:absolute;top:0;bottom:0;width:2px;left:' + wlToPercent(wl) + '%;background:#000;z-index:1';
          const tip = document.createElement('span');
          tip.className = 'wl-tooltip';
          tip.textContent = wl + 'nm';
          line.appendChild(tip);
          bar.appendChild(line);
        }
      });
    });
  }

  container.appendChild(bar);
  const scale = document.createElement('div');
  scale.className = 'wavelength-scale';
  scale.innerHTML = '<span>380</span><span>500</span><span>600</span><span>750nm</span>';
  container.appendChild(scale);
  return bar;
}

function pickRandomElements(count) {
  const pool = ALL_ELEMENTS.slice();
  const result = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}
