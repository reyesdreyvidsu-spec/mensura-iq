/* =========================================================================
   MENSURA — motor del test, puntuación e informe
   ========================================================================= */
(function () {
  'use strict';

  var DATA = window.MENSURA;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var KEY = 'mensura.progress.v1';

  var MODES = {
    quick: { id: 'quick', label: 'Rápido', perItem: 70, spans: 2, norm: { mean: 0.58, sd: 0.18 }, note: 'Baremo estándar' },
    full: { id: 'full', label: 'Completo', perItem: 55, spans: 4, norm: { mean: 0.48, sd: 0.17 }, note: 'Baremo principal' },
    extreme: { id: 'extreme', label: 'Extremo', perItem: 30, spans: 5, norm: { mean: 0.35, sd: 0.16 }, note: 'Baremo exigente' }
  };

  var DIFF_W = function (d) { return 0.55 + d * 0.17; };

  var state = {
    view: 'home',
    mode: 'full',
    items: [],
    answers: [],
    index: 0,
    selected: null,
    locked: false,
    startedAt: 0,
    itemStart: 0,
    deadline: 0,
    limit: 0,
    wordData: null,
    tickId: null,
    spanToken: 0,
    spanInput: '',
    result: null
  };

  /* ----------------------------- utilidades ----------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function fmtClock(ms) {
    var t = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtMin(ms) {
    var t = Math.round(ms / 1000);
    var m = Math.floor(t / 60), s = t % 60;
    return m + ' min ' + (s < 10 ? '0' : '') + s + ' s';
  }
  function normalCdf(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  function bandFor(iq) {
    if (iq >= 130) return 'Muy superior';
    if (iq >= 120) return 'Superior';
    if (iq >= 110) return 'Alto';
    if (iq >= 100) return 'Medio-alto';
    if (iq >= 90) return 'Medio';
    if (iq >= 80) return 'Medio-bajo';
    return 'Bajo';
  }
  function bandTone(iq) {
    if (iq >= 130) return '#4f46e5';
    if (iq >= 120) return '#6d28d9';
    if (iq >= 110) return '#0e7490';
    if (iq >= 100) return '#0f766e';
    if (iq >= 90) return '#b45309';
    return '#be123c';
  }
  function toast(msg, kind) {
    var root = $('#toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'all .3s';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 2600);
  }
  function shuffle(list, seed) {
    var a = list.slice();
    var rnd = mulberry32(seed);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  var domainMap = {};
  DATA.domains.forEach(function (d) { domainMap[d.id] = d; });

  /* ------------------------------- arte --------------------------------- */
  function rotatePoint(x, y, cx, cy, deg) {
    var a = deg * Math.PI / 180;
    var dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  }

  function orbitArt() {
    var rnd = mulberry32(90210);
    var W = 640, H = 620, cx = 320, cy = 306;
    var orbits = [
      { rx: 268, ry: 104, rot: -17 },
      { rx: 214, ry: 84, rot: 19 },
      { rx: 156, ry: 62, rot: -7 }
    ];
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="orbLine" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#4f46e5" stop-opacity=".0"/>' +
          '<stop offset=".45" stop-color="#4f46e5" stop-opacity=".55"/>' +
          '<stop offset="1" stop-color="#0ea5e9" stop-opacity=".0"/>' +
        '</linearGradient>' +
        '<radialGradient id="orbGlow"><stop offset="0" stop-color="#0ea5e9" stop-opacity=".5"/><stop offset="1" stop-color="#0ea5e9" stop-opacity="0"/></radialGradient>' +
      '</defs>';

    s += '<g class="orbit-spin">';
    orbits.forEach(function (o) {
      s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + o.rx + '" ry="' + o.ry + '" transform="rotate(' + o.rot + ' ' + cx + ' ' + cy + ')" ' +
        'fill="none" stroke="url(#orbLine)" stroke-width="1" stroke-dasharray="2 8"/>';
    });

    var nodes = [];
    orbits.forEach(function (o, oi) {
      var count = 13 - oi * 2;
      for (var i = 0; i < count; i++) {
        var t = (i / count) * Math.PI * 2 + oi * 0.6;
        var x = cx + Math.cos(t) * o.rx, y = cy + Math.sin(t) * o.ry;
        var p = rotatePoint(x, y, cx, cy, o.rot);
        nodes.push({ x: p[0] + (rnd() - 0.5) * 12, y: p[1] + (rnd() - 0.5) * 12, r: 1.2 + rnd() * 2.2, c: oi === 1 ? '#0ea5e9' : (rnd() > 0.78 ? '#b45309' : '#6366f1') });
      }
    });
    for (var k = 0; k < 14; k++) {
      var a = rnd() * Math.PI * 2, rad = 40 + rnd() * 250;
      nodes.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.8, r: 0.9 + rnd() * 1.4, c: rnd() > 0.7 ? '#0ea5e9' : '#4f46e5' });
    }

    var lines = '';
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110 && rnd() < 0.5) {
          lines += '<line x1="' + nodes[i].x.toFixed(1) + '" y1="' + nodes[i].y.toFixed(1) + '" x2="' + nodes[j].x.toFixed(1) + '" y2="' + nodes[j].y.toFixed(1) + '" stroke="#4f46e5" stroke-width=".7" opacity=".22"/>';
        }
      }
    }
    s += lines;
    nodes.forEach(function (n) {
      s += '<circle cx="' + n.x.toFixed(1) + '" cy="' + n.y.toFixed(1) + '" r="' + n.r.toFixed(1) + '" fill="' + n.c + '" opacity=".8"/>';
      if (n.r > 2.6) {
        s += '<circle cx="' + n.x.toFixed(1) + '" cy="' + n.y.toFixed(1) + '" r="9" fill="none" stroke="' + n.c + '" stroke-width=".6" opacity=".28"/>';
      }
    });
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="120" fill="url(#orbGlow)" opacity=".22"/>';
    s += '</g></svg>';
    return s;
  }

  function domainArt(id) {
    var s = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    if (id === 'matrices') {
      s += '<rect x="10" y="10" width="100" height="100" rx="6" fill="none" stroke="rgba(16,20,36,.12)"/>';
      for (var i = 1; i < 3; i++) {
        s += '<line x1="' + (10 + i * 33.3) + '" y1="10" x2="' + (10 + i * 33.3) + '" y2="110" stroke="rgba(16,20,36,.09)"/>';
        s += '<line x1="10" y1="' + (10 + i * 33.3) + '" x2="110" y2="' + (10 + i * 33.3) + '" stroke="rgba(16,20,36,.09)"/>';
      }
      s += '<circle cx="26" cy="26" r="9" fill="none" stroke="#4f46e5" stroke-width="2"/>';
      s += '<rect x="46" y="49" width="16" height="16" rx="2" fill="#0e7490" opacity=".85"/>';
      s += '<path d="M96 40l10 18H86z" fill="none" stroke="#b45309" stroke-width="2"/>';
      s += '<rect x="80" y="80" width="16" height="16" rx="2" fill="none" stroke="#4f46e5" stroke-width="2"/>';
      s += '<text x="93" y="98" font-size="16" font-weight="700" fill="#4f46e5" text-anchor="middle">?</text>';
    } else if (id === 'sequences') {
      s += '<path d="M10 92C30 92 28 30 48 30s20 48 40 48 22-56 22-56" fill="none" stroke="#0e7490" stroke-width="2" stroke-linecap="round" opacity=".8"/>';
      [[12, 90], [30, 58], [48, 32], [68, 56], [88, 70], [108, 24]].forEach(function (p, i) {
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === 5 ? 4 : 2.6) + '" fill="' + (i === 5 ? '#4f46e5' : '#0e7490') + '"/>';
      });
      s += '<text x="12" y="20" font-size="9" fill="rgba(16,20,36,.35)" font-family="ui-monospace,monospace">2 · 6 · 12 · 20 · ?</text>';
    } else if (id === 'logic') {
      s += '<circle cx="48" cy="48" r="28" fill="rgba(79,70,229,.09)" stroke="#4f46e5" stroke-width="1.5"/>';
      s += '<circle cx="72" cy="48" r="28" fill="rgba(14,116,144,.07)" stroke="#0e7490" stroke-width="1.5"/>';
      s += '<circle cx="60" cy="70" r="28" fill="rgba(180,83,9,.06)" stroke="#b45309" stroke-width="1.5"/>';
      s += '<path d="M60 43a16 16 0 0 1 0 22 16 16 0 0 1 0-22z" fill="rgba(16,20,36,.10)"/>';
    } else if (id === 'verbal') {
      s += '<text x="12" y="58" font-size="56" font-family="Georgia,serif" fill="#be123c" opacity=".28">“</text>';
      s += '<rect x="40" y="34" width="62" height="4" rx="2" fill="rgba(16,20,36,.22)"/>';
      s += '<rect x="40" y="46" width="48" height="4" rx="2" fill="rgba(16,20,36,.14)"/>';
      s += '<rect x="40" y="58" width="56" height="4" rx="2" fill="rgba(16,20,36,.10)"/>';
      s += '<text x="18" y="100" font-size="20" font-family="Georgia,serif" fill="#be123c" opacity=".5">A : B :: C : ?</text>';
    } else if (id === 'spatial') {
      var cx = 60, cy = 56, r = 26;
      s += '<g fill="none" stroke="#0f766e" stroke-width="1.4" opacity=".85">';
      s += '<path d="M' + cx + ' ' + (cy - r) + 'L' + (cx + r) + ' ' + (cy - r / 2) + 'L' + (cx + r) + ' ' + (cy + r / 2) + 'L' + cx + ' ' + (cy + r) + 'L' + (cx - r) + ' ' + (cy + r / 2) + 'L' + (cx - r) + ' ' + (cy - r / 2) + 'Z"/>';
      s += '<path d="M' + cx + ' ' + (cy - r) + 'v' + (r * 2) + 'M' + (cx - r) + ' ' + (cy - r / 2) + 'l' + r + ' ' + (r / 2) + 'l' + r + ' ' + (-r / 2) + '" stroke-width="1"/>';
      s += '</g>';
      s += '<path d="M88 88a20 20 0 1 0-3 10" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round"/>';
      s += '<path d="M84 82l5 6 7-3" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if (id === 'memory') {
      for (var r2 = 0; r2 < 4; r2++) {
        for (var c2 = 0; c2 < 4; c2++) {
          var on = (r2 === 0 && c2 === 1) || (r2 === 1 && c2 === 1) || (r2 === 2 && c2 === 2) || (r2 === 2 && c2 === 3) || (r2 === 3 && c2 === 3);
          s += '<circle cx="' + (24 + c2 * 24) + '" cy="' + (24 + r2 * 24) + '" r="' + (on ? 4.2 : 2) + '" fill="' + (on ? '#475569' : 'rgba(16,20,36,.15)') + '"/>';
        }
      }
      s += '<path d="M48 24L48 48L72 72L96 72" fill="none" stroke="#475569" stroke-width="1.2" opacity=".4" stroke-dasharray="2 3"/>';
    }
    return s + '</svg>';
  }

  function initArt() {
    var visual = document.querySelector('.hero-visual');
    if (visual && !visual.querySelector('.orbit-art')) {
      var orbit = document.createElement('div');
      orbit.className = 'orbit-art';
      orbit.innerHTML = orbitArt();
      visual.insertBefore(orbit, visual.firstChild);
    }
    document.querySelectorAll('.domain-card').forEach(function (card, i) {
      if (card.querySelector('.domain-art')) return;
      var d = DATA.domains[i];
      if (!d) return;
      var art = document.createElement('div');
      art.className = 'domain-art';
      art.innerHTML = domainArt(d.id);
      card.insertBefore(art, card.firstChild);
    });
  }

  /* ------------------------------- vistas ------------------------------- */
  function showView(name) {
    state.view = name;
    ['home', 'test', 'report'].forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (!el) return;
      el.hidden = v !== name;
      el.classList.toggle('is-active', v === name);
    });
    document.body.classList.toggle('is-testing', name === 'test');
    if (name !== 'test') { state.deadline = 0; }
    window.scrollTo(0, 0);
  }

  function goHome() {
    stopTick();
    showView('home');
    renderResumeBar();
  }

  /* ------------------------------ construcción -------------------------- */
  function cloneItem(it) {
    var c = {};
    Object.keys(it).forEach(function (k) { c[k] = it[k]; });
    if (it.options) c.options = it.options.map(function (o) { return { label: o.label, svg: o.svg }; });
    return c;
  }
  function shuffleInPlace(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function randomizeOptions(item) {
    if (!item.options || item.options.length < 2) return item;
    var right = item.options[item.correct];
    shuffleInPlace(item.options);
    item.correct = item.options.indexOf(right);
    return item;
  }

  function buildItems(mode, wordData) {
    var items = [];
    ['matrices', 'sequences', 'logic', 'verbal', 'spatial'].forEach(function (dom) {
      DATA.items[dom].forEach(function (it) {
        if (mode === 'quick') { if (it.quick === true) items.push(cloneItem(it)); }
        else if (mode === 'full') { if (!it.extremeOnly) items.push(cloneItem(it)); }
        else { items.push(cloneItem(it)); }
      });
    });
    // orden aleatorio con rampa de dificultad: se baraja dentro de cada nivel
    shuffleInPlace(items);
    items.sort(function (a, b) { return a.difficulty - b.difficulty; });
    var byDiff = {}, ordered = [];
    items.forEach(function (it) {
      if (!byDiff[it.difficulty]) byDiff[it.difficulty] = [];
      byDiff[it.difficulty].push(it);
    });
    Object.keys(byDiff).sort(function (a, b) { return a - b; }).forEach(function (k) {
      ordered = ordered.concat(shuffleInPlace(byDiff[k]));
    });
    items = ordered;
    items.forEach(randomizeOptions);

    items.push(makeWordItem(wordData));
    DATA.spans.slice(0, MODES[mode].spans).forEach(function (s, i) {
      items.push({
        id: s.id,
        domain: 'memory',
        difficulty: 3 + (i > 1 ? 1 : 0),
        kind: 'span',
        length: s.length,
        digits: s.digits,
        prompt: 'Memoriza la secuencia y escríbela en orden inverso.',
        correct: s.digits.slice().reverse().join(''),
        explanation: 'La secuencia era ' + s.digits.join(' ') + '. En orden inverso: ' + s.digits.slice().reverse().join(' ') + '.'
      });
    });
    return items;
  }

  function makeWordItem(wordData) {
    var opts = shuffle([wordData.word].concat(wordData.lures), seedFrom(wordData.word));
    return {
      id: 'mem-word',
      domain: 'memory',
      difficulty: 2,
      kind: 'text',
      prompt: 'Al comenzar el test memorizaste una palabra. ¿Cuál era?',
      options: opts.map(function (o) { return { label: o }; }),
      correct: opts.indexOf(wordData.word),
      explanation: 'La palabra era «' + wordData.word + '». El recuerdo demorado se suma al índice de memoria de trabajo.'
    };
  }

  function timeLimitFor(item) {
    if (item.kind === 'span') return 0;
    if (item.id === 'mem-word') return 30;
    return MODES[state.mode].perItem;
  }

  /* -------------------------------- inicio ------------------------------ */
  function startFlow(mode) {
    state.mode = MODES[mode] ? mode : 'full';
    showView('test');
    openIntro();
  }

  function openIntro() {
    var m = MODES[state.mode];
    var total = m.id === 'quick' ? 18 : (m.id === 'full' ? 42 : 49);
    var spans = m.spans;
    var root = $('#overlay-root');
    root.innerHTML =
      '<div class="overlay"><div class="overlay-card modal">' +
        '<span class="eyebrow" style="margin-bottom:14px"><i class="pulse-dot"></i> Modo ' + esc(m.label) + '</span>' +
        '<h2>Antes de empezar</h2>' +
        '<p>' + total + ' ítems, ' + spans + ' ensayos de memoria y una palabra que deberás recordar al final. Sin pausas y sin volver atrás.</p>' +
        '<ul class="intro-list">' +
          '<li><b>' + m.perItem + ' s</b> por ítem. Al agotarse el tiempo, la pregunta se marca como fallada.</li>' +
          '<li>Puedes responder con el ratón o con las teclas <b>1–8</b> y <b>Enter</b>.</li>' +
          '<li>Si sales o recargas la página, el intento se descarta y el test empieza de cero.</li>' +
        '</ul>' +
        '<div class="overlay-actions">' +
          '<button class="btn btn-outline" data-x="cancel">Cancelar</button>' +
          '<button class="btn btn-primary" data-x="go">Empezar</button>' +
        '</div>' +
      '</div></div>';
    root.querySelector('[data-x="cancel"]').addEventListener('click', function () {
      closeOverlay(); goHome();
    });
    root.querySelector('[data-x="go"]').addEventListener('click', function () {
      closeOverlay(); beginWordStage();
    });
  }

  function beginWordStage() {
    var pick = DATA.wordPool[Math.floor(Math.random() * DATA.wordPool.length)];
    state.wordData = { word: pick.word, lures: pick.lures.slice() };
    var left = 10;
    var root = $('#overlay-root');
    root.innerHTML =
      '<div class="overlay"><div class="overlay-card">' +
        '<span class="eyebrow" style="margin-bottom:14px"><i class="pulse-dot"></i> Memoria demorada</span>' +
        '<h2>Memoriza esta palabra</h2>' +
        '<p>Te la preguntaremos al final del test. No la apuntes.</p>' +
        '<div class="word-display">' + esc(state.wordData.word) + '</div>' +
        '<div class="overlay-actions"><button class="btn btn-primary" data-x="ok">Lo he memorizado</button></div>' +
        '<p class="overlay-count" id="word-count">Desaparece en ' + left + ' s</p>' +
      '</div></div>';
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      clearInterval(int);
      closeOverlay();
      beginRun();
    }
    root.querySelector('[data-x="ok"]').addEventListener('click', finish);
    var int = setInterval(function () {
      left--;
      var el = document.getElementById('word-count');
      if (el) el.textContent = 'Desaparece en ' + left + ' s';
      if (left <= 0) finish();
    }, 1000);
  }

  function beginRun() {
    state.items = buildItems(state.mode, state.wordData);
    state.answers = [];
    state.index = 0;
    state.selected = null;
    state.locked = false;
    state.startedAt = Date.now();
    state.result = null;
    saveProgress();
    showView('test');
    renderQuestion();
    startTick();
  }

  function resumeRun(saved) {
    state.mode = saved.mode;
    state.wordData = saved.word;
    var built = buildItems(saved.mode, saved.word);
    if (saved.ids && saved.ids.length === built.length) {
      var byId = {};
      built.forEach(function (it) { byId[it.id] = it; });
      var ordered = saved.ids.map(function (id) { return byId[id]; }).filter(Boolean);
      if (ordered.length === built.length) built = ordered;
    }
    state.items = built;
    state.answers = saved.answers || [];
    state.index = saved.index || 0;
    state.selected = null;
    state.locked = false;
    state.startedAt = saved.startedAt || Date.now();
    if (state.index >= state.items.length) { state.index = 0; state.answers = []; }
    showView('test');
    renderQuestion();
    startTick();
  }

  /* ------------------------------ persistencia -------------------------- */
  /* Sin guardado: si se sale o se recarga, el test vuelve a empezar. */
  function saveProgress() { /* intencionadamente vacío */ }
  function readProgress() { return null; }
  function clearProgress() {
    try { localStorage.removeItem(KEY); } catch (e) { }
  }

  function renderResumeBar() {
    var existing = $('.resume-bar');
    if (existing) existing.remove();
  }

  /* -------------------------------- reloj ------------------------------- */
  function startTick() {
    stopTick();
    state.tickId = setInterval(tick, 220);
    tick();
  }
  function stopTick() {
    if (state.tickId) { clearInterval(state.tickId); state.tickId = null; }
  }
  function tick() {
    if (state.view !== 'test') return;
    var el = Date.now() - state.startedAt;
    var chip = $('#elapsed-chip');
    if (chip) chip.textContent = fmtClock(el) + ' transcurrido';
    if (!state.deadline) return;
    var left = state.deadline - Date.now();
    var timer = $('#test-timer');
    var text = $('#timer-text');
    var fill = $('#timer-fill');
    var total = state.limit * 1000;
    var ratio = clamp(left / total, 0, 1);
    if (fill) fill.style.strokeDashoffset = (119.4 * (1 - ratio)).toFixed(1);
    if (text) text.textContent = Math.max(0, Math.ceil(left / 1000)) + 's';
    if (timer) timer.classList.toggle('is-low', left <= 10000);
    if (left <= 0 && !state.locked && state.deadline) {
      state.deadline = 0;
      commit(null, true);
    }
  }

  /* ------------------------------- pregunta ----------------------------- */
  function diffDots(d) {
    var s = '<span class="q-diff" aria-label="Dificultad ' + d + ' de 5">';
    for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= d ? 'on' : '') + '"></i>';
    s += '<span>' + d + '/5</span></span>';
    return s;
  }

  function seriesHTML(series) {
    if (!series) return '';
    var parts = series.split(',').map(function (v) { return v.trim(); });
    return '<div class="q-series">' + parts.map(function (p) {
      return '<span class="' + (p === '?' ? 'is-q' : '') + '">' + esc(p) + '</span>';
    }).join('') + '</div>';
  }

  function renderQuestion() {
    state.spanToken++;
    state.locked = false;
    state.selected = null;
    state.spanInput = '';
    var item = state.items[state.index];
    if (!item) return finishTest();

    if (item.kind === 'span') { renderSpan(item); return; }

    var domain = domainMap[item.domain] || { name: item.domain };
    var isSvg = item.kind === 'svg';
    var area = $('#question-area');
    var longOpts = !isSvg && item.options.some(function (o) { return (o.label || '').length > 46; });
    var opts = item.options.map(function (o, i) {
      var letter = String.fromCharCode(65 + i);
      if (isSvg) {
        return '<button class="option is-svg" data-i="' + i + '" aria-label="Opción ' + letter + '">' +
          '<span class="o-key">' + letter + '</span>' + o.svg + '</button>';
      }
      return '<button class="option" data-i="' + i + '" aria-label="Opción ' + letter + '">' +
        '<span class="o-key">' + letter + '</span><span class="o-label">' + esc(o.label) + '</span></button>';
    }).join('');

    area.innerHTML =
      '<div class="q-card">' +
        '<div class="q-head">' +
          '<span class="q-kicker">' + esc(domain.name) + ' · ítem ' + (state.index + 1) + '</span>' +
          diffDots(item.difficulty) +
        '</div>' +
        '<h2 class="q-prompt">' + esc(item.prompt) + '</h2>' +
        seriesHTML(item.series) +
        (item.stimulus ? '<div class="q-stimulus">' + item.stimulus + '</div>' : '') +
        '<div class="options ' + (isSvg ? 'is-svg' : 'is-text') + (longOpts ? ' is-long' : '') + '" role="group">' + opts + '</div>' +
      '</div>' +
      '<div class="q-actions">' +
        '<button class="btn btn-ghost" id="btn-skip">Saltar</button>' +
        '<div class="spacer"></div>' +
        '<span class="q-hint"><kbd>1</kbd>–<kbd>' + item.options.length + '</kbd> elegir · <kbd>Enter</kbd> continuar</span>' +
        '<button class="btn btn-primary" id="btn-next" disabled>Continuar</button>' +
      '</div>';

    $$('.option', area).forEach(function (el) {
      el.addEventListener('click', function () { choose(parseInt(el.dataset.i, 10)); });
    });
    $('#btn-next').addEventListener('click', function () { confirm(); });
    $('#btn-skip').addEventListener('click', function () {
      if (state.locked) return;
      commit(null, false);
    });

    var t = $('#test-timer');
    if (t) t.style.visibility = 'visible';
    startItemTimer(item);
    updateProgress();
    updateChips(item);
  }

  function updateChips(item) {
    var modeChip = $('#mode-chip');
    var diffChip = $('#diff-chip');
    var secName = $('#section-name');
    if (modeChip) modeChip.textContent = 'Modo ' + MODES[state.mode].label;
    if (diffChip) diffChip.textContent = 'Dificultad ' + item.difficulty + '/5';
    if (secName) secName.textContent = domainMap[item.domain] ? domainMap[item.domain].name : 'Test';
  }

  function choose(i) {
    if (state.locked) return;
    state.selected = i;
    $$('.option').forEach(function (el) {
      el.classList.toggle('is-selected', parseInt(el.dataset.i, 10) === i);
    });
    var next = $('#btn-next');
    if (next) next.disabled = false;
  }

  function confirm() {
    if (state.locked) return;
    if (state.selected == null) return;
    commit(state.selected, false);
  }

  function answerLabel(item, idx) {
    if (idx == null) return null;
    if (item.kind === 'span') return String(idx).split('').join(' ');
    var o = item.options && item.options[idx];
    return o ? (o.label || ('Opción ' + String.fromCharCode(65 + idx))) : null;
  }

  function commit(given, timedOut) {
    if (state.locked) return;
    state.locked = true;
    state.deadline = 0;
    var item = state.items[state.index];
    var ok = given != null && given === item.correct;
    var ans = {
      id: item.id,
      given: given,
      givenLabel: answerLabel(item, given),
      correctLabel: answerLabel(item, item.correct),
      ok: ok,
      timedOut: !!timedOut,
      skipped: given == null && !timedOut,
      timeMs: Date.now() - state.itemStart
    };
    state.answers.push(ans);
    saveProgress();
    updateProgress();
    if (timedOut) toast('Tiempo agotado: cuenta como fallo', 'warn');
    setTimeout(advance, timedOut ? 220 : 380);
  }

  function startItemTimer(item) {
    var limit = timeLimitFor(item);
    state.limit = limit;
    state.itemStart = Date.now();
    if (!limit) {
      state.deadline = 0;
      var t = $('#test-timer');
      if (t) t.style.visibility = 'hidden';
      return;
    }
    state.deadline = Date.now() + limit * 1000;
    var text = $('#timer-text');
    if (text) text.textContent = limit + 's';
    var fill = $('#timer-fill');
    if (fill) fill.style.strokeDashoffset = 0;
    var timer = $('#test-timer');
    if (timer) timer.classList.remove('is-low');
  }

  function updateProgress() {
    var total = state.items.length || 1;
    var pct = Math.min(100, (state.index / total) * 100);
    var fill = $('#progress-fill');
    if (fill) fill.style.width = pct + '%';
    var count = $('#q-count');
    if (count) count.textContent = (state.index + 1) + ' / ' + total;
  }

  function advance() {
    state.index++;
    state.locked = false;
    state.selected = null;
    if (state.index >= state.items.length) { finishTest(); return; }
    renderQuestion();
  }

  /* -------------------------------- memoria ----------------------------- */
  function renderSpan(item) {
    state.locked = true;
    state.deadline = 0;
    var token = ++state.spanToken;
    var t = $('#test-timer');
    if (t) t.style.visibility = 'hidden';
    var area = $('#question-area');
    var domain = domainMap[item.domain];
    area.innerHTML =
      '<div class="q-card">' +
        '<div class="q-head">' +
          '<span class="q-kicker">' + esc(domain.name) + ' · ensayo de ' + item.length + ' dígitos</span>' +
          diffDots(item.difficulty) +
        '</div>' +
        '<div class="span-stage" id="span-stage"></div>' +
      '</div>';
    state.itemStart = Date.now();
    updateProgress();
    updateChips(item);
    runSpanSequence(item, token);
  }

  async function runSpanSequence(item, token) {
    var stage = document.getElementById('span-stage');
    if (!stage) return;
    stage.innerHTML = '<p class="span-title">Prepárate</p><div class="span-digit">·</div>' +
      '<p class="span-sub">Memoriza los dígitos. Después deberás escribirlos en orden inverso.</p>';
    await wait(1500);
    if (token !== state.spanToken) return;

    for (var i = 0; i < item.digits.length; i++) {
      if (token !== state.spanToken) return;
      stage.innerHTML = '<p class="span-title">Memoriza</p><div class="span-digit">' + item.digits[i] + '</div>' +
        '<p class="span-sub">' + (i + 1) + ' / ' + item.digits.length + '</p>';
      await wait(760);
      if (token !== state.spanToken) return;
      stage.innerHTML = '<p class="span-title">Memoriza</p><div class="span-digit" style="opacity:.12">' + item.digits[i] + '</div>' +
        '<p class="span-sub">' + (i + 1) + ' / ' + item.digits.length + '</p>';
      await wait(190);
    }
    if (token !== state.spanToken) return;
    renderSpanInput(item, token, stage);
  }

  function renderSpanInput(item, token, stage) {
    state.spanInput = '';
    var boxes = '';
    for (var i = 0; i < item.length; i++) boxes += '<div class="span-box" data-b="' + i + '"></div>';
    var keys = '';
    for (var d = 1; d <= 9; d++) keys += '<button class="span-key" data-k="' + d + '">' + d + '</button>';
    keys += '<button class="span-key" data-k="0">0</button>';
    keys += '<button class="span-key is-wide" data-k="del">Borrar</button>';
    keys += '<button class="span-key is-primary" data-k="ok">Enviar</button>';
    stage.innerHTML =
      '<p class="span-title">Repite en orden inverso</p>' +
      '<div class="span-input">' + boxes + '</div>' +
      '<div class="span-keypad">' + keys + '</div>' +
      '<div class="span-feedback" id="span-feedback"></div>' +
      '<p class="span-sub">Escribe los ' + item.length + ' dígitos del último al primero.</p>';

    stage.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-k]');
      if (!btn || token !== state.spanToken || state.locked && state.spanInput === '__done') return;
      spanKey(btn.dataset.k, item);
    });
    state.locked = false;
    state.deadline = 0;
    updateSpanBoxes();
  }

  function spanKey(k, item) {
    if (state.spanInput === '__done') return;
    if (k === 'del') { state.spanInput = state.spanInput.slice(0, -1); }
    else if (k === 'ok') { submitSpan(item); return; }
    else if (/^\d$/.test(k) && state.spanInput.length < item.length) { state.spanInput += k; }
    updateSpanBoxes();
  }

  function updateSpanBoxes() {
    var val = state.spanInput === '__done' ? '' : state.spanInput;
    $$('.span-box').forEach(function (box, i) {
      box.textContent = val[i] || '';
      box.classList.toggle('is-filled', !!val[i]);
    });
  }

  function submitSpan(item) {
    if (state.locked || state.spanInput === '__done') return;
    if (state.spanInput.length !== item.length) {
      toast('Completa los ' + item.length + ' dígitos', 'warn');
      return;
    }
    state.locked = true;
    state.spanInput = '__done';
    var ok = state.spanInput === item.correct; // marcará falso; corregimos abajo
    var givenText = $$('.span-box').map(function (b) { return b.textContent; }).join('');
    ok = givenText === item.correct;
    state.answers.push({
      id: item.id, given: null, givenText: givenText, ok: ok, timedOut: false,
      givenLabel: givenText, correctLabel: item.correct.split('').join(' '),
      skipped: false, timeMs: Date.now() - state.itemStart
    });
    saveProgress();
    var fb = $('#span-feedback');
    if (fb) {
      fb.textContent = ok ? 'Correcto. Secuencia inversa perfecta.' : 'Incorrecto. La respuesta era ' + item.correct.split('').join(' ') + '.';
      fb.className = 'span-feedback ' + (ok ? 'ok' : 'no');
    }
    updateProgress();
    setTimeout(advance, 1450);
  }

  /* -------------------------------- salir ------------------------------- */
  function quitTest() {
    var root = $('#overlay-root');
    root.innerHTML =
      '<div class="overlay"><div class="overlay-card modal">' +
        '<h2>¿Salir del test?</h2>' +
        '<p>Si sales ahora perderás las respuestas de este intento. La próxima vez el test empezará desde el principio.</p>' +
        '<div class="overlay-actions">' +
          '<button class="btn btn-outline" data-x="stay">Seguir con el test</button>' +
          '<button class="btn btn-primary" data-x="leave">Salir y reiniciar</button>' +
        '</div>' +
      '</div></div>';
    root.querySelector('[data-x="stay"]').addEventListener('click', closeOverlay);
    root.querySelector('[data-x="leave"]').addEventListener('click', function () {
      closeOverlay();
      stopTick();
      clearProgress();
      state.items = [];
      state.answers = [];
      state.index = 0;
      showView('home');
    });
  }
  function closeOverlay() { $('#overlay-root').innerHTML = ''; }

  /* ----------------------------- metodología ---------------------------- */
  function openMethod() {
    var root = $('#overlay-root');
    root.innerHTML =
      '<div class="overlay"><div class="overlay-card is-wide method-modal">' +
        '<button class="method-x" data-x="close" aria-label="Cerrar">×</button>' +
        '<span class="eyebrow"><i class="pulse-dot"></i> Transparencia psicométrica</span>' +
        '<h2>Metodología</h2>' +
        '<p class="method-lead">Cómo se pasa de tus respuestas a un número, qué significa ese número y —igual de importante— qué no significa.</p>' +
        '<div class="method-body">' +
          '<h3>1 · La escala: CI de desviación</h3>' +
          '<p>El CI moderno no es una razón entre edad mental y cronológica: es una <b>puntuación de desviación</b> introducida por David Wechsler en 1939. Se define como <b>CI = 100 + 15·z</b>, donde <i>z</i> es la posición del sujeto medida en desviaciones típicas. Por construcción, la media es 100 y la desviación típica 15: aproximadamente dos tercios de la población quedan entre 85 y 115, y el 95 % entre 70 y 130 (APA, 2018).</p>' +

          '<h3>2 · El modelo: teoría de respuesta al ítem (3PL)</h3>' +
          '<p>Cada respuesta se modela con una curva logística de tres parámetros:</p>' +
          '<pre class="formula">P(acierto | θ) = c + (1 − c) / (1 + e<sup>−a·(θ − b)</sup>)</pre>' +
          '<p><b>a</b> es la discriminación del ítem, <b>b</b> su dificultad y <b>c</b> la probabilidad de acertar por azar (0,25 con cuatro alternativas; 0,125 con ocho). La habilidad <b>θ</b> se estima por <b>EAP</b> (media a posteriori esperada) con una distribución previa normal estándar, integrando la verosimilitud de todas tus respuestas. Después se aplica la transformación de desviación: <b>CI = 100 + 15·θ</b>.</p>' +
          '<p class="method-honest">Los parámetros <i>a</i>, <i>b</i> y <i>c</i> se asignan a priori a partir de la dificultad experta de cada ítem y de su formato. No proceden de una muestra normativa propia: eso exigiría miles de casos y un equipo de psicometría. Es la diferencia entre una estimación fundamentada y un baremo clínico.</p>' +

          '<h3>3 · La precisión: error típico e intervalo</h3>' +
          '<p>Ningún test mide sin error. La desviación posterior de θ proporciona el error típico de estimación, que se traduce a puntos de CI multiplicando por 15. El intervalo del 95 % es <b>θ ± 1,96 · SE(θ)</b>, y la fiabilidad estimada es <b>1 − SE²</b>. Por eso el informe muestra un intervalo y no solo una cifra: un CI de 127 con intervalo 118–136 significa que tu habilidad real probablemente está en esa banda, no exactamente en 127.</p>' +

          '<h3>4 · Límites de esta prueba</h3>' +
          '<ul>' +
            '<li><b>No es una evaluación clínica.</b> Un CI diagnóstico requiere administración individual, baremos por edad, control de condiciones y un profesional habilitado.</li>' +
            '<li><b>No hay baremo por edad ni muestra normativa propia.</b> La referencia es la distribución teórica N(100, 15); la dificultad de los ítems está calibrada por diseño, no empíricamente.</li>' +
            '<li><b>El entorno importa.</b> Fatiga, sueño, práctica previa, pantalla y prisa mueven la puntuación varios puntos.</li>' +
            '<li><b>Carga cultural y educativa.</b> El vocabulario y ciertos formatos favorecen a quienes han tenido más exposición a ese tipo de tareas.</li>' +
            '<li><b>No existe un test de CI «oficial de Harvard».</b> Las universidades investigan y enseñan psicometría —el curso 9.00 del MIT es un buen ejemplo—, pero los tests clínicos como el WAIS son propiedad de editoriales y se administran individualmente.</li>' +
          '</ul>' +

          '<h3>5 · Fuentes</h3>' +
          '<ul class="refs">' +
            '<li>American Psychological Association. (2018). <i>IQ</i>. APA Dictionary of Psychology. <a href="https://dictionary.apa.org/iq" target="_blank" rel="noopener">dictionary.apa.org/iq</a></li>' +
            '<li>MIT OpenCourseWare. (2011). <i>Intelligence</i> (9.00SC Introduction to Psychology). <a href="https://ocw.mit.edu/courses/9-00sc-introduction-to-psychology-fall-2011/pages/intelligence/" target="_blank" rel="noopener">ocw.mit.edu</a></li>' +
            '<li>OpenStax. (2020). <i>Psychology 2e</i>, §7.5 Measures of Intelligence. <a href="https://openstax.org/books/psychology-2e/pages/7-5-measures-of-intelligence" target="_blank" rel="noopener">openstax.org</a></li>' +
            '<li>AERA, APA &amp; NCME. (2014). <i>Standards for Educational and Psychological Testing</i>. <a href="https://www.apa.org/science/programs/testing/standards" target="_blank" rel="noopener">apa.org</a></li>' +
            '<li>Baker, F. B. (2001). <i>The Basics of Item Response Theory</i>. ERIC. <a href="https://eric.ed.gov/?id=ED458219" target="_blank" rel="noopener">eric.ed.gov</a></li>' +
            '<li>Wechsler, D. (1939). <i>The Measurement of Adult Intelligence</i>. Williams &amp; Wilkins.</li>' +
          '</ul>' +
        '</div>' +
        '<div class="overlay-actions"><button class="btn btn-primary" data-x="close">Entendido</button></div>' +
      '</div></div>';
    root.querySelectorAll('[data-x="close"]').forEach(function (btn) {
      btn.addEventListener('click', closeOverlay);
    });
    root.querySelector('.overlay').addEventListener('click', function (e) {
      if (e.target === this) closeOverlay();
    });
    var card = root.querySelector('.method-modal');
    card.scrollTop = 0;
  }

  /* ------------------------------ puntuación ---------------------------- */
  /* Modelo logístico de 3 parámetros (TRI):
     P(acierto | θ) = c + (1 - c) / (1 + e^(-a(θ - b)))
     a = discriminación, b = dificultad, c = acierto por azar.
     Los parámetros se calibran a priori a partir de la dificultad experta
     del ítem y del número de alternativas (no hay muestra normativa propia). */
  function itemParams(item) {
    var d = item.difficulty || 3;
    var nOpt = item.options && item.options.length ? item.options.length : 0;
    var c = item.kind === 'span' ? 0.03 : nOpt >= 8 ? 0.12 : nOpt === 4 ? 0.25 : 0.2;
    return { a: 0.95 + 0.13 * d, b: -1.25 + 0.86 * (d - 1), c: c };
  }
  function irf(theta, p) {
    return p.c + (1 - p.c) / (1 + Math.exp(-p.a * (theta - p.b)));
  }
  function estimateAbility(rows) {
    var step = 0.05, min = -4, n = 161;
    var logp = [], maxLp = -Infinity, i;
    for (i = 0; i < n; i++) {
      var t = min + i * step;
      var lp = -0.5 * t * t; // prior normal estándar
      for (var k = 0; k < rows.length; k++) {
        var p = clamp(irf(t, rows[k].params), 1e-6, 1 - 1e-6);
        lp += rows[k].ok ? Math.log(p) : Math.log(1 - p);
      }
      logp.push(lp);
      if (lp > maxLp) maxLp = lp;
    }
    var weights = [], wsum = 0;
    for (i = 0; i < n; i++) { var w = Math.exp(logp[i] - maxLp); weights.push(w); wsum += w; }
    var theta = 0;
    for (i = 0; i < n; i++) { theta += (min + i * step) * (weights[i] / wsum); }
    var variance = 0;
    for (i = 0; i < n; i++) { var d = (min + i * step) - theta; variance += (weights[i] / wsum) * d * d; }
    return { theta: theta, se: Math.sqrt(variance) };
  }

  function computeResult(items, answers, mode, durationMs) {
    var rows = items.map(function (it, i) {
      var a = answers[i] || { ok: false, given: null, timedOut: true, timeMs: 0 };
      return { item: it, ans: a, ok: !!a.ok, params: itemParams(it) };
    });
    var correct = rows.filter(function (r) { return r.ok; }).length;
    var timeouts = rows.filter(function (r) { return r.ans.timedOut; }).length;
    var timeSum = rows.reduce(function (s, r) { return s + (r.ans.timeMs || 0); }, 0);

    /* habilidad global (EAP) */
    var est = estimateAbility(rows);
    var theta = est.theta, se = est.se;
    var iq = clamp(Math.round(100 + 15 * theta), 55, 148);
    var ci = [
      clamp(Math.round(100 + 15 * (theta - 1.96 * se)), 55, 148),
      clamp(Math.round(100 + 15 * (theta + 1.96 * se)), 55, 148)
    ];
    var pct = normalCdf(theta);
    var reliability = clamp(1 - se * se, 0, 0.97);
    var semIq = 15 * se;

    /* habilidades por dominio (misma métrica, con mayor error por menos ítems) */
    var domains = DATA.domains.map(function (d) {
      var rs = rows.filter(function (r) { return r.item.domain === d.id; });
      var okCount = rs.filter(function (r) { return r.ok; }).length;
      var t = rs.reduce(function (s, r) { return s + (r.ans.timeMs || 0); }, 0);
      var dEst = rs.length ? estimateAbility(rs) : { theta: 0, se: 1 };
      var diq = clamp(Math.round(100 + 15 * dEst.theta), 55, 148);
      return {
        id: d.id, name: d.name, short: d.short, color: d.color,
        n: rs.length, correct: okCount,
        iq: diq, pct: normalCdf(dEst.theta),
        theta: dEst.theta, se: dEst.se,
        ci: [
          clamp(Math.round(100 + 15 * (dEst.theta - 1.96 * dEst.se)), 55, 148),
          clamp(Math.round(100 + 15 * (dEst.theta + 1.96 * dEst.se)), 55, 148)
        ],
        score: rs.length ? okCount / rs.length : 0,
        avgTime: rs.length ? t / rs.length : 0
      };
    });

    var half1 = rows.slice(0, Math.floor(rows.length / 2));
    var half2 = rows.slice(Math.floor(rows.length / 2));
    var s1 = half1.filter(function (r) { return r.ok; }).length / Math.max(1, half1.length);
    var s2 = half2.filter(function (r) { return r.ok; }).length / Math.max(1, half2.length);
    var consistency = Math.round(clamp(100 - Math.abs(s1 - s2) * 130, 35, 99));

    var m = MODES[mode];
    var limitMs = m.perItem * 1000;
    var avg = rows.length ? timeSum / rows.length : 0;
    var speedRatio = avg / limitMs;
    var speedLabel = speedRatio < 0.45 ? 'Muy rápido' : speedRatio < 0.66 ? 'Ágil' : speedRatio < 0.85 ? 'Pausado' : 'Al límite';

    return {
      mode: mode,
      modeLabel: m.label,
      date: new Date().toISOString(),
      durationMs: durationMs,
      iq: iq,
      percentile: pct,
      ci: ci,
      band: bandFor(iq),
      tone: bandTone(iq),
      theta: theta,
      se: se,
      reliability: reliability,
      semIq: semIq,
      domains: domains,
      rows: rows.map(function (r) { return { item: r.item, ans: r.ans }; }),
      stats: {
        total: rows.length,
        correct: correct,
        accuracy: rows.length ? correct / rows.length : 0,
        timeouts: timeouts,
        avgTime: avg,
        speedLabel: speedLabel,
        consistency: consistency,
        limitMs: limitMs
      },
      word: state.wordData ? state.wordData.word : null
    };
  }

  function finishTest() {
    stopTick();
    state.deadline = 0;
    var result = computeResult(state.items, state.answers, state.mode, Date.now() - state.startedAt);
    clearProgress();
    state.result = result;
    showView('report');
    renderReport(result);
  }

  /* -------------------------------- informe ----------------------------- */
  function ringSVG(iq) {
    var circ = 2 * Math.PI * 112;
    var pct = clamp((iq - 55) / 90, 0, 1);
    var offset = circ * (1 - pct);
    return '<svg viewBox="0 0 260 260" aria-hidden="true">' +
      '<defs><linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#4f46e5"/><stop offset=".55" stop-color="#6366f1"/><stop offset="1" stop-color="#0ea5e9"/>' +
      '</linearGradient></defs>' +
      '<circle cx="130" cy="130" r="112" class="ring-track" stroke-width="13"/>' +
      '<circle cx="130" cy="130" r="112" class="ring-inner"/>' +
      '<circle cx="130" cy="130" r="112" class="ring-value" stroke="url(#ringG)" stroke-width="13" ' +
        'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '"/>' +
      '</svg>';
  }

  function distributionSVG(iq) {
    var W = 680, H = 224, left = 26, right = W - 18, top = 16, base = H - 44;
    var X = function (v) { return left + (v - 55) / 90 * (right - left); };
    var pdf = function (v) { var d = (v - 100) / 15; return Math.exp(-0.5 * d * d) / (15 * Math.sqrt(2 * Math.PI)); };
    var max = pdf(100);
    var Y = function (v) { return base - (pdf(v) / max) * 120; };
    var pts = [], ptsL = [];
    for (var v = 55; v <= 145; v++) {
      pts.push(X(v).toFixed(1) + ',' + Y(v).toFixed(1));
      if (v <= iq) ptsL.push(X(v).toFixed(1) + ',' + Y(v).toFixed(1));
    }
    var line = 'M' + pts.join(' L');
    var area = line + ' L' + X(145).toFixed(1) + ',' + base + ' L' + X(55).toFixed(1) + ',' + base + ' Z';
    var shade = 'M' + X(55).toFixed(1) + ',' + base + ' L' + ptsL.join(' L') + ' L' + X(iq).toFixed(1) + ',' + base + ' Z';
    var mx = X(iq), my = Y(iq);

    var ticks = '';
    [70, 85, 100, 115, 130].forEach(function (t) {
      ticks += '<line x1="' + X(t).toFixed(1) + '" y1="' + (base + 5) + '" x2="' + X(t).toFixed(1) + '" y2="' + (base + 10) + '" stroke="rgba(16,20,36,.22)"/>';
      ticks += '<text x="' + X(t).toFixed(1) + '" y="' + (base + 26) + '" text-anchor="middle" font-size="10" fill="rgba(16,20,36,.56)" font-family="ui-monospace,monospace">' + t + '</text>';
    });

    return '<div class="dist"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Distribución normal con tu posición en ' + iq + '">' +
      '<defs>' +
        '<linearGradient id="distFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f46e5" stop-opacity=".22"/><stop offset="1" stop-color="#4f46e5" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="distShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0ea5e9" stop-opacity=".28"/><stop offset="1" stop-color="#0ea5e9" stop-opacity=".01"/></linearGradient>' +
      '</defs>' +
      ticks +
      '<path d="' + area + '" fill="url(#distFill)"/>' +
      '<path d="' + shade + '" fill="url(#distShade)"/>' +
      '<path d="' + line + '" fill="none" stroke="#6366f1" stroke-width="2" opacity=".85"/>' +
      '<line x1="' + mx.toFixed(1) + '" y1="' + my.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y2="' + base + '" stroke="#101425" stroke-width="1.4" stroke-dasharray="3 3" opacity=".55"/>' +
      '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="5" fill="#ffffff" stroke="#0ea5e9" stroke-width="2.5"/>' +
      '<text x="' + mx.toFixed(1) + '" y="' + (my - 14) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#101425" font-family="Inter,Segoe UI,sans-serif">Tú · ' + iq + '</text>' +
      '<line x1="' + X(100).toFixed(1) + '" y1="' + (base - 6) + '" x2="' + X(100).toFixed(1) + '" y2="' + base + '" stroke="rgba(16,20,36,.35)"/>' +
      '</svg>' +
      '<div class="dist-legend"><span><i style="background:#4f46e5"></i>Población de referencia (media 100, DE 15)</span>' +
      '<span><i style="background:#0ea5e9"></i>Porcentaje de personas por debajo de tu puntuación</span></div></div>';
  }

  function radarSVG(domains) {
    var size = 340, cx = 170, cy = 172, R = 112;
    var n = domains.length;
    var rings = '';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      rings += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * f) + '" fill="none" stroke="rgba(16,20,36,.08)" stroke-width="1"/>';
    });
    var axes = '', labels = '', points = [];
    domains.forEach(function (d, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="rgba(16,20,36,.08)"/>';
      var p = clamp(d.pct, 0.06, 1);
      var px = cx + Math.cos(a) * R * p, py = cy + Math.sin(a) * R * p;
      points.push(px.toFixed(1) + ',' + py.toFixed(1));
      var lx = cx + Math.cos(a) * (R + 24), ly = cy + Math.sin(a) * (R + 24);
      var anchor = Math.abs(Math.cos(a)) < 0.25 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      labels += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="' + anchor + '" font-size="9.5" fill="rgba(16,20,36,.72)" font-family="Inter,Segoe UI,sans-serif">' + esc(d.short) + '</text>';
      labels += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3" fill="' + d.color + '"/>';
    });
    return '<div class="radar-wrap"><svg viewBox="0 0 ' + size + ' ' + (size + 8) + '" role="img" aria-label="Perfil por dominio">' +
      rings + axes +
      '<polygon points="' + points.join(' ') + '" fill="rgba(79,70,229,.12)" stroke="#4f46e5" stroke-width="2" stroke-linejoin="round"/>' +
      labels +
      '<circle cx="' + cx + '" cy="' + cy + '" r="2.4" fill="rgba(16,20,36,.3)"/>' +
      '</svg></div>';
  }

  function narrative(r) {
    var top = r.domains.slice().sort(function (a, b) { return b.iq - a.iq; })[0];
    var low = r.domains.slice().sort(function (a, b) { return a.iq - b.iq; })[0];
    var base;
    if (r.iq >= 130) base = 'Un rendimiento que en la práctica solo alcanza una de cada cincuenta personas de la población de referencia.';
    else if (r.iq >= 120) base = 'Tu patrón de respuestas muestra precisión sostenida incluso en los ítems de mayor dificultad.';
    else if (r.iq >= 110) base = 'Tu rendimiento está por encima de la media, con un perfil sólido y margen claro de mejora en los dominios más exigentes.';
    else if (r.iq >= 100) base = 'Tu puntuación se sitúa en la media alta: resuelves con solvencia los ítems intermedios y pierdes tracción en los más abstractos.';
    else if (r.iq >= 90) base = 'Tu resultado está dentro del rango medio. La mayor parte de los errores se concentra en los ítems que combinan varias reglas a la vez.';
    else base = 'El resultado se sitúa por debajo de la media de referencia. Conviene interpretarlo con cautela: el tiempo limitado y el cansancio influyen mucho en una prueba de esta dureza.';
    var ceiling = r.stats.correct === r.stats.total ? 'Has resuelto todos los ítems: el test ha tocado su techo, así que tu puntuación real podría ser algo superior. ' : '';
    return ceiling + base + ' Tu punto fuerte es <b>' + esc(top.name.toLowerCase()) + '</b> (' + top.iq + '), y el área con más margen es <b>' + esc(low.name.toLowerCase()) + '</b> (' + low.iq + ').';
  }

  function optionLabel(item, idx) {
    if (idx == null || !item.options || !item.options[idx]) return 'Sin respuesta';
    var o = item.options[idx];
    return o.label ? o.label : ('Opción ' + String.fromCharCode(65 + idx));
  }

  function renderReport(r) {
    var pctText = r.percentile >= 0.99 ? '>99' : r.percentile <= 0.01 ? '<1' : String(Math.round(r.percentile * 100));
    var date = new Date(r.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    var top = r.domains.slice().sort(function (a, b) { return b.iq - a.iq; })[0];
    var low = r.domains.slice().sort(function (a, b) { return a.iq - b.iq; })[0];

    var domainBars = r.domains.map(function (d) {
      return '<div class="bar-row">' +
        '<span class="nm">' + esc(d.name) + '</span>' +
        '<div class="track"><div class="fill" style="--w:' + clamp((d.iq - 55) / 90 * 100, 3, 100) + '%;background:linear-gradient(90deg,' + d.color + 'aa,' + d.color + ')"></div></div>' +
        '<span class="val">' + d.iq + '<small>p' + (d.pct >= 0.99 ? '&gt;99' : Math.round(d.pct * 100)) + '</small></span>' +
      '</div>';
    }).join('');

    var review = DATA.domains.map(function (d) {
      var rs = r.rows.filter(function (x) { return x.item.domain === d.id; });
      if (!rs.length) return '';
      var okCount = rs.filter(function (x) { return x.ans.ok; }).length;
      var itemsHtml = rs.map(function (x, i) {
        var ans = x.ans;
        var yours = ans.givenLabel != null ? ans.givenLabel : (ans.givenText != null ? ans.givenText.split('').join(' ') : optionLabel(x.item, ans.given));
        var correct = ans.correctLabel != null ? ans.correctLabel : (x.item.kind === 'span' ? x.item.correct.split('').join(' ') : optionLabel(x.item, x.item.correct));
        var cls = ans.ok ? 'ok' : 'no';
        var mark = ans.ok ? '✓' : '✕';
        var prompt = x.item.prompt.length > 130 ? x.item.prompt.slice(0, 127) + '…' : x.item.prompt;
        return '<div class="review-item">' +
          '<div class="rq"><span class="mark ' + cls + '">' + mark + '</span><span class="qtxt">' + esc(prompt) + '</span></div>' +
          '<p class="ans">Tu respuesta: <b class="' + (ans.ok ? '' : 'bad') + '">' + esc(yours) + '</b>' +
            (ans.ok ? '' : ' · Correcta: <b>' + esc(correct) + '</b>') +
            (ans.timedOut ? ' · <span class="bad">tiempo agotado</span>' : '') +
          '</p>' +
          '<p class="exp">' + esc(x.item.explanation) + '</p>' +
        '</div>';
      }).join('');
      return '<section><details>' +
        '<summary><span class="rsum">' + esc(d.name) + ' <span class="cnt">' + okCount + '/' + rs.length + '</span></span><span class="chev">⌄</span></summary>' +
        '<div class="review-list">' + itemsHtml + '</div>' +
      '</details></section>';
    }).join('');

    var secondsAvg = Math.round(r.stats.avgTime / 1000);
    var html =
      '<div class="report">' +
        '<header class="report-head">' +
          '<div>' +
            '<span class="eyebrow"><i class="pulse-dot"></i> Informe cognitivo · ' + esc(r.modeLabel) + (r.demo ? ' · ejemplo' : '') + '</span>' +
            '<h1>Tu perfil intelectual</h1>' +
            '<p>' + esc(date) + ' · ' + fmtMin(r.durationMs) + ' · ' + r.stats.total + ' ítems</p>' +
          '</div>' +
          '<div class="report-actions">' +
            '<button class="btn btn-ghost btn-sm" id="btn-copy">Copiar resultado</button>' +
            '<button class="btn btn-outline btn-sm" id="btn-print">Descargar PDF</button>' +
            '<button class="btn btn-primary btn-sm" id="btn-repeat">Repetir test</button>' +
          '</div>' +
        '</header>' +

        '<section class="score-hero">' +
          '<div class="score-ring-wrap">' + ringSVG(r.iq) +
            '<div class="score-center">' +
              '<span class="big">' + r.iq + '</span>' +
              '<span class="lbl">CI estimado</span>' +
              '<span class="band" style="color:' + r.tone + '">' + esc(r.band) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="score-side">' +
            '<span class="band-pill" style="color:' + r.tone + ';border-color:' + r.tone + '55;background:' + r.tone + '18">Percentil ' + pctText + '</span>' +
            '<h2>Rendimiento ' + r.band.toLowerCase() + '</h2>' +
            '<p>' + (r.percentile >= 0.995 ? 'Formas parte del 1 % superior de la población de referencia. ' : 'Superas al ' + pctText + ' % de la población de referencia. ') + narrative(r) + '</p>' +
            '<div class="ci-pill">Intervalo de confianza al 95 %: <b>' + r.ci[0] + ' – ' + r.ci[1] + '</b></div>' +
            '<div class="score-stats">' +
              '<div class="score-stat"><strong>' + r.stats.correct + '/' + r.stats.total + '</strong><span>aciertos</span></div>' +
              '<div class="score-stat"><strong>' + secondsAvg + ' s</strong><span>media por ítem</span></div>' +
              '<div class="score-stat"><strong>' + Math.round(r.reliability * 100) + '%</strong><span>fiabilidad</span></div>' +
              '<div class="score-stat"><strong>' + r.stats.consistency + '%</strong><span>consistencia</span></div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="panel">' +
          '<div class="panel-head"><h3>Dónde te sitúas</h3><p>Distribución normal · media 100 · desviación 15</p></div>' +
          distributionSVG(r.iq) +
        '</section>' +

        '<div class="report-grid">' +
          '<section class="panel"><div class="panel-head"><h3>Perfil por dominio</h3><p>Percentil relativo</p></div>' + radarSVG(r.domains) + '</section>' +
          '<section class="panel"><div class="panel-head"><h3>Puntuación por dominio</h3><p>Escala CI · orientativo</p></div><div class="bars">' + domainBars + '</div></section>' +
        '</div>' +

        '<section class="panel">' +
          '<div class="panel-head"><h3>Lectura del resultado</h3><p>Qué dicen tus tiempos y tu patrón de aciertos</p></div>' +
          '<div class="insights">' +
            '<div class="insight"><span class="k">Fortaleza principal</span><span class="v"><b>' + esc(top.name) + '</b><br>CI ' + top.iq + ' · percentil ' + (top.pct >= 0.99 ? '&gt;99' : Math.round(top.pct * 100)) + '</span></div>' +
            '<div class="insight"><span class="k">Mayor margen</span><span class="v"><b>' + esc(low.name) + '</b><br>CI ' + low.iq + ' · ' + low.correct + ' de ' + low.n + ' aciertos</span></div>' +
            '<div class="insight"><span class="k">Estilo de respuesta</span><span class="v"><b>' + esc(r.stats.speedLabel) + '</b><br>' + (r.stats.timeouts ? r.stats.timeouts + ' ítem(s) agotaron el tiempo' : 'Sin tiempos agotados') + ' · consistencia ' + r.stats.consistency + '%</span></div>' +
          '</div>' +
        '</section>' +

        '<section class="panel">' +
          '<div class="panel-head"><h3>Cómo se ha calculado</h3><p>Modelo logístico de 3 parámetros (TRI) · estimación EAP</p></div>' +
          '<div class="method-grid">' +
            '<div class="method-stat"><span>Puntuación bruta</span><b>' + r.stats.correct + '/' + r.stats.total + '</b><small>aciertos</small></div>' +
            '<div class="method-stat"><span>Habilidad θ</span><b>' + (r.theta >= 0 ? '+' : '') + r.theta.toFixed(2) + '</b><small>escala logit</small></div>' +
            '<div class="method-stat"><span>Error típico</span><b>±' + r.se.toFixed(2) + '</b><small>≈ ' + Math.round(r.semIq) + ' puntos de CI</small></div>' +
            '<div class="method-stat"><span>Fiabilidad</span><b>' + r.reliability.toFixed(2) + '</b><small>1 − SE²</small></div>' +
          '</div>' +
          '<p class="method-note">Cada ítem aporta información según su discriminación y su dificultad, y el modelo descuenta el acierto por azar (25 % con cuatro alternativas, 12,5 % con ocho). El intervalo de confianza del 95 % no es un adorno: expresa cuánto puede moverse tu puntuación por el simple error de medida.</p>' +
          '<button class="btn btn-ghost btn-sm method-link" data-action="method">Ver metodología completa y fuentes →</button>' +
        '</section>' +

        '<section class="panel">' +
          '<div class="panel-head"><h3>Revisión de respuestas</h3><p>Tu respuesta frente a la correcta, con la regla explicada</p></div>' +
          '<div class="review">' + review + '</div>' +
        '</section>' +

        '<p class="disclaimer">Este informe es una estimación orientativa generada por una herramienta de autoconocimiento y entretenimiento. No constituye un diagnóstico ni sustituye una evaluación psicológica individual realizada por un profesional con baremos normativos. El resultado depende del estado de alerta, la motivación y la familiaridad con este tipo de tareas.</p>' +
      '</div>';

    var root = $('#report-root');
    root.innerHTML = html;
    updateProgress();

    $('#btn-print').addEventListener('click', function () { window.print(); });
    $('#btn-repeat').addEventListener('click', function () { startFlow(r.mode); });
    $('#btn-copy').addEventListener('click', function () {
      var text = 'MENSURA · Test cognitivo\nCI estimado: ' + r.iq + ' (' + r.band + ')\nPercentil: ' + pctText + '\nIC 95 %: ' + r.ci[0] + '–' + r.ci[1] + '\nModo: ' + r.modeLabel;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('Resultado copiado'); }, function () { toast('No se pudo copiar', 'warn'); });
      } else { toast('Copia manual: CI ' + r.iq + ' · percentil ' + pctText); }
    });
  }

  /* -------------------------------- demo -------------------------------- */
  function startDemo(silent) {
    var wordData = DATA.wordPool[1];
    state.wordData = wordData;
    var items = buildItems('full', wordData);
    var answers = items.map(function (it, i) {
      var ok = (i * 37 % 100) < 82;
      var given = null, givenText = null;
      if (it.kind === 'span') {
        givenText = ok ? it.correct : it.correct.split('').reverse().join('');
        ok = givenText === it.correct;
      } else {
        given = ok ? it.correct : (it.correct + 1) % it.options.length;
      }
      return { id: it.id, given: given, givenText: givenText, ok: ok, timedOut: false, skipped: false, timeMs: (16 + (i * 13 % 32)) * 1000 };
    });
    var result = computeResult(items, answers, 'full', 38 * 60 * 1000 + 12000);
    result.demo = true;
    state.result = result;
    showView('report');
    renderReport(result);
    if (!silent) toast('Informe de ejemplo: haz el test para obtener el tuyo');
  }

  /* ------------------------------- eventos ------------------------------ */
  function bind() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var action = el.dataset.action;
      if (action === 'start') {
        e.preventDefault();
        startFlow(el.dataset.mode || 'full');
      } else if (action === 'demo') {
        e.preventDefault();
        startDemo();
      } else if (action === 'home') {
        e.preventDefault();
        if (state.view === 'test') { quitTest(); } else { goHome(); }
      } else if (action === 'method') {
        e.preventDefault();
        openMethod();
      } else if (action === 'legal') {
        e.preventDefault();
        toast('Documento no incluido en esta versión de demostración.');
      }
    });

    var modeGrid = $('#mode-grid');
    if (modeGrid) {
      modeGrid.addEventListener('click', function (e) {
        var card = e.target.closest('.mode-card');
        if (!card || e.target.closest('button')) return;
        startFlow(card.dataset.mode);
      });
      modeGrid.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('.mode-card');
        if (!card) return;
        e.preventDefault();
        startFlow(card.dataset.mode);
      });
    }

    var quit = $('#btn-quit');
    if (quit) quit.addEventListener('click', quitTest);

    document.addEventListener('keydown', function (e) {
      if (state.view !== 'test') return;
      var item = state.items[state.index];
      if (!item) return;
      if (item.kind === 'span') {
        if (state.spanInput === '__done') return;
        if (/^\d$/.test(e.key)) { e.preventDefault(); spanKey(e.key, item); }
        else if (e.key === 'Backspace') { e.preventDefault(); spanKey('del', item); }
        else if (e.key === 'Enter') { e.preventDefault(); spanKey('ok', item); }
        return;
      }
      if (state.locked) return;
      if (/^[1-8]$/.test(e.key)) {
        var i = parseInt(e.key, 10) - 1;
        if (i < item.options.length) { e.preventDefault(); choose(i); }
      } else if (e.key === 'Enter' && state.selected != null) {
        e.preventDefault(); confirm();
      }
    });
  }

  /* -------------------------------- init -------------------------------- */
  function init() {
    clearProgress();
    initArt();
    bind();
    var query = window.location.search;
    if (!query && window.location.hash) query = '?' + window.location.hash.replace(/^#/, '');
    var params = new URLSearchParams(query);
    if (params.get('qa') || params.get('demo') === 'report') document.body.classList.add('no-anim');
    if (params.get('demo') === 'report') { startDemo(true); return; }
    var qa = params.get('qa');
    if (qa === 'intro') { startFlow('full'); return; }
    if (qa === 'method') { openMethod(); return; }
    if (qa === 'word') { state.mode = 'full'; showView('test'); beginWordStage(); return; }
    if (qa) {
      state.mode = 'full';
      state.wordData = DATA.wordPool[0];
      state.items = buildItems('full', state.wordData);
      state.answers = [];
      state.startedAt = Date.now();
      state.index = 0;
      if (qa === 'span') {
        state.index = state.items.findIndex(function (i) { return i.kind === 'span'; });
        if (state.index < 0) state.index = 0;
      } else if (qa === 'matrix') {
        state.index = state.items.findIndex(function (i) { return i.domain === 'matrices'; });
        if (state.index < 0) state.index = 0;
      }
      showView('test');
      renderQuestion();
      startTick();
      return;
    }
    renderResumeBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* API interna para verificación automática (no afecta a la interfaz) */
  window.MENSURA_DEBUG = {
    buildItems: buildItems,
    computeResult: computeResult,
    modeConfig: MODES,
    normalCdf: normalCdf
  };
})();
