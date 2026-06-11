(function (global) {
  var CNSA = {};
  var HUB_HREF = '/';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  CNSA.mountTopbar = function (opts) {
    opts = opts || {};
    if (document.querySelector('.cnsa-simbar')) return null;
    var title = opts.title;
    var unit = opts.unit;
    var meta = document.querySelector('meta[name="cnsa-sim"]');
    if ((!title || !unit) && meta) {
      var parts = (meta.getAttribute('content') || '').split('|');
      if (!title) title = parts[0];
      if (!unit) unit = parts[1];
    }
    title = (title || document.title || 'CNSA 시뮬레이션').trim();
    unit = (unit || '').trim();
    var homeLabel = opts.homeLabel || 'CNSA 시뮬레이션';
    var bar = document.createElement('div');
    bar.className = 'cnsa-simbar';
    bar.setAttribute('role', 'banner');
    bar.innerHTML =
      '<a class="cnsa-home cnsa-focusable" href="' + (opts.hubHref || HUB_HREF) + '" aria-label="' + esc(homeLabel) + ' 홈으로 이동">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>' +
      '<span>' + esc(homeLabel) + '</span></a>' +
      '<div class="cnsa-titlewrap"><span class="cnsa-title">' + esc(title) + '</span>' +
      (unit ? '<span class="cnsa-unit">' + esc(unit) + '</span>' : '') +
      '</div><div class="cnsa-spacer"></div><div class="cnsa-slot" id="cnsaSlot"></div>';
    document.body.insertBefore(bar, document.body.firstChild);
    if (opts.pad !== false) document.body.classList.add('cnsa-pad');
    if (!document.title || opts.setTitle) document.title = title + ' · CNSA 시뮬레이션';
    return bar;
  };

  CNSA.canvasPos = function (canvas, evt) {
    var r = canvas.getBoundingClientRect();
    var p = (evt.touches && evt.touches[0]) || (evt.changedTouches && evt.changedTouches[0]) || evt;
    return {
      x: (p.clientX - r.left) * (canvas.width / r.width),
      y: (p.clientY - r.top) * (canvas.height / r.height)
    };
  };

  CNSA.pointer = function (el, handlers) {
    handlers = handlers || {};
    var active = false;
    function down(e) {
      active = true;
      if (handlers.onDown) handlers.onDown(e);
      if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
    }
    function move(e) {
      if (handlers.onMove) handlers.onMove(e, active);
      if (active && e.type === 'touchmove' && e.cancelable) e.preventDefault();
    }
    function up(e) {
      if (!active) return;
      active = false;
      if (handlers.onUp) handlers.onUp(e);
    }
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    el.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return function () {
      el.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      el.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  };

  CNSA.srAnnounce = function (text) {
    var live = document.getElementById('cnsaLive');
    if (!live) {
      live = document.createElement('div');
      live.id = 'cnsaLive';
      live.className = 'cnsa-visually-hidden';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('role', 'status');
      document.body.appendChild(live);
    }
    live.textContent = '';
    global.setTimeout(function () { live.textContent = text; }, 40);
  };

  CNSA.trapFocus = function (el) {
    function sel() {
      return el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
    }
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var f = sel();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    el.addEventListener('keydown', onKey);
    var f = sel();
    if (f.length) f[0].focus();
    return function () { el.removeEventListener('keydown', onKey); };
  };

  global.CNSA = CNSA;
})(window);
