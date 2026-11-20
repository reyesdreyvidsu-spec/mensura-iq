/* =========================================================================
   MENSURA — banco de ítems
   Todo se genera de forma determinista: mismos ítems en cada carga.
   Cada ítem incluye: estímulo, opciones, índice correcto y explicación.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------- utilidades ----------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function rgba(hex, alpha) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  var C = {
    line: '#1f2937',
    violet: '#4f46e5',
    cyan: '#0e7490',
    amber: '#b45309',
    dim: 'rgba(16,20,36,.45)'
  };

  var FILLS = ['solid', 'hollow', 'soft'];
  var OUTER_SHAPES = ['circle', 'square', 'triangle'];
  var OUTER_SHAPES_B = ['square', 'triangle', 'circle'];
  var INNER_SHAPES = ['diamond', 'hex', 'circle'];

  /* -------------------------------- SVG -------------------------------- */
  function svgWrap(inner, viewBox) {
    return '<svg viewBox="' + (viewBox || '0 0 300 300') + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' + inner + '</svg>';
  }

  function shapeMarkup(kind, cx, cy, r, fillStyle, color) {
    var c = color || C.violet;
    var fill = 'none', stroke = c, sw = 2.6;
    if (fillStyle === 'solid') { fill = c; stroke = 'none'; sw = 0; }
    else if (fillStyle === 'soft') { fill = rgba(c, 0.28); }
    var common = 'fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round"';
    if (kind === 'circle') {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' + common + '/>';
    }
    if (kind === 'square') {
      return '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + (2 * r) + '" height="' + (2 * r) + '" rx="2.5" ' + common + '/>';
    }
    if (kind === 'triangle') {
      return '<path d="M ' + cx + ' ' + (cy - r) + ' L ' + (cx + r) + ' ' + (cy + r * 0.8) + ' L ' + (cx - r) + ' ' + (cy + r * 0.8) + ' Z" ' + common + '/>';
    }
    if (kind === 'diamond') {
      return '<path d="M ' + cx + ' ' + (cy - r) + ' L ' + (cx + r) + ' ' + cy + ' L ' + cx + ' ' + (cy + r) + ' L ' + (cx - r) + ' ' + cy + ' Z" ' + common + '/>';
    }
    if (kind === 'hex') {
      var pts = [];
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 180 * (60 * k - 90);
        pts.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
      }
      return '<polygon points="' + pts.join(' ') + '" ' + common + '/>';
    }
    return '';
  }

  function latinMarkup(cell) {
    var out = '';
    if (cell.inner) {
      out += shapeMarkup(cell.shape, 50, 50, 29, cell.fill);
      out += shapeMarkup(cell.inner, 50, 50, 10.5, 'solid', C.cyan);
    } else {
      out += shapeMarkup(cell.shape, 33, 50, 24, cell.fill);
      var ys = [29, 50, 71];
      for (var k = 0; k < cell.dots; k++) {
        out += '<circle cx="73" cy="' + ys[k] + '" r="4.2" fill="' + C.violet + '"/>';
      }
    }
    return out;
  }

  function spokesMarkup(spokes) {
    var n = spokes.length, out = '';
    out += '<circle cx="50" cy="50" r="43" fill="none" stroke="rgba(16,20,36,.10)" stroke-width="1" stroke-dasharray="2 4"/>';
    for (var k = 0; k < n; k++) {
      if (!spokes[k]) continue;
      var a = (k * 360 / n - 90) * Math.PI / 180;
      var x1 = 50 + Math.cos(a) * 9, y1 = 50 + Math.sin(a) * 9;
      var x2 = 50 + Math.cos(a) * 39, y2 = 50 + Math.sin(a) * 39;
      out += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + C.violet + '" stroke-width="6" stroke-linecap="round"/>';
    }
    out += '<circle cx="50" cy="50" r="4.5" fill="' + C.line + '"/>';
    return out;
  }

  function rotMarkup(cell) {
    var color = cell.tone ? C.cyan : C.violet;
    return '<g transform="translate(50,50) rotate(' + cell.angle + ') scale(' + (cell.mirror ? -1 : 1) + ',1)">' +
      '<path d="M0 -32 L20 6 L7 6 L7 30 L-7 30 L-7 6 L-20 6 Z" fill="' + color + '" opacity=".95"/>' +
      '<circle cx="0" cy="-17" r="4" fill="#ffffff"/>' +
      '<rect x="-22" y="18" width="9" height="9" rx="2" fill="#101425" opacity=".85"/>' +
      '</g>';
  }

  function renderCell(cell) {
    if (!cell) return '';
    if (cell.t === 'latin') return latinMarkup(cell);
    if (cell.t === 'spokes') return spokesMarkup(cell.spokes);
    if (cell.t === 'rot') return rotMarkup(cell);
    return '';
  }

  function cellKey(c) {
    return [c.t, c.shape || '', c.inner || '', c.fill || '', c.dots || 0,
      c.angle || 0, c.mirror ? 1 : 0, c.tone ? 1 : 0, c.spokes ? c.spokes.join('') : ''].join('|');
  }

  function matrixSVG(cells, missing) {
    var s = '<rect x="1.5" y="1.5" width="297" height="297" rx="18" fill="#ffffff" stroke="rgba(16,20,36,.16)" stroke-width="1.4"/>';
    for (var k = 1; k < 3; k++) {
      s += '<line x1="' + (k * 100) + '" y1="6" x2="' + (k * 100) + '" y2="294" stroke="rgba(16,20,36,.10)" stroke-width="1"/>';
      s += '<line x1="6" y1="' + (k * 100) + '" x2="294" y2="' + (k * 100) + '" stroke="rgba(16,20,36,.10)" stroke-width="1"/>';
    }
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        var idx = i * 3 + j;
        var g = '<g transform="translate(' + (j * 100) + ',' + (i * 100) + ')">';
        if (idx === missing) {
          g += '<rect x="9" y="9" width="82" height="82" rx="12" fill="rgba(79,70,229,.05)" stroke="rgba(79,70,229,.55)" stroke-width="1.5" stroke-dasharray="6 5"/>' +
            '<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="34" font-weight="700" fill="#4f46e5" font-family="Inter,Segoe UI,sans-serif">?</text>';
        } else {
          g += renderCell(cells[idx]);
        }
        g += '</g>';
        s += g;
      }
    }
    return svgWrap(s, '0 0 300 300');
  }

  function buildSvgOptions(correct, distractors, rnd, viewBox) {
    var seen = {}, list = [];
    [correct].concat(distractors).forEach(function (c) {
      var k = cellKey(c);
      if (!seen[k]) { seen[k] = true; list.push(c); }
    });
    var order = shuffle(list, rnd);
    var options = order.map(function (c) { return { svg: svgWrap(renderCell(c), viewBox || '0 0 100 100') }; });
    var ci = -1;
    for (var i = 0; i < order.length; i++) { if (cellKey(order[i]) === cellKey(correct)) { ci = i; break; } }
    return { options: options, correct: ci };
  }

  /* --------------------------- matrices: latinas ------------------------ */
  function latinA(seed, diff, quick) {
    var rnd = mulberry32(seed);
    var shapes = shuffle(OUTER_SHAPES, rnd);
    var fillShift = Math.floor(rnd() * 3);
    var cells = [];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        cells.push({
          t: 'latin',
          shape: shapes[(i + j) % 3],
          fill: FILLS[(i + 2 * j + fillShift) % 3],
          dots: 1 + ((2 * i + j) % 3)
        });
      }
    }
    var correct = cells[8];
    var ci = shapes.indexOf(correct.shape);
    var fi = FILLS.indexOf(correct.fill);
    var dis = [], seen = {};
    seen[cellKey(correct)] = true;
    function add(c) { var k = cellKey(c); if (!seen[k]) { seen[k] = true; dis.push(c); } }
    add({ t: 'latin', shape: shapes[(ci + 1) % 3], fill: correct.fill, dots: correct.dots });
    add({ t: 'latin', shape: shapes[(ci + 2) % 3], fill: correct.fill, dots: correct.dots });
    add({ t: 'latin', shape: correct.shape, fill: FILLS[(fi + 1) % 3], dots: correct.dots });
    add({ t: 'latin', shape: correct.shape, fill: FILLS[(fi + 2) % 3], dots: correct.dots });
    add({ t: 'latin', shape: correct.shape, fill: correct.fill, dots: correct.dots % 3 + 1 });
    add({ t: 'latin', shape: correct.shape, fill: correct.fill, dots: (correct.dots + 1) % 3 + 1 });
    var guard = 0;
    while (dis.length < 7 && guard++ < 120) {
      add({ t: 'latin', shape: shapes[Math.floor(rnd() * 3)], fill: FILLS[Math.floor(rnd() * 3)], dots: 1 + Math.floor(rnd() * 3) });
    }
    var built = buildSvgOptions(correct, dis.slice(0, 7), rnd);
    return {
      id: 'mat-latA-' + seed,
      domain: 'matrices',
      difficulty: diff,
      quick: quick === true,
      kind: 'svg',
      prompt: '¿Qué figura completa la matriz?',
      stimulus: matrixSVG(cells, 8),
      options: built.options,
      correct: built.correct,
      explanation: 'Cada fila y cada columna contienen las tres formas y los tres rellenos exactamente una vez, y el número de puntos sigue un ciclo propio. La casilla que falta debe reunir la forma, el relleno y los puntos que aún no aparecen ni en su fila ni en su columna.'
    };
  }

  function latinB(seed, diff, quick) {
    var rnd = mulberry32(seed);
    var outer = shuffle(OUTER_SHAPES_B, rnd);
    var inner = shuffle(INNER_SHAPES, rnd);
    var cells = [];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        cells.push({
          t: 'latin',
          shape: outer[(i + j) % 3],
          inner: inner[(2 * i + j) % 3],
          fill: FILLS[i],
          dots: 0
        });
      }
    }
    var correct = cells[8];
    var oi = outer.indexOf(correct.shape);
    var ii = inner.indexOf(correct.inner);
    var fi = FILLS.indexOf(correct.fill);
    var dis = [], seen = {};
    seen[cellKey(correct)] = true;
    function add(c) { var k = cellKey(c); if (!seen[k]) { seen[k] = true; dis.push(c); } }
    add({ t: 'latin', shape: outer[(oi + 1) % 3], inner: correct.inner, fill: correct.fill });
    add({ t: 'latin', shape: outer[(oi + 2) % 3], inner: correct.inner, fill: correct.fill });
    add({ t: 'latin', shape: correct.shape, inner: inner[(ii + 1) % 3], fill: correct.fill });
    add({ t: 'latin', shape: correct.shape, inner: inner[(ii + 2) % 3], fill: correct.fill });
    add({ t: 'latin', shape: correct.shape, inner: correct.inner, fill: FILLS[(fi + 1) % 3] });
    add({ t: 'latin', shape: correct.shape, inner: correct.inner, fill: FILLS[(fi + 2) % 3] });
    var guard = 0;
    while (dis.length < 7 && guard++ < 120) {
      add({ t: 'latin', shape: outer[Math.floor(rnd() * 3)], inner: inner[Math.floor(rnd() * 3)], fill: FILLS[Math.floor(rnd() * 3)] });
    }
    var built = buildSvgOptions(correct, dis.slice(0, 7), rnd);
    return {
      id: 'mat-latB-' + seed,
      domain: 'matrices',
      difficulty: diff,
      quick: quick === true,
      kind: 'svg',
      prompt: '¿Qué figura completa la matriz?',
      stimulus: matrixSVG(cells, 8),
      options: built.options,
      correct: built.correct,
      explanation: 'La forma exterior recorre las tres variantes en cada fila y columna; la forma interior sigue otro ciclo independiente. El relleno se mantiene igual dentro de cada fila. Las tres reglas deben cumplirse a la vez.'
    };
  }

  /* --------------------------- matrices: rotación ----------------------- */
  function rotationMatrix(seed, diff, quick, step, offset) {
    var rnd = mulberry32(seed);
    var cells = [];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        cells.push({ t: 'rot', angle: (offset + i * step + j * step) % 360, mirror: false, tone: i % 2 });
      }
    }
    var correct = cells[8];
    var dis = [], seen = {};
    seen[cellKey(correct)] = true;
    function add(c) { var k = cellKey(c); if (!seen[k]) { seen[k] = true; dis.push(c); } }
    add({ t: 'rot', angle: (correct.angle + step) % 360, mirror: false, tone: correct.tone });
    add({ t: 'rot', angle: (correct.angle - step + 360) % 360, mirror: false, tone: correct.tone });
    add({ t: 'rot', angle: correct.angle, mirror: true, tone: correct.tone });
    add({ t: 'rot', angle: (correct.angle + step) % 360, mirror: true, tone: correct.tone });
    add({ t: 'rot', angle: correct.angle, mirror: false, tone: correct.tone ? 0 : 1 });
    add({ t: 'rot', angle: (correct.angle + 2 * step) % 360, mirror: false, tone: correct.tone });
    add({ t: 'rot', angle: (correct.angle + step) % 360, mirror: false, tone: correct.tone ? 0 : 1 });
    var built = buildSvgOptions(correct, dis.slice(0, 7), rnd);
    return {
      id: 'mat-rot-' + seed,
      domain: 'matrices',
      difficulty: diff,
      quick: quick === true,
      kind: 'svg',
      prompt: '¿Qué figura completa la matriz?',
      stimulus: matrixSVG(cells, 8),
      options: built.options,
      correct: built.correct,
      explanation: 'La figura gira ' + step + '° en cada columna y otros ' + step + '° en cada fila; el color se mantiene dentro de cada fila y alterna entre filas. Solo una opción respeta la orientación y el color.'
    };
  }

  /* ------------------------ matrices: suma exclusiva -------------------- */
  function xorMatrix(seed, diff, quick, nSpokes) {
    var rnd = mulberry32(seed);
    function rset() {
      var s = [];
      for (var k = 0; k < nSpokes; k++) s.push(rnd() < 0.5 ? 1 : 0);
      return s;
    }
    function xor(a, b) { return a.map(function (v, k) { return v ^ b[k]; }); }
    function count(a) { return a.reduce(function (s, v) { return s + v; }, 0); }

    var A1, A2, B1, B2, A3, B3, guard = 0;
    do {
      A1 = rset(); A2 = rset(); B1 = rset(); B2 = rset();
      A3 = xor(A1, A2); B3 = xor(B1, B2);
      guard++;
    } while (guard < 300 && (count(A1) < 2 || count(A2) < 2 || count(B1) < 2 || count(B2) < 2 ||
      count(A3) < 2 || count(B3) < 2 || count(A3) > nSpokes - 2 || count(B3) > nSpokes - 2));

    var A = [A1, A2, A3], B = [B1, B2, B3];
    var cells = [];
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) cells.push({ t: 'spokes', spokes: xor(A[i], B[j]) });
    }
    var correct = cells[8];
    var dis = [], seen = {};
    seen[cellKey(correct)] = true;
    function add(c) { var k = cellKey(c); if (!seen[k]) { seen[k] = true; dis.push(c); } }

    // variantes con un radio cambiado
    for (var pass = 0; pass < 2; pass++) {
      for (var k = 0; k < nSpokes; k++) {
        if (dis.length >= 5) break;
        var toggled = correct.spokes.slice();
        toggled[k] = toggled[k] ? 0 : 1;
        add({ t: 'spokes', spokes: toggled });
      }
    }
    // AND y OR de las dos terceras figuras
    var andSet = A3.map(function (v, k) { return v & B3[k]; });
    var orSet = A3.map(function (v, k) { return v | B3[k]; });
    add({ t: 'spokes', spokes: andSet });
    add({ t: 'spokes', spokes: orSet });
    while (dis.length < 7) {
      var rndSet = [];
      for (var q = 0; q < nSpokes; q++) rndSet.push(rnd() < 0.5 ? 1 : 0);
      add({ t: 'spokes', spokes: rndSet });
    }

    var built = buildSvgOptions(correct, dis.slice(0, 7), rnd);
    return {
      id: 'mat-xor-' + seed,
      domain: 'matrices',
      difficulty: diff,
      quick: quick === true,
      kind: 'svg',
      prompt: '¿Qué figura completa la matriz?',
      stimulus: matrixSVG(cells, 8),
      options: built.options,
      correct: built.correct,
      explanation: 'En cada fila y en cada columna, la tercera figura conserva únicamente los radios que aparecen en una de las dos primeras: los que coinciden en ambas se anulan (suma exclusiva). Hay que aplicar la regla en las dos direcciones.'
    };
  }

  /* ------------------------------ espacial ------------------------------ */
  function emptyGrid(n) {
    var g = [];
    for (var i = 0; i < n; i++) { g.push([]); for (var j = 0; j < n; j++) g[i].push(0); }
    return g;
  }
  function rotGrid(g, times) {
    var out = g, n = g.length;
    for (var t = 0; t < ((times % 4) + 4) % 4; t++) {
      var ng = emptyGrid(n);
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) ng[j][n - 1 - i] = out[i][j];
      }
      out = ng;
    }
    return out;
  }
  function mirrorGrid(g) {
    var n = g.length, out = emptyGrid(n);
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) out[i][n - 1 - j] = g[i][j];
    return out;
  }
  function sameGrid(a, b) {
    for (var i = 0; i < a.length; i++) for (var j = 0; j < a.length; j++) if (a[i][j] !== b[i][j]) return false;
    return true;
  }
  function gridKey(g) { return g.map(function (r) { return r.join(''); }).join('/'); }

  function growPattern(rnd, n, filled) {
    var g = emptyGrid(n);
    var sr = Math.floor(rnd() * n), sc = Math.floor(rnd() * n);
    g[sr][sc] = 1;
    var total = 1, guard = 0;
    while (total < filled && guard++ < 400) {
      var frontier = [];
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          if (!g[i][j]) continue;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var r = i + d[0], c = j + d[1];
            if (r >= 0 && r < n && c >= 0 && c < n && !g[r][c]) frontier.push([r, c]);
          });
        }
      }
      if (!frontier.length) break;
      var pick = frontier[Math.floor(rnd() * frontier.length)];
      g[pick[0]][pick[1]] = 1;
      total++;
    }
    return g;
  }

  function validPattern(g) {
    var r1 = rotGrid(g, 1), r2 = rotGrid(g, 2), r3 = rotGrid(g, 3);
    if (sameGrid(g, r1) || sameGrid(g, r2) || sameGrid(g, r3)) return false;
    if (sameGrid(r1, r2) || sameGrid(r2, r3)) return false;
    var m = mirrorGrid(g);
    if (sameGrid(m, g) || sameGrid(m, r1) || sameGrid(m, r2) || sameGrid(m, r3)) return false;
    return true;
  }

  function gridSVG(g) {
    var n = g.length, pad = 14, inner = 200 - pad * 2, cell = inner / n, s = '';
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if (!g[i][j]) continue;
        var x = pad + j * cell, y = pad + i * cell;
        s += '<rect x="' + (x + 1).toFixed(1) + '" y="' + (y + 1).toFixed(1) + '" width="' + (cell - 3).toFixed(1) + '" height="' + (cell - 3).toFixed(1) +
          '" rx="4" fill="#8b7bff" opacity=".93"/>';
        s += '<rect x="' + (x + 1).toFixed(1) + '" y="' + (y + 1).toFixed(1) + '" width="' + (cell - 3).toFixed(1) + '" height="' + (cell - 3).toFixed(1) +
          '" rx="4" fill="none" stroke="rgba(16,20,36,.20)" stroke-width=".8"/>';
      }
    }
    return svgWrap(s, '0 0 200 200');
  }

  function spatialItem(seed, diff, quick, n, filled, turns) {
    var rnd = mulberry32(seed);
    var base = null, guard = 0;
    do {
      base = growPattern(rnd, n, filled);
      guard++;
    } while (guard < 400 && !validPattern(base));

    var correct = rotGrid(base, turns);
    var m = mirrorGrid(correct);
    var d1 = rotGrid(base, (turns + 1) % 4);
    var d2 = rotGrid(base, (turns + 2) % 4);
    var d3 = rotGrid(base, (turns + 3) % 4);

    function mutate(g) {
      var copy = g.map(function (r) { return r.slice(); });
      for (var tries = 0; tries < 30; tries++) {
        var fi = Math.floor(rnd() * n), fj = Math.floor(rnd() * n);
        var ei = Math.floor(rnd() * n), ej = Math.floor(rnd() * n);
        if (copy[fi][fj] && !copy[ei][ej]) {
          copy[fi][fj] = 0; copy[ei][ej] = 1;
          return copy;
        }
      }
      return copy;
    }
    var d4 = mutate(correct);

    var pool = [correct, m, d1, d2, d3, d4];
    var seen = {}, unique = [];
    pool.forEach(function (g) {
      var k = gridKey(g);
      if (!seen[k]) { seen[k] = true; unique.push(g); }
    });
    var order = shuffle(unique, rnd);
    var options = order.map(function (g) { return { svg: gridSVG(g) }; });
    var ci = 0;
    for (var i = 0; i < order.length; i++) if (gridKey(order[i]) === gridKey(correct)) { ci = i; break; }

    var angle = turns * 90;
    return {
      id: 'spa-' + seed,
      domain: 'spatial',
      difficulty: diff,
      quick: quick === true,
      kind: 'svg',
      prompt: 'La figura de la izquierda se gira ' + angle + '° en sentido horario. ¿Cuál es el resultado?',
      stimulus: gridSVG(base),
      options: options,
      correct: ci,
      explanation: 'Al girar ' + angle + '° en sentido horario, la figura conserva su forma pero no su orientación. La opción espejo es la trampa habitual: está invertida, no girada.'
    };
  }

  /* ------------------------------- texto -------------------------------- */
  function textItem(cfg) {
    var rnd = mulberry32(cfg.seed || 7);
    var opts = shuffle([cfg.answer].concat(cfg.distractors), rnd);
    return {
      id: cfg.id,
      domain: cfg.domain,
      difficulty: cfg.difficulty,
      quick: cfg.quick === true,
      extremeOnly: cfg.extremeOnly === true,
      kind: 'text',
      prompt: cfg.prompt,
      series: cfg.series || null,
      options: opts.map(function (o) { return { label: o }; }),
      correct: opts.indexOf(cfg.answer),
      explanation: cfg.explanation
    };
  }

  /* ============================ CONSTRUCCIÓN ============================ */

  var matrices = [
    latinA(1101, 2, true),
    latinA(1102, 2, true),
    latinA(1103, 3, false),
    latinB(1201, 3, false),
    latinB(1202, 3, true),
    latinB(1203, 4, false),
    rotationMatrix(1301, 4, true, 45, 0),
    rotationMatrix(1302, 4, false, 45, 45),
    rotationMatrix(1303, 4, false, 30, 0),
    xorMatrix(1401, 5, true, 6),
    xorMatrix(1402, 5, false, 6),
    xorMatrix(1403, 5, false, 8),
    rotationMatrix(1304, 5, false, 30, 15),
    xorMatrix(1404, 5, false, 8)
  ];
  matrices[12].extremeOnly = true;
  matrices[13].extremeOnly = true;

  var sequences = [
    textItem({
      id: 'seq-01', domain: 'sequences', difficulty: 1, seed: 21, quick: true,
      prompt: '¿Qué número continúa la serie?', series: '2, 6, 12, 20, 30, ?',
      answer: '42', distractors: ['40', '44', '36'],
      explanation: 'Las diferencias crecen de dos en dos: +4, +6, +8, +10… El siguiente salto es +12, así que 30 + 12 = 42.'
    }),
    textItem({
      id: 'seq-02', domain: 'sequences', difficulty: 2, seed: 22, quick: true,
      prompt: '¿Qué número continúa la serie?', series: '1, 1, 2, 3, 5, 8, 13, ?',
      answer: '21', distractors: ['20', '24', '26'],
      explanation: 'Cada término es la suma de los dos anteriores (sucesión de Fibonacci): 8 + 13 = 21.'
    }),
    textItem({
      id: 'seq-03', domain: 'sequences', difficulty: 2, seed: 23, quick: true,
      prompt: '¿Qué número continúa la serie?', series: '2, 3, 5, 7, 11, 13, ?',
      answer: '17', distractors: ['15', '16', '19'],
      explanation: 'Son los números primos consecutivos; después de 13 viene 17.'
    }),
    textItem({
      id: 'seq-04', domain: 'sequences', difficulty: 2, seed: 24, quick: true,
      prompt: '¿Qué número continúa la serie?', series: '8, 6, 9, 7, 10, 8, 11, ?',
      answer: '9', distractors: ['8', '10', '12'],
      explanation: 'Hay dos series intercaladas: 8, 9, 10, 11… y 6, 7, 8, … La incógnita ocupa la posición de la segunda, así que es 9.'
    }),
    textItem({
      id: 'seq-05', domain: 'sequences', difficulty: 3, seed: 25,
      prompt: '¿Qué número continúa la serie?', series: '5, 11, 23, 47, 95, ?',
      answer: '191', distractors: ['189', '190', '193'],
      explanation: 'Cada término se obtiene multiplicando por 2 y sumando 1: 95 × 2 + 1 = 191.'
    }),
    textItem({
      id: 'seq-06', domain: 'sequences', difficulty: 3, seed: 26,
      prompt: '¿Qué número continúa la serie?', series: '2, 5, 10, 17, 26, 37, ?',
      answer: '50', distractors: ['48', '49', '51'],
      explanation: 'Son los cuadrados más uno: 1²+1, 2²+1, 3²+1… El siguiente es 7² + 1 = 50.'
    }),
    textItem({
      id: 'seq-07', domain: 'sequences', difficulty: 3, seed: 27,
      prompt: '¿Qué número continúa la serie?', series: '1, 2, 6, 24, 120, ?',
      answer: '720', distractors: ['600', '840', '240'],
      explanation: 'Son factoriales: se multiplica por 2, luego por 3, por 4, por 5… y ahora por 6: 120 × 6 = 720.'
    }),
    textItem({
      id: 'seq-08', domain: 'sequences', difficulty: 4, seed: 28,
      prompt: '¿Qué número continúa la serie?', series: '1, 3, 8, 19, 42, ?',
      answer: '89', distractors: ['84', '86', '92'],
      explanation: 'La regla es ×2 + n, con n creciente: ×2+1, ×2+2, ×2+3, ×2+4… Ahora toca ×2+5: 42 × 2 + 5 = 89.'
    }),
    textItem({
      id: 'seq-09', domain: 'sequences', difficulty: 4, seed: 29,
      prompt: '¿Qué número continúa la serie?', series: '3, 4, 8, 17, 33, 58, ?',
      answer: '94', distractors: ['90', '92', '96'],
      explanation: 'Las diferencias son 1, 4, 9, 16 y 25: los cuadrados consecutivos. El siguiente salto es 36, así que 58 + 36 = 94.'
    }),
    textItem({
      id: 'seq-10', domain: 'sequences', difficulty: 5, seed: 30, extremeOnly: true,
      prompt: '¿Qué número continúa la serie?', series: '2, 12, 36, 80, 150, ?',
      answer: '252', distractors: ['240', '248', '260'],
      explanation: 'Cada término es n³ + n²: 1+1=2, 8+4=12, 27+9=36, 64+16=80, 125+25=150. Para n = 6: 216 + 36 = 252.'
    }),
    textItem({
      id: 'seq-11', domain: 'sequences', difficulty: 5, seed: 31, extremeOnly: true,
      prompt: '¿Qué número continúa la serie?', series: '1, 11, 21, 1211, 111221, ?',
      answer: '312211', distractors: ['122111', '211221', '1112221'],
      explanation: 'Cada término describe en voz alta el anterior: «un 1» → 11; «dos 1» → 21; «un 1 y un 2» → 1211; «un 1, un 2 y dos 1» → 111221; «tres 1, dos 2 y un 1» → 312211.'
    })
  ];

  var logic = [
    textItem({
      id: 'log-01', domain: 'logic', difficulty: 1, seed: 41, quick: true,
      prompt: 'Ana es mayor que Bea. Bea es mayor que Carla. Diego es mayor que Ana. ¿Quién es la segunda persona mayor?',
      answer: 'Ana', distractors: ['Bea', 'Carla', 'Diego'],
      explanation: 'El orden es Diego > Ana > Bea > Carla. La segunda es Ana.'
    }),
    textItem({
      id: 'log-02', domain: 'logic', difficulty: 2, seed: 42, quick: true,
      prompt: 'Ningún A es B. Todos los C son A. ¿Qué se sigue necesariamente?',
      answer: 'Ningún C es B', distractors: ['Algunos C son B', 'Todos los B son C', 'Ningún A es C'],
      explanation: 'Todo C está dentro de A, y A no comparte ningún elemento con B. Por tanto, C tampoco puede compartir nada con B.'
    }),
    textItem({
      id: 'log-03', domain: 'logic', difficulty: 2, seed: 43,
      prompt: 'Si llueve, el suelo se moja. El suelo está mojado. ¿Qué se puede concluir con certeza?',
      answer: 'Nada sobre si ha llovido', distractors: ['Ha llovido', 'No ha llovido', 'Si no llueve, el suelo no se moja'],
      explanation: 'Estás afirmando la consecuencia, no la causa. El suelo puede estar mojado por una manguera, así que no se puede deducir que haya llovido.'
    }),
    textItem({
      id: 'log-04', domain: 'logic', difficulty: 2, seed: 44, quick: true,
      prompt: 'Todos los ingenieros del equipo saben programar. Nadie que sepa programar es malo en lógica. Marta es ingeniera del equipo. ¿Qué se sigue?',
      answer: 'Marta no es mala en lógica', distractors: ['Marta es mala en lógica', 'Marta programa mal', 'No se sigue nada sobre Marta'],
      explanation: 'Marta sabe programar por ser ingeniera; y quien sabe programar no es malo en lógica. Por tanto, Marta no es mala en lógica.'
    }),
    textItem({
      id: 'log-05', domain: 'logic', difficulty: 3, seed: 45,
      prompt: 'En un grupo de 40 personas, 25 hablan inglés, 20 hablan francés y 8 no hablan ninguno de los dos idiomas. ¿Cuántas hablan ambos?',
      answer: '13', distractors: ['5', '8', '12'],
      explanation: '32 personas hablan al menos un idioma (40 − 8). Por inclusión-exclusión: 25 + 20 − 32 = 13 hablan ambos.'
    }),
    textItem({
      id: 'log-06', domain: 'logic', difficulty: 3, seed: 46,
      prompt: 'Cuatro tarjetas tienen una letra en un lado y un número en el otro. Regla: «si una tarjeta tiene vocal, entonces tiene número par». Las caras visibles son A, K, 4 y 7. ¿Qué tarjetas hay que girar para comprobar la regla?',
      answer: 'A y 7', distractors: ['A y 4', 'Solo A', 'A, K y 4'],
      explanation: 'Hay que buscar contraejemplos: la A (vocal con impar) y el 7 (impar con vocal). La K y el 4 no pueden violar la regla: la K no es vocal y el 4 solo confirma el consecuente.'
    }),
    textItem({
      id: 'log-07', domain: 'logic', difficulty: 4, seed: 47,
      prompt: 'A dice: «B es escudero». B dice: «A y yo somos de tipos distintos». Los caballeros siempre dicen la verdad y los escuderos siempre mienten. ¿Qué son A y B?',
      answer: 'A es escudero y B es caballero', distractors: ['A es caballero y B es escudero', 'Ambos son caballeros', 'Ambos son escuderos'],
      explanation: 'Si A fuera caballero, B sería escudero, pero entonces la frase de B («somos distintos») sería verdadera y un escudero no puede decir la verdad. Si A es escudero, su frase es falsa, B es caballero y la frase de B es verdadera: todo encaja.'
    }),
    textItem({
      id: 'log-08', domain: 'logic', difficulty: 5, seed: 48, extremeOnly: true,
      prompt: 'Tres cajas llevan las etiquetas «Manzanas», «Naranjas» y «Mezcla». Todas las etiquetas son incorrectas. Abres la caja etiquetada «Mezcla» y sacas una manzana. ¿Qué contiene cada caja?',
      answer: '«Mezcla»: solo manzanas · «Naranjas»: mezcla · «Manzanas»: solo naranjas',
      distractors: [
        '«Mezcla»: solo manzanas · «Naranjas»: solo naranjas · «Manzanas»: mezcla',
        '«Mezcla»: mezcla · «Naranjas»: solo manzanas · «Manzanas»: solo naranjas',
        '«Mezcla»: solo naranjas · «Naranjas»: mezcla · «Manzanas»: solo manzanas'
      ],
      explanation: 'La etiqueta «Mezcla» es incorrecta, así que esa caja no está mezclada. Al sacar una manzana, es la caja de solo manzanas. La etiqueta «Naranjas» tampoco puede ser solo naranjas, así que es la mezcla. Queda «Manzanas»: solo naranjas.'
    })
  ];

  var verbal = [
    textItem({
      id: 'ver-01', domain: 'verbal', difficulty: 1, seed: 51, quick: true,
      prompt: 'Completa la analogía: MÉDICO es a DIAGNÓSTICO como JUEZ es a…',
      answer: 'sentencia', distractors: ['abogado', 'delito', 'tribunal'],
      explanation: 'El médico emite un diagnóstico; el juez emite una sentencia. La relación es «profesional → resolución que emite».'
    }),
    textItem({
      id: 'ver-02', domain: 'verbal', difficulty: 2, seed: 52, quick: true,
      prompt: 'Completa la analogía: EFÍMERO es a DURADERO como FUGAZ es a…',
      answer: 'persistente', distractors: ['veloz', 'breve', 'súbito'],
      explanation: 'Efímero y duradero son antónimos; fugaz y persistente también: lo fugaz pasa pronto, lo persistente permanece.'
    }),
    textItem({
      id: 'ver-03', domain: 'verbal', difficulty: 2, seed: 53, quick: true,
      prompt: 'Completa la analogía: INMUNE es a ENFERMEDAD como IMPERMEABLE es a…',
      answer: 'agua', distractors: ['frío', 'viento', 'humedad'],
      explanation: 'Inmune significa que la enfermedad no le afecta; impermeable, que el agua no lo atraviesa. La relación es «protegido frente a un agente».'
    }),
    textItem({
      id: 'ver-04', domain: 'verbal', difficulty: 3, seed: 54,
      prompt: 'Completa la analogía: PRODIGAR es a ESCATIMAR como DILAPIDAR es a…',
      answer: 'ahorrar', distractors: ['gastar', 'derrochar', 'adquirir'],
      explanation: 'Prodigar es repartir sin medida y escatimar es dar lo mínimo: son opuestos. Dilapidar es gastar sin control, y su opuesto es ahorrar. «Gastar» y «derrochar» son sinónimos, no antónimos.'
    }),
    textItem({
      id: 'ver-05', domain: 'verbal', difficulty: 3, seed: 55,
      prompt: 'Completa la analogía: LACÓNICO es a VERBORREA como PARCO es a…',
      answer: 'exceso', distractors: ['escasez', 'silencio', 'prudencia'],
      explanation: 'Lacónico usa pocas palabras; su opuesto es la verborrea. Parco come y bebe con moderación; su opuesto es el exceso.'
    }),
    textItem({
      id: 'ver-06', domain: 'verbal', difficulty: 2, seed: 56,
      prompt: 'Completa la analogía: BOSQUEJO es a OBRA como BORRADOR es a…',
      answer: 'versión definitiva', distractors: ['texto breve', 'cuaderno', 'idea'],
      explanation: 'El bosquejo es la versión previa e incompleta de la obra; el borrador lo es de la versión definitiva del texto.'
    }),
    textItem({
      id: 'ver-07', domain: 'verbal', difficulty: 4, seed: 57,
      prompt: 'Completa la analogía: ACRECENTAR es a DISMINUIR como ENCOMIAR es a…',
      answer: 'vituperar', distractors: ['alabar', 'elogiar', 'aprobar'],
      explanation: 'Acrecentar y disminuir son opuestos; encomiar (alabar) y vituperar (criticar con dureza) también. «Alabar» y «elogiar» son sinónimos de encomiar, no antónimos.'
    }),
    textItem({
      id: 'ver-08', domain: 'verbal', difficulty: 5, seed: 58, extremeOnly: true,
      prompt: 'Completa la analogía: INOCUO es a DAÑO como INEFABLE es a…',
      answer: 'expresión', distractors: ['emoción', 'silencio', 'sentido'],
      explanation: 'Inocuo es lo que no causa daño; inefable es lo que no puede expresarse con palabras. En ambos casos falta aquello que define al término.'
    })
  ];

  var spatial = [
    spatialItem(2101, 2, true, 3, 4, 1),
    spatialItem(2102, 2, true, 3, 5, 2),
    spatialItem(2103, 3, true, 4, 6, 1),
    spatialItem(2104, 3, false, 4, 7, 3),
    spatialItem(2105, 4, false, 4, 8, 1),
    spatialItem(2106, 4, false, 4, 8, 2),
    spatialItem(2107, 4, false, 4, 9, 3),
    spatialItem(2108, 5, false, 5, 11, 1)
  ];
  spatial[7].extremeOnly = true;

  /* ----------------------------- memoria -------------------------------- */
  var wordPool = [
    { word: 'UMBRAL', lures: ['ALBEDRÍO', 'PENUMBRA', 'QUIMERA'] },
    { word: 'QUIMERA', lures: ['UMBRAL', 'VÉRTICE', 'ZAHORÍ'] },
    { word: 'ALBEDRÍO', lures: ['CÉFIRO', 'PENUMBRA', 'UMBRAL'] },
    { word: 'ZAHORÍ', lures: ['QUIMERA', 'CÉFIRO', 'VÉRTICE'] },
    { word: 'PENUMBRA', lures: ['ALBEDRÍO', 'UMBRAL', 'AURORA'] },
    { word: 'CÉFIRO', lures: ['ZAHORÍ', 'AURORA', 'QUIMERA'] }
  ];

  var spans = [
    { id: 'span-4', length: 4, digits: [4, 9, 2, 7] },
    { id: 'span-5', length: 5, digits: [8, 3, 6, 1, 5] },
    { id: 'span-6', length: 6, digits: [2, 9, 4, 7, 3, 8] },
    { id: 'span-7', length: 7, digits: [6, 1, 8, 4, 9, 2, 5] },
    { id: 'span-8', length: 8, digits: [3, 8, 1, 6, 9, 4, 7, 2] }
  ];

  window.MENSURA = {
    version: '1.0.0',
    domains: [
      { id: 'matrices', name: 'Razonamiento abstracto', short: 'Abstracto', color: '#4f46e5' },
      { id: 'sequences', name: 'Razonamiento numérico', short: 'Numérico', color: '#4f46e5' },
      { id: 'logic', name: 'Lógica deductiva', short: 'Lógica', color: '#4f46e5' },
      { id: 'verbal', name: 'Razonamiento verbal', short: 'Verbal', color: '#4f46e5' },
      { id: 'spatial', name: 'Visualización espacial', short: 'Espacial', color: '#4f46e5' },
      { id: 'memory', name: 'Memoria de trabajo', short: 'Memoria', color: '#4f46e5' }
    ],
    items: { matrices: matrices, sequences: sequences, logic: logic, verbal: verbal, spatial: spatial },
    spans: spans,
    wordPool: wordPool
  };
})();
