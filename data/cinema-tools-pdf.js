/* cinema-tools-pdf.js — Cinema Tools · DESIGN GEOMETRY proposal (v0.2.0)
   window.CinemaToolsPdf — the client-facing PDF for a Cinema Tools option,
   built on the SHARED luxury chrome `data/sonor-pdf-luxury.js` (same cover,
   hero, CEDIA strip, footer, section heads and page furniture as the Seating
   Configurator + Cinema Design Proposal). Rules: cinema-pdf-luxury skill.
   Drawings are the app's SCENES (cinema-tools-app.js) rendered natively in
   pdf-lib in the seating CAD-on-cream language — one drawing source, so the
   PDF can never drift from what the screen shows.
   Pages: cover · the numbers · dimensioned plan · section & sightlines ·
   screen & viewing · projector & room · loudspeaker layout · notes & reference.
*/
(function (global) {
  'use strict';

  function L() { return global.SonorPdfLuxury; }
  var DOC_LABEL = 'CINEMA DESIGN GEOMETRY';

  function selfDir() {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[^/]*$/, ''); } catch (e) {}
    try { var arr = document.getElementsByTagName('script'); for (var i = arr.length - 1; i >= 0; i--) { if (/cinema-tools-pdf\.js/.test(arr[i].src)) return arr[i].src.replace(/[^/]*$/, ''); } } catch (e) {}
    return '../data/';
  }
  var BASE = selfDir();

  // ── palette (shared master + the seating CAD drawing colours) ─────────────
  var DIM = [110, 100, 88], CADL = [90, 84, 72], GHOST = [150, 142, 126];
  function PAL() {
    var C = L().COL;
    return {
      g85: [C.INK2, 0.9], g80: [[140, 120, 88], 1], g75: [C.MUT, 1], g70: [C.INK2, 0.75], g55: [CADL, 0.9], g50: [C.INK2, 0.6],
      g45: [GHOST, 0.8], g35: [CADL, 0.8], g28: [GHOST, 0.55], g25: [GHOST, 0.6], g14: [GHOST, 0.18],
      room: [[252, 250, 246], 0.6], voidF: [C.PUR, 0.06], pur16: [C.PUR, 0.16], pur14: [C.PUR, 0.14], pur12: [C.PUR, 0.12], pur10: [C.PUR, 0.1], pur08: [C.PUR, 0.08],
      purS: [C.PUR, 0.7], sight: [C.PUR, 0.6], sight2: [C.PUR, 0.35], gold: [C.GOLD, 1], goldL: [C.GDEEP, 1], pjF: [C.GOLD, 0.25], pjS: [C.GOLD, 0.5],
      riser: [C.GOLD, 0.14], dim: [DIM, 1], cap: [C.MUT, 1], diag: [C.GOLD, 0.5], ink: [C.INK, 1]
    };
  }
  function tok(pal, k) {
    if (!k || k === 'none') return null;
    if (pal[k]) return pal[k];
    if (/^#/.test(k)) return [L().hexRgb(k), 1];
    return [GHOST, 1];
  }
  function pdRows(rows) { return rows.map(function (r) { return [r[0], r[1] == null ? r[1] : pd(r[1])]; }); }
  function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-GB'); }
  function mmv(n) { return n == null ? '—' : fmt(Math.round(n)) + ' mm'; }
  function fit(F, font, str, size, width) {
    str = String(str == null ? '' : str);
    if (font.widthOfTextAtSize(str, size) <= width) return str;
    var e = '…';
    while (str.length && font.widthOfTextAtSize(str + e, size) > width) str = str.slice(0, -1);
    return str + e;
  }
  function pd(x) { return String(x).replace(/−/g, '-').replace(/→/g, '>').replace(/×/g, 'x').replace(/m²/g, 'sq m').replace(/m³/g, 'cu m').replace(/ft²/g, 'sq ft'); }   // Gilroy-safe (no superscripts / ligature traps)

  // ── SCENE → pdf-lib (native vectors) ───────────────────────────────────────
  function drawScene(P, F, scene, x0, top0, availW, availH) {
    var lx = L(), A4 = lx.A4, PL = global.PDFLib, page = P.page, pal = PAL();
    var k = Math.min(availW / scene.w, availH / scene.h);
    var ox = x0 + (availW - scene.w * k) / 2, oy = top0 + (availH - scene.h * k) / 2;
    var X = function (v) { return ox + v * k; }, T = function (v) { return oy + v * k; }, Yp = function (v) { return A4.h - T(v); };
    var col = lx.col;
    scene.items.forEach(function (it) {
      var f = tok(pal, it.f), s = tok(pal, it.s), sw = (it.sw || 1) * k, dash = it.dash ? it.dash.split(',').map(function (n) { return Math.max(0.6, +n * k); }) : undefined;
      if (it.t === 'rect') {
        var w = it.w * k, h = it.h * k, r = Math.min((it.r || 0) * k, w / 2, h / 2);
        var o = { color: f ? col(f[0]) : undefined, opacity: f ? f[1] : 0, borderColor: s ? col(s[0]) : undefined, borderWidth: s ? sw : 0, borderOpacity: s ? s[1] : 0, borderDashArray: dash };
        if (r > 0.2) {
          var p = 'M ' + r + ',0 H ' + (w - r) + ' A ' + r + ',' + r + ' 0 0 1 ' + w + ',' + r + ' V ' + (h - r) + ' A ' + r + ',' + r + ' 0 0 1 ' + (w - r) + ',' + h + ' H ' + r + ' A ' + r + ',' + r + ' 0 0 1 0,' + (h - r) + ' V ' + r + ' A ' + r + ',' + r + ' 0 0 1 ' + r + ',0 Z';
          o.x = X(it.x); o.y = Yp(it.y); page.drawSvgPath(p, o);
        } else { o.x = X(it.x); o.y = Yp(it.y) - h; o.width = w; o.height = h; page.drawRectangle(o); }
      } else if (it.t === 'line') {
        if (!s) return;
        page.drawLine({ start: { x: X(it.x1), y: Yp(it.y1) }, end: { x: X(it.x2), y: Yp(it.y2) }, thickness: sw, color: col(s[0]), opacity: s[1], dashArray: dash });
      } else if (it.t === 'circle') {
        page.drawCircle({ x: X(it.cx), y: Yp(it.cy), size: it.r * k, color: f ? col(f[0]) : undefined, opacity: f ? f[1] : 0, borderColor: s ? col(s[0]) : undefined, borderWidth: s ? sw : 0, borderOpacity: s ? s[1] : 0 });
      } else if (it.t === 'poly') {
        var pth = it.pts.map(function (pt, i) { return (i ? 'L ' : 'M ') + ((pt[0] - it.pts[0][0]) * k) + ',' + ((pt[1] - it.pts[0][1]) * k); }).join(' ') + ' Z';
        page.drawSvgPath(pth, { x: X(it.pts[0][0]), y: Yp(it.pts[0][1]), color: f ? col(f[0]) : undefined, opacity: f ? f[1] : 0, borderColor: s ? col(s[0]) : undefined, borderWidth: s ? sw : 0, borderOpacity: s ? s[1] : 0 });
      } else if (it.t === 'text') {
        if (!f || it.f === 'cap') return;   // page furniture carries the caption
        var font = it.b ? F.b : F.r, size = Math.max(it.size * k, 6.2), tr = (it.ls || 0) * k, str = pd(it.s);
        var w2 = 0; for (var i = 0; i < str.length; i++) w2 += font.widthOfTextAtSize(str[i], size) + tr; w2 -= tr;
        var ax = it.a === 'middle' ? -w2 / 2 : it.a === 'end' ? -w2 : 0;
        if (it.rot) {
          // rotated -90 in scene space → reads bottom-to-top; centre the glyph body on the anchor line
          var px = X(it.x) + size * 0.35, py = Yp(it.y) + ax;
          page.drawText(str, { x: px, y: py, size: size, font: font, color: col(f[0]), opacity: f[1], rotate: PL.degrees(90) });
        } else {
          var cx = X(it.x) + ax, by = Yp(it.y);
          if (tr) { for (var j = 0; j < str.length; j++) { page.drawText(str[j], { x: cx, y: by, size: size, font: font, color: col(f[0]), opacity: f[1] }); cx += font.widthOfTextAtSize(str[j], size) + tr; } }
          else page.drawText(str, { x: cx, y: by, size: size, font: font, color: col(f[0]), opacity: f[1] });
        }
      }
    });
    return oy + scene.h * k;
  }

  // ── table (truncating cells, thin dividers, no divider after the last row) ─
  // cols: [{ h, w, a:'l'|'r'|'c', b:true }]  rows: [[cell…]]  opts: { mark:[rowIdx→hex], cur:rowIdx, rowH }
  function table(P, F, x, top, cols, rows, opts) {
    opts = opts || {}; var lx = L(), C = lx.COL, rowH = opts.rowH || 15, y = top, sz = opts.size || 9;
    var xs = []; var cx = x; cols.forEach(function (c) { xs.push(cx); cx += c.w; });
    var W = cx - x;
    cols.forEach(function (c, i) { var t = String(c.h).toUpperCase(); if (c.a === 'r') P.trackedRight(t, xs[i] + c.w - 2, y, 6.5, F.r, C.MUT, 1.3); else P.tracked(t, xs[i] + (c.a === 'c' ? c.w / 2 - 6 : (i && cols[i - 1].a === 'r' ? 8 : 2)), y, 6.5, F.r, C.MUT, 1.3); });
    y += 11; P.hline(x, x + W, y, C.GOLD, 0.6, 0.8); y += 5;
    rows.forEach(function (r, ri) {
      var cur = opts.cur === ri;
      if (cur) P.rect(x - 4, y - 3, W + 8, rowH, C.GOLD, 0.1);
      if (opts.mark && opts.mark[ri]) P.dot(x - 9, y + 4.5, 2.6, lx.hexRgb(opts.mark[ri]), C.INK2);
      r.forEach(function (cell, ci) {
        var c = cols[ci]; if (!c) return;
        var font = c.b || (cur && ci === 0) ? F.b : F.r, str = fit(F, font, pd(cell == null ? '—' : cell), sz, c.w - 5);
        var cellC = c.c ? c.c : (cur ? C.INK : C.INK2);
        if (typeof cell === 'object' && cell && cell.chip) { chip(P, F, xs[ci] + (c.a === 'r' ? c.w - 4 : 2), y, cell.chip, cell.pass, c.a === 'r'); return; }
        if (c.a === 'r') P.right(str, xs[ci] + c.w - 2, y, sz, font, cellC);
        else if (c.a === 'c') P.center(str, xs[ci] + c.w / 2, y, sz, font, cellC);
        else P.text(str, xs[ci] + 2, y, sz, font, cellC);
      });
      y += rowH;
      if (ri < rows.length - 1) P.hline(x, x + W, y - 4, C.LINE, 0.45, 0.8);
    });
    return y;
  }
  var CHIP = { pass: [[92, 140, 88], 'OK'], warn: [[190, 140, 50], 'MARGINAL'], fail: [[180, 70, 60], 'OUT'] };
  function chip(P, F, x, top, label, pass, rightAlign) {
    var c = CHIP[pass] || CHIP.pass, t = String(label || c[1]).toUpperCase(), w = F.b.widthOfTextAtSize(t, 6) + (t.length - 1) * 1 + 10;
    var x0 = rightAlign ? x - w : x;
    P.rect(x0, top - 1, w, 10.5, c[0], 0.14); P.rectB(x0, top - 1, w, 10.5, c[0], 0.5, 0.6);
    P.tracked(t, x0 + 5, top + 1.2, 6, F.b, c[0], 1);
  }
  // stat tiles — the app's strip, in print
  function tiles(P, F, x, top, w, cells, perRow) {
    var C = L().COL, n = perRow || 3, cw = w / n, th = 46, rows = Math.ceil(cells.length / n);
    P.rectB(x, top, w, rows * th, C.LINE, 0.7, 0.9);
    cells.forEach(function (c, i) {
      var cx = x + (i % n) * cw, cy = top + Math.floor(i / n) * th;
      if (i % n) P.vline(cx, cy + 6, cy + th - 6, C.LINE, 0.6, 0.9);
      if (i >= n && i % n === 0) P.hline(x + 8, x + w - 8, cy, C.LINE, 0.6, 0.9);
      P.tracked(String(c[0]).toUpperCase(), cx + 12, cy + 9, 6.2, F.r, C.MUT, 1.4);
      P.text(fit(F, F.b, pd(c[1]), 13, cw - 24), cx + 12, cy + 19, 13, F.b, C.INK);
      if (c[2]) P.text(fit(F, F.r, pd(c[2]), 7.5, cw - 24), cx + 12, cy + 34, 7.5, F.r, C.MUT);
    });
    return top + rows * th;
  }
  function bullets(P, F, x, top, w, items, size) {
    var lx = L(), C = lx.COL, y = top; size = size || 9.5;
    items.forEach(function (t) {
      var c = typeof t === 'object' ? t : { t: t };
      P.dot(x + 3, y + size * 0.55, 2, c.pass === 'fail' ? CHIP.fail[0] : c.pass === 'warn' ? CHIP.warn[0] : C.GOLD);
      var lines = lx.wrap(pd(c.t), F.r, size, w - 14);
      lines.forEach(function (ln, li) { P.text(ln, x + 12, y + li * (size + 3.5), size, F.r, C.INK2); });
      y += lines.length * (size + 3.5) + 5;
    });
    return y;
  }
  function legend(P, F, x, top, w, entries) {
    var C = L().COL, lx = L(), cx = x, y = top;
    entries.forEach(function (e) {
      var t = e.label, tw = F.r.widthOfTextAtSize(t, 7.5) + 18;
      if (cx + tw > x + w) { cx = x; y += 13; }
      P.dot(cx + 4, y + 4, 3, lx.hexRgb(e.hex), C.INK2); P.text(t, cx + 12, y, 7.5, F.r, C.INK2); cx += tw;
    });
    return y + 14;
  }
  function flagsBlock(P, F, m, y) {
    if (!m.flags || !m.flags.length) return y;
    return bullets(P, F, L().M, y, L().A4.w - L().M * 2, m.flags.map(function (f) { return { t: f.t, pass: f.p }; }), 9.5) + 4;
  }

  // ── PAGES ──────────────────────────────────────────────────────────────────
  function pNumbers(m) {
    return function (P, F, n, T) {
      var lx = L(), A4 = lx.A4, M = lx.M, C = lx.COL, s = m.screen, st = m.seating, pj = m.projector, au = m.audio;
      P.rect(0, 0, A4.w, A4.h, C.CREAM); lx.pageHead(P, F, 'THE NUMBERS', n, T, DOC_LABEL);
      var y = lx.sectionHead(P, F, 'Summary' + (m.isFinal ? ' · final option' : ''), m.label,
        'Every figure in this document comes from one shared set of room, screen and seating numbers, so the plan, section, sightlines, brightness and loudspeaker layout always agree with each other.');
      y = tiles(P, F, M, y + 2, A4.w - M * 2, [
        ['Room', mmv(m.room.w) + ' x ' + mmv(m.room.d), 'ceiling ' + mmv(m.room.h)],
        ['Screen', s.diagIn + '" ' + s.aspect, mmv(s.w) + ' x ' + mmv(s.h)],
        ['Seating', st.rows + ' rows x ' + st.perRow, st.seats + ' seats · pitch ' + mmv(st.pitch)],
        ['MLP field of view', m.viewing.mlp.fov + '°', m.viewing.mlp.band + ' · row ' + st.refRow],
        ['Projector', pj.throwRatio + ':1', mmv(pj.throwMm) + ' · ' + pj.fl + ' fL'],
        ['Audio', au.recipe, au.discrete + ' channels · ' + au.subCount + ' sub' + (au.subCount === 1 ? '' : 's')]
      ], 3) + 18;
      var colW = (A4.w - M * 2 - 24) / 2;
      var y1 = lx.specRows(P, F, pdRows([
        ['Screen', s.diagIn + '" ' + s.aspect + ' · ' + mmv(s.w) + ' x ' + mmv(s.h) + ' · ' + s.areaM2 + ' m²'],
        ['Screen height', 'bottom ' + mmv(s.bottomAfl) + ' AFL · centre ' + mmv(s.centreAfl) + ' · top ' + mmv(s.topAfl)],
        ['Front row', mmv(st.firstRowDist) + ' eye to screen · ' + (m.viewing.rows[0] ? m.viewing.rows[0].fov + '° field of view' : '')],
        ['Eye / ear height', mmv(st.eyeAfl) + ' / ' + mmv(st.earAfl) + ' AFL (row 1)'],
        ['Row run', mmv(st.run) + ' · ' + mmv(st.side) + ' clear each side']
      ]), M, y, colW);
      var y2 = lx.specRows(P, F, pdRows([
        ['Projector', pj.throwRatio + ':1 · lens ' + mmv(pj.lensY) + ' from the front wall'],
        ['Brightness', fmt(pj.lumens) + ' lm · gain ' + pj.gain + ' · ' + pj.fl + ' fL (' + fmt(pj.nits) + ' nits)'],
        ['Loudspeakers', au.recipe + ' · ' + au.groups.screen + ' screen · ' + (au.groups.surround + au.groups.back + au.groups.wide) + ' surround · ' + (au.groups.top + au.groups.height) + ' upper'],
        ['Subwoofers', au.subCount + ' · ' + au.subPos],
        ['Risers', m.riser.rows.map(function (r) { return 'R' + r.row + ' ' + (r.build ? '+' + r.build : 'floor'); }).join(' · ')]
      ]), M + colW + 24, y, colW);
      y = Math.max(y1, y2) + 10;
      P.hline(M, A4.w - M, y, C.GOLD, 0.6, 0.8); y += 14;
      y = flagsBlock(P, F, m, y);
      if (m.notes) {
        P.tracked('NOTES', M, y, 6.5, F.r, C.MUT, 1.5); y += 12;
        lx.wrap(pd(m.notes), F.r, 9.5, A4.w - M * 2).slice(0, 10).forEach(function (ln) { P.text(ln, M, y, 9.5, F.r, C.INK2); y += 13; });
      }
      lx.pageFoot(P, F);
    };
  }
  function pPlan(m) {
    return function (P, F, n, T) {
      var lx = L(), A4 = lx.A4, M = lx.M, C = lx.COL;
      P.rect(0, 0, A4.w, A4.h, C.CREAM); lx.pageHead(P, F, 'DIMENSIONED PLAN', n, T, DOC_LABEL);
      P.text(m.screen.diagIn + '" ' + m.screen.aspect + ' — ' + m.seating.rows + ' rows x ' + m.seating.perRow + ' — ' + m.audio.recipe, M - 1, 100, 20, F.b, C.INK);
      P.right('All dimensions in mm', A4.w - M, 104, 9, F.r, C.MUT);
      var y = drawScene(P, F, m.scenes.plan, M, 128, A4.w - M * 2, 470) + 14;
      P.hline(M, A4.w - M, y, C.LINE, 0.7); y += 12;
      y = legend(P, F, M, y, A4.w - M * 2, m.audio.legend.concat([{ label: 'Listening area (dashed) · MLP crosshair · PJ lens', hex: '#8058a1' }]));
      lx.wrap('Seats show the upright footprint with the reclined envelope behind; the dashed rectangle is the RP22 listening area used for every loudspeaker angle. Loudspeaker positions are measured from the front-left corner at floor level.', F.r, 8.5, A4.w - M * 2).forEach(function (ln) { P.text(ln, M, y, 8.5, F.r, C.MUT); y += 11.5; });
      lx.pageFoot(P, F);
    };
  }
  function pSection(m) {
    return function (P, F, n, T) {
      var lx = L(), A4 = lx.A4, M = lx.M, C = lx.COL;
      P.rect(0, 0, A4.w, A4.h, C.CREAM); lx.pageHead(P, F, 'SECTION & SIGHTLINES', n, T, DOC_LABEL);
      P.text('Risers, eye lines and the projector', M - 1, 100, 20, F.b, C.INK);
      P.right('All dimensions in mm', A4.w - M, 104, 9, F.r, C.MUT);
      var y = drawScene(P, F, m.scenes.section, M, 126, A4.w - M * 2, 250) + 16;
      P.tracked('RISER SCHEDULE', M, y, 8, F.r, C.GOLD, 2.2); y += 16;
      y = table(P, F, M, y, [
        { h: 'Row', w: 40, b: true }, { h: 'Eye to screen', w: 84, a: 'r' }, { h: 'Eye req. AFL', w: 80, a: 'r' }, { h: 'Riser (min)', w: 76, a: 'r' },
        { h: 'Build', w: 72, a: 'r', b: true }, { h: 'Rise from prev', w: 82, a: 'r' }, { h: 'Steps', w: 65, a: 'r' }
      ], m.riser.rows.map(function (r) { return ['Row ' + r.row, mmv(r.dist), mmv(r.eyeReq), mmv(r.raw), r.build ? mmv(r.build) : 'floor', r.rise == null ? '—' : mmv(r.rise), r.steps || '—']; }));
      y += 12;
      lx.wrap(pd(m.riser.rule), F.r, 8.5, A4.w - M * 2).forEach(function (ln) { P.text(ln, M, y, 8.5, F.r, C.MUT); y += 11.5; });
      lx.pageFoot(P, F);
    };
  }
  function pViewing(m) {
    return function (P, F, n, T) {
      var lx = L(), A4 = lx.A4, M = lx.M, C = lx.COL, s = m.screen;
      P.rect(0, 0, A4.w, A4.h, C.CREAM); lx.pageHead(P, F, 'SCREEN & VIEWING', n, T, DOC_LABEL);
      P.text(s.diagIn + '" ' + s.aspect + ' — ' + mmv(s.w) + ' x ' + mmv(s.h), M - 1, 100, 20, F.b, C.INK);
      P.right(pd(s.areaM2 + ' m² · ' + s.areaFt2 + ' ft²'), A4.w - M, 104, 9, F.r, C.MUT);
      var y = drawScene(P, F, m.scenes.screen, M, 122, A4.w - M * 2, 232) + 12;
      P.tracked('PER ROW', M, y, 8, F.r, C.GOLD, 2.2); y += 16;
      var mlpIdx = m.viewing.rows.findIndex(function (r) { return r.mlp; });
      y = table(P, F, M, y, [
        { h: 'Row', w: 64, b: true }, { h: 'Eye to screen', w: 76, a: 'r' }, { h: 'FoV', w: 66, a: 'r' }, { h: 'Band', w: 106 },
        { h: 'Pixels / °', w: 56, a: 'r' }, { h: 'To top', w: 60, a: 'r' }, { h: 'Vertical', w: 71 }
      ], m.viewing.rows.map(function (r) { return ['Row ' + r.row + (r.mlp ? ' · MLP' : ''), mmv(r.dist), r.fov + '°', { chip: r.band, pass: r.pass }, r.ppd + (r.resPass === 'pass' ? '' : ' soft'), '+' + r.toTop + '°', { chip: r.vPass === 'pass' ? 'comfort' : r.vPass === 'warn' ? 'SMPTE ok' : 'over 35°', pass: r.vPass }]; }), { cur: mlpIdx });
      y += 8;
      lx.wrap('Bands: THX floor 26° · SMPTE 30° · THX target 36° · CEB23 40° · immersive 45-60° (ITU UHD 58°). 60 pixels per degree and above makes the pixel grid invisible. Vertical: SMPTE EG-18 allows 35° to the screen top; 15° is the comfort figure.', F.r, 8.5, A4.w - M * 2).forEach(function (ln) { P.text(ln, M, y, 8.5, F.r, C.MUT); y += 11.5; });
      var half = (A4.w - M * 2 - 24) / 2;
      y += 8; P.tracked('DISTANCE FOR THIS SCREEN', M, y, 8, F.r, C.GOLD, 2.2); P.tracked('SAME SCREEN, OTHER FORMATS', M + half + 24, y, 8, F.r, C.GOLD, 2.2); y += 16;
      var ya = table(P, F, M, y, [{ h: 'Standard', w: half * 0.5 }, { h: 'Angle', w: half * 0.2, a: 'r' }, { h: 'Eye to screen', w: half * 0.3, a: 'r', b: true }],
        m.viewing.distTable.map(function (b) { return [b.key, b.fov + '°', mmv(b.dist)]; }), { rowH: 14 });
      var yb = table(P, F, M + half + 24, y, [{ h: 'Format', w: half * 0.2 }, { h: 'Constant height', w: half * 0.44, a: 'r' }, { h: 'On this screen', w: half * 0.36, a: 'r' }],
        s.formats.slice(0, 7).map(function (f) { return [f.id, f.cih, f.bars]; }), { rowH: 14 });
      lx.pageFoot(P, F);
    };
  }
  function pProjector(m) {
    return function (P, F, n, T) {
      var lx = L(), A4 = lx.A4, M = lx.M, C = lx.COL, pj = m.projector, ra = m.roomAc;
      P.rect(0, 0, A4.w, A4.h, C.CREAM); lx.pageHead(P, F, 'PROJECTOR & ROOM', n, T, DOC_LABEL);
      P.text('Throw, brightness and the room itself', M - 1, 100, 20, F.b, C.INK);
      var y = 132;
      y = tiles(P, F, M, y, A4.w - M * 2, [
        ['Throw ratio', pj.throwRatio + ':1', mmv(pj.throwMm) + ' lens to screen'],
        ['Lens position', mmv(pj.lensY) + ' from front', mmv(pj.fromRear) + ' from the rear wall'],
        ['On screen', pj.fl + ' fL', fmt(pj.nits) + ' nits · ' + pj.note],
        ['Room volume', ra.vol + ' m³', ra.area + ' m² floor'],
        ['Ratio H : W : L', '1 : ' + ra.ratioW + ' : ' + ra.ratioL, 'nearest ' + ra.nearest],
        ['Schroeder', ra.schroeder + ' Hz', 'modal region below']
      ], 3) + 16;
      if (pj.over) y = bullets(P, F, M, y, A4.w - M * 2, [{ t: 'Lens position ' + mmv(pj.lensY) + ' is beyond the rear wall — needs a shorter-throw lens or a smaller screen.', pass: 'fail' }]);
      var half = (A4.w - M * 2 - 24) / 2;
      P.tracked('LUMENS FOR THIS SCREEN · GAIN ' + pj.gain, M, y, 8, F.r, C.GOLD, 2.2);
      P.tracked('THROW RATIO TO DISTANCE', M + half + 24, y, 8, F.r, C.GOLD, 2.2); y += 16;
      var ya = table(P, F, M, y, [{ h: 'Target', w: half * 0.56 }, { h: 'fL', w: half * 0.14, a: 'r' }, { h: 'ANSI lumens', w: half * 0.3, a: 'r', b: true }],
        pj.lumensTable.map(function (r) { return [r.target, r.fl, fmt(r.lumens)]; }), { rowH: 14 });
      var curT = pj.throwTable.findIndex(function (r) { return r.cur; });
      var yb = table(P, F, M + half + 24, y, [{ h: 'Ratio', w: half * 0.26 }, { h: 'Throw', w: half * 0.34, a: 'r' }, { h: 'Lens from front', w: half * 0.4, a: 'r' }],
        pj.throwTable.map(function (r) { return [r.ratio, mmv(r.throwMm), mmv(r.lens) + (r.over ? ' (over)' : '')]; }), { rowH: 14, cur: curT });
      y = Math.max(ya, yb) + 18;
      P.tracked('AXIAL MODES · FIRST FOUR PER AXIS', M, y, 8, F.r, C.GOLD, 2.2); y += 16;
      var W = A4.w - M * 2;
      y = table(P, F, M, y, [{ h: 'Axis', w: W * 0.16 }, { h: 'Length', w: W * 0.18, a: 'r' }, { h: '1st', w: W * 0.165, a: 'r' }, { h: '2nd', w: W * 0.165, a: 'r' }, { h: '3rd', w: W * 0.165, a: 'r' }, { h: '4th', w: W * 0.165, a: 'r' }],
        [['Length', mmv(m.room.d)].concat(ra.modes.L.map(function (f) { return f + ' Hz'; })), ['Width', mmv(m.room.w)].concat(ra.modes.W.map(function (f) { return f + ' Hz'; })), ['Height', mmv(m.room.h)].concat(ra.modes.H.map(function (f) { return f + ' Hz'; }))], { rowH: 14 });
      y += 8;
      var note = (ra.clashes.length ? 'Axial mode coincidences: ' + ra.clashes.join(', ') + ' — expect strong peaks; plan subwoofer placement, EQ and bass trapping accordingly. ' : '') + (ra.cubeWarn ? 'Two dimensions are within 5% of each other — modes stack. ' : '') + 'f = c·n / 2L with c = 343 m/s. Even spacing between axial modes below the Schroeder frequency is the goal.';
      lx.wrap(pd(note), F.r, 8.5, W).forEach(function (ln) { P.text(ln, M, y, 8.5, F.r, C.MUT); y += 11.5; });
      y += 10; P.tracked('REFERENCE RATIOS · NORMALISED TO HEIGHT 1', M, y, 8, F.r, C.GOLD, 2.2); y += 16;
      table(P, F, M, y, [{ h: 'Reference', w: W * 0.34 }, { h: 'W', w: W * 0.12, a: 'r' }, { h: 'L', w: W * 0.12, a: 'r' }, { h: 'For ' + mmv(m.room.h) + ' ceiling', w: W * 0.3, a: 'r' }, { h: 'Delta', w: W * 0.12, a: 'r' }],
        ra.refs.slice(0, 6).map(function (r) { return [r.name, r.w, r.l, r.forH, r.err]; }), { rowH: 14, cur: 0 });
      lx.pageFoot(P, F);
    };
  }
  function pAudio(m) {
    return function (P, F, n, T) {
      var lx = L(), A4 = lx.A4, M = lx.M, C = lx.COL, au = m.audio;
      P.rect(0, 0, A4.w, A4.h, C.CREAM); lx.pageHead(P, F, 'LOUDSPEAKER LAYOUT', n, T, DOC_LABEL);
      P.text(au.recipe + ' loudspeaker layout', M - 1, 100, 20, F.b, C.INK);
      P.right(au.discrete + ' discrete channels · ' + au.subCount + ' sub' + (au.subCount === 1 ? '' : 's') + ' · MLP row ' + au.mlpRow, A4.w - M, 104, 9, F.r, C.MUT);
      var y = 128;
      if (au.fails || au.warns) y = bullets(P, F, M, y, A4.w - M * 2, [{ t: (au.fails ? au.fails + ' channel' + (au.fails > 1 ? 's' : '') + ' outside the RP22 angle bands' : '') + (au.fails && au.warns ? ' · ' : '') + (au.warns ? au.warns + ' marginal' : '') + ' — adjust the listening area or elevation targets, or accept within the RP22 tolerance.', pass: au.fails ? 'fail' : 'warn' }]) + 4;
      var W = A4.w - M * 2 - 12;
      var rowsA = au.speakers.map(function (s) { return [s.label, s.name + (s.note ? ' · ' + s.note : ''), mmv(s.x), mmv(s.y), mmv(s.z), (s.side === 'C' ? '' : s.side + ' ') + s.az + '°', (s.el >= 0 ? '+' : '') + s.el + '°', mmv(s.dist), { chip: s.pass === 'pass' ? 'OK' : s.pass === 'warn' ? 'MARGIN' : 'OUT', pass: s.pass }]; });
      var rowH = rowsA.length > 26 ? 12.5 : 14.5;
      y = table(P, F, M + 12, y, [
        { h: 'Ch', w: W * 0.06, b: true }, { h: 'Loudspeaker', w: W * 0.26 }, { h: 'X', w: W * 0.1, a: 'r' }, { h: 'Y front', w: W * 0.1, a: 'r' }, { h: 'Z AFL', w: W * 0.1, a: 'r' },
        { h: 'Azimuth', w: W * 0.1, a: 'r' }, { h: 'Elev.', w: W * 0.07, a: 'r' }, { h: 'Distance', w: W * 0.1, a: 'r' }, { h: 'RP22', w: W * 0.11, a: 'r' }
      ], rowsA, { rowH: rowH, size: 8.5, mark: au.speakers.map(function (s) { return s.hex; }) });
      y += 10;
      y = legend(P, F, M, y, A4.w - M * 2, au.legend);
      lx.wrap('Azimuth is measured from the main listening position (0° = screen centre; L/R); elevation from the ear plane at ' + mmv(au.earAfl) + ' AFL. Bands follow RP22 §5.5-5.8 plus the Dolby upper-layer guidance; top channels are judged on the fore/aft angle the section diagrams use. Subwoofers follow the Cinema Design corner convention - final positions by measurement.', F.r, 8.5, A4.w - M * 2).forEach(function (ln) { P.text(ln, M, y, 8.5, F.r, C.MUT); y += 11.5; });
      lx.pageFoot(P, F);
    };
  }
  function pNotes(m) {
    return function (P, F, n, T) {
      var lx = L(), A4 = lx.A4, M = lx.M, C = lx.COL;
      P.rect(0, 0, A4.w, A4.h, C.CREAM); lx.pageHead(P, F, 'NOTES & REFERENCE', n, T, DOC_LABEL);
      var y = lx.sectionHead(P, F, 'How to read this document', 'Standards and assumptions');
      y = bullets(P, F, M, y + 4, A4.w - M * 2, [
        'Quick-calc figures for design discussion. Cinema Design remains the source of the detailed room design; this option ' + (m.isFinal ? 'is the one Cinema Design currently references.' : 'is one of the saved options for the project.'),
        'Screen geometry and viewing angles per SMPTE EG-18, THX and CTA-CEDIA CEB23; pixel-density figures assume ' + (m.screen.contentRes || '4K') + ' content. Same-screen format conversions keep the screen surface and show the bars or pillars that result.',
        'Brightness per SMPTE 196M: 16 fL reference, 28 fL design-initial to allow for lamp ageing, 40-60 fL where ambient light is present. Screen gain as stated; acoustically transparent screens run close to unity.',
        'Riser heights use the eye-over-head-top sightline rule to the screen bottom with the stated clearance, rounded to the preferred step, with steps above the maximum split per Approved Document K.',
        'Loudspeaker layout per CEDIA/CTA-RP22 v1.2 Appendix E with the listening area, main listening position and elevation targets shown on the plan. Positions are set-out points for the design stage; final placement is confirmed by measurement in the finished room.',
        'Room ratios, axial modes and the Schroeder frequency are indicative (RT60 assumed 0.35 s); the acoustic treatment scheme is developed in Cinema Design.',
        'All dimensions are in millimetres from finished surfaces unless stated. Prepared with Sonor Cinema Tools v' + m.appVersion + '.'
      ], 10);
      // reference — seating terms-page anatomy: label left, value right, alone near the foot
      P.hline(M, A4.w - M, A4.h - 130, C.LINE, 0.8);
      P.tracked('DOCUMENT REFERENCE', M, A4.h - 116, 6.5, F.r, C.MUT, 1.5);
      P.right(m.ref, A4.w - M, A4.h - 119, 14, F.b, C.INK);
      P.text('Please quote this reference in any correspondence about this option.', M, A4.h - 101, 8.5, F.r, C.MUT);
      P.right(m.dateText, A4.w - M, A4.h - 100, 8.5, F.r, C.MUT);
      lx.pageFoot(P, F);
    };
  }

  function mintRef() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    var tail = ''; for (var i = 0; i < 4; i++) tail += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)];
    return 'SNR-CT-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + tail;
  }

  async function generate(m) {
    var lx = L();
    if (!lx) throw new Error('SonorPdfLuxury master not loaded');
    var PL = global.PDFLib;
    var doc = await PL.PDFDocument.create();
    doc.setTitle('Cinema design geometry — ' + (m.project || 'Sonor')); doc.setAuthor('Sonor Ltd'); doc.setProducer('Sonor Cinema Tools v' + m.appVersion);
    var F = await lx.makeFonts(doc, BASE);
    m.ref = m.ref || mintRef();

    var hero = null, cedia = null, fadeImg = null;
    try { hero = await lx.loadImage(doc, BASE + 'venice-double-seats.png'); } catch (e) {}
    try { cedia = await lx.loadImage(doc, BASE + 'cedia-member-stacked.png'); } catch (e) {}
    try { var fd = lx.fadePngDataUrl(); if (fd) fadeImg = await doc.embedPng(await lx.fetchBytes(fd)); } catch (e) {}

    var pages = [pNumbers(m), pPlan(m), pSection(m), pViewing(m), pProjector(m), pAudio(m), pNotes(m)];
    var TOTAL = pages.length + 1;
    var p1 = doc.addPage([lx.A4.w, lx.A4.h]);
    lx.cover(lx.mk(p1, doc), F, {
      hero: hero, fadeImg: fadeImg, cediaImg: cedia,
      eyebrow: DOC_LABEL,
      title: m.project || 'Your Cinema',
      subtitle: m.label ? pd(m.label) : 'by Sonor',
      info: [['PREPARED FOR', fit(F, F.b, m.client || m.project || '—', 12.5, (lx.A4.w - lx.M * 2) / 3 - 18)], ['PROJECT', fit(F, F.b, m.project || '—', 12.5, (lx.A4.w - lx.M * 2) / 3 - 18)], ['REFERENCE', m.ref]]
    });
    pages.forEach(function (draw, i) { var pg = doc.addPage([lx.A4.w, lx.A4.h]); draw(lx.mk(pg, doc), F, i + 2, TOTAL); });

    var bytes = await doc.save();
    if (m.returnBytes) return bytes;
    var blob = new Blob([bytes], { type: 'application/pdf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ((m.project || 'Sonor') + ' - Cinema geometry - ' + (m.label || 'option') + ' - ' + m.ref + '.pdf').replace(/[\/\\:*?"<>|]/g, '-');
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return m.ref;
  }

  global.CinemaToolsPdf = {
    __version: '0.2.0',
    generate: generate,
    available: function () { return !!(global.PDFLib && global.PDFLib.PDFDocument && global.SonorPdfLuxury); }
  };
})(window);
