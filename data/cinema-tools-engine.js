// cinema-tools-engine.js — Cinema Tools (Sonor) pure maths
// ─────────────────────────────────────────────────────────────────────────────
// No DOM, no app-state. Every function takes plain numbers (mm unless stated)
// and returns plain objects so the UI, the SVG renderer and the CD contract all
// consume identical figures. Video bands come from SonorRP23, audio recipes +
// labels from SonorRP22 (both workspace-shared) with local fallbacks.
(function (global) {
  'use strict';

  var CFG = global.__CINEMA_TOOLS_CONFIG__;
  var IN = 25.4, FT = 304.8;
  var rad = function (d) { return d * Math.PI / 180; };
  var deg = function (r) { return r * 180 / Math.PI; };
  var r0 = function (n) { return Math.round(n); };
  var r1 = function (n) { return Math.round(n * 10) / 10; };

  function rp23() { return global.SonorRP23 || null; }
  function video() { var m = rp23(); return (m && m.STANDARDS) || CFG.VIDEO_FALLBACK; }
  function layouts() { var m = global.SonorRP22; return (m && m.LAYOUTS) || CFG.LAYOUTS_FALLBACK; }
  function layoutKeys() { var m = global.SonorRP22; return (m && m.LAYOUT_KEYS) || CFG.LAYOUT_KEYS_FALLBACK; }
  function chanName(ch) { var m = global.SonorRP22; var e = m && m.LABELS && m.LABELS[ch]; return e ? e.name : ch; }
  function chanAtmos(ch) { var m = global.SonorRP22; var e = m && m.LABELS && m.LABELS[ch]; return e ? e.atmos : ch; }
  function aspectR(id) { var a = CFG.ASPECTS.find(function (x) { return x.id === id; }); return a ? a.r : 16 / 9; }

  // ── SCREEN GEOMETRY ─────────────────────────────────────────────────────
  // Solve a screen from ANY one of: diagIn, diagMm, wMm, hMm (+ aspect ratio).
  function screen(ratio, given) {
    var r = typeof ratio === 'string' ? aspectR(ratio) : ratio;
    var k = Math.sqrt(1 + r * r);            // diag / height
    var w, h;
    if (given.wMm > 0)            { w = given.wMm; h = w / r; }
    else if (given.hMm > 0)       { h = given.hMm; w = h * r; }
    else if (given.diagMm > 0)    { h = given.diagMm / k; w = h * r; }
    else if (given.diagIn > 0)    { h = given.diagIn * IN / k; w = h * r; }
    else return null;
    var d = Math.sqrt(w * w + h * h);
    return { ratio: r, w: w, h: h, diag: d, diagIn: d / IN, wIn: w / IN, hIn: h / IN,
             wFt: w / FT, hFt: h / FT, areaM2: (w * h) / 1e6, areaFt2: (w / FT) * (h / FT) };
  }

  // Convert one screen to another aspect on the SAME screen surface.
  // mode 'cih' constant image height (scope wider) · 'ciw' constant image width
  // (scope letterboxed) · 'cid' constant diagonal.
  function convertAspect(base, targetRatio, mode) {
    var r = targetRatio;
    if (mode === 'cih') return screen(r, { hMm: base.h });
    if (mode === 'cid') return screen(r, { diagMm: base.diag });
    return screen(r, { wMm: base.w });
  }
  // Letterbox / pillarbox bars when content of ratio rc plays on screen s.
  function bars(s, rc) {
    if (rc > s.ratio) { var h = s.w / rc; return { type: 'letterbox', each: (s.h - h) / 2, imageW: s.w, imageH: h }; }
    if (rc < s.ratio) { var w = s.h * rc;  return { type: 'pillarbox', each: (s.w - w) / 2, imageW: w, imageH: s.h }; }
    return { type: 'none', each: 0, imageW: s.w, imageH: s.h };
  }
  // Largest screen that fits a wall: room width less side margins; height cap
  // from ceiling less bottom AFL less top margin.
  function fitToWall(ratio, roomW, roomH, sideMargin, bottomAfl, topMargin) {
    var r = typeof ratio === 'string' ? aspectR(ratio) : ratio;
    var maxW = roomW - 2 * sideMargin, maxH = roomH - bottomAfl - topMargin;
    var byW = screen(r, { wMm: maxW }), byH = screen(r, { hMm: maxH });
    var s = byW.h <= maxH ? byW : byH;
    return { screen: s, limitedBy: byW.h <= maxH ? 'width' : 'height', maxW: maxW, maxH: maxH };
  }

  // ── VIEWING ─────────────────────────────────────────────────────────────
  function hFov(w, dist) { return (w > 0 && dist > 0) ? deg(2 * Math.atan((w / 2) / dist)) : null; }
  function distForFov(w, fov) { return (w > 0 && fov > 0) ? (w / 2) / Math.tan(rad(fov) / 2) : null; }
  function widthForFov(fov, dist) { return (fov > 0 && dist > 0) ? 2 * dist * Math.tan(rad(fov) / 2) : null; }
  function fovVerdict(fov) {
    var m = rp23(); if (m && m.fovVerdict) return m.fovVerdict(fov);
    var H = video().hFov;
    if (fov == null) return { pass: 'fail', band: 'unknown', note: 'no geometry' };
    if (fov < H.thxAbsoluteMin) return { pass: 'fail', band: 'below THX floor', note: '< ' + H.thxAbsoluteMin + '°' };
    if (fov < H.thxBackRowMin)  return { pass: 'warn', band: 'THX minimum', note: H.thxAbsoluteMin + '–' + H.thxBackRowMin + '°' };
    if (fov < H.thxDesignTarget) return { pass: 'warn', band: 'SMPTE minimum', note: '≥30° SMPTE, < 36° THX target' };
    if (fov <= H.immersiveMax)  return { pass: 'pass', band: 'reference / immersive', note: '36–60°' };
    return { pass: 'warn', band: 'over-immersive', note: '> ' + H.immersiveMax + '°' };
  }
  function ppd(resKey, fov) { var hp = video().resolution.hPixels[resKey]; return (hp && fov > 0) ? hp / fov : null; }
  function resVerdict(resKey, fov) {
    var m = rp23(); var hp = video().resolution.hPixels[resKey];
    if (m && m.resolutionVerdict) return m.resolutionVerdict(hp, fov);
    var p = ppd(resKey, fov), lim = video().resolution.acuityPpd;
    if (p == null) return { ppd: null, pass: 'fail', note: 'no geometry' };
    if (p < lim * 0.85) return { ppd: p, pass: 'warn', note: 'pixel grid may be visible' };
    if (p > lim * 1.6) return { ppd: p, pass: 'pass', note: 'grid invisible — immersion headroom' };
    return { ppd: p, pass: 'pass', note: 'resolved at acuity limit' };
  }
  // Vertical sightlines from eye to screen edges (degrees; + = up)
  function vertical(scr, screenBottomAfl, eyeAfl, dist) {
    var top = screenBottomAfl + scr.h, ctr = screenBottomAfl + scr.h / 2;
    var a = function (y) { return deg(Math.atan((y - eyeAfl) / dist)); };
    var V = video().vFov;
    var toTop = a(top), toCtr = a(ctr), toBot = a(screenBottomAfl);
    var pass = toTop <= V.smpteMaxToTop ? (toTop <= V.comfortToEdge ? 'pass' : 'warn') : 'fail';
    return { toTop: toTop, toCentre: toCtr, toBottom: toBot, pass: pass,
             note: pass === 'fail' ? '> ' + V.smpteMaxToTop + '° SMPTE EG-18 limit to top' : pass === 'warn' ? '≤35° SMPTE, > ' + V.comfortToEdge + '° comfort' : '≤' + V.comfortToEdge + '° comfort band' };
  }
  // Distance table for a screen: rows at each standard angle
  function distanceTable(scr) {
    var H = video().hFov;
    return [
      { key: 'THX floor',     fov: H.thxAbsoluteMin },
      { key: 'SMPTE min',     fov: H.thxBackRowMin },
      { key: 'THX target',    fov: H.thxDesignTarget },
      { key: 'CEB23 ref',     fov: H.ceb23Reference },
      { key: 'Immersive',     fov: H.sweetSpotLo },
      { key: 'ITU UHD',       fov: H.ituUhdReference },
      { key: 'Immersive max', fov: H.immersiveMax }
    ].map(function (b) { return { key: b.key, fov: b.fov, dist: distForFov(scr.w, b.fov) }; });
  }

  // ── PROJECTOR ───────────────────────────────────────────────────────────
  function throwDist(ratio, w) { return ratio * w; }
  function throwRatio(dist, w) { return dist / w; }
  function widthFromThrow(dist, ratio) { return dist / ratio; }
  function footLamberts(lumens, gain, areaFt2) { return (lumens * gain) / areaFt2; }
  function requiredLumens(fl, gain, areaFt2) { return (fl * areaFt2) / gain; }
  function brightnessVerdict(fl) {
    var L = video().luminance;
    if (fl < L.sdrBandLoFl) return { pass: 'fail', note: '< ' + L.sdrBandLoFl + ' fL — dim, no lamp-ageing headroom' };
    if (fl < L.sdrReferenceFl) return { pass: 'warn', note: L.sdrBandLoFl + '–16 fL — SDR band, below SMPTE 16 fL reference' };
    if (fl <= L.sdrBandHiFl) return { pass: 'pass', note: '16–22 fL — SMPTE 196M reference band' };
    if (fl <= L.designInitialFl) return { pass: 'pass', note: '22–28 fL — design-initial for lamp ageing / light HDR' };
    if (fl <= L.ambientHighFl) return { pass: 'warn', note: '> 28 fL — HDR / ambient-light territory; verify iris' };
    return { pass: 'warn', note: '> ' + L.ambientHighFl + ' fL — very bright; media-room class' };
  }

  // ── RISER / SIGHTLINES ─────────────────────────────────────────────────
  // Each row's eye must see the screen bottom over the head-top of the row in
  // front. Returns per-row required eye AFL, riser height, and a rounded
  // build height in `step` increments (Part K domestic max 220 mm risers).
  function riser(opts) {
    var rows = opts.rows, pitch = opts.pitch, d1 = opts.firstRowDist;
    var eye = opts.eyeAfl, head = opts.headTopAboveEye, clr = opts.clearance;
    var sb = opts.screenBottomAfl, step = opts.stepPref || 180, stepMax = opts.stepMax || 220;
    var out = [], prevEye = eye, prevD = d1;
    for (var i = 0; i < rows; i++) {
      var d = d1 + i * pitch;
      if (i === 0) { out.push({ row: 1, dist: d, eyeReq: eye, riserRaw: 0, riserBuild: 0, steps: 0, stepH: 0 }); continue; }
      var target = prevEye + head + clr;                      // head-top + clearance of row in front
      var eyeReq = sb + (target - sb) * (d / prevD);          // similar triangles to screen bottom
      var raw = Math.max(0, eyeReq - eye);
      var build = Math.ceil(raw / step) * step;
      var steps = Math.ceil(build / stepMax);
      var stepH = steps ? build / steps : 0;
      var floorPrev = out[i - 1].riserBuild;
      var riseThis = build - floorPrev;
      out.push({ row: i + 1, dist: d, eyeReq: eyeReq, riserRaw: raw, riserBuild: build, riseFromPrev: riseThis,
                 steps: Math.max(1, Math.ceil(riseThis / stepMax)), stepH: riseThis / Math.max(1, Math.ceil(riseThis / stepMax)) });
      prevEye = eye + build; prevD = d;
    }
    return out;
  }

  // ── ROOM (ratios + modes) ──────────────────────────────────────────────
  function room(w, d, h, rt60) {
    var c = CFG.DEFAULTS.acoustics.c;
    var vol = (w * d * h) / 1e9;
    var rw = w / h, rl = d / h;
    var refs = CFG.ROOM_RATIOS.map(function (rr) {
      var err = Math.sqrt(Math.pow(rr.w - rw, 2) + Math.pow(rr.l - rl, 2));
      return { name: rr.name, w: rr.w, l: rr.l, err: err };
    }).sort(function (a, b) { return a.err - b.err; });
    var ax = function (L) { var f = []; for (var n = 1; n <= 4; n++) f.push(r1(c * n / (2 * (L / 1000)))); return f; };
    var mL = ax(d), mW = ax(w), mH = ax(h);
    // flag axial coincidences (within 5%) across the three sets
    var all = [].concat(mL.map(function (f) { return { f: f, a: 'L' }; }), mW.map(function (f) { return { f: f, a: 'W' }; }), mH.map(function (f) { return { f: f, a: 'H' }; })).sort(function (a, b) { return a.f - b.f; });
    var clashes = [];
    for (var i = 1; i < all.length; i++) if (all[i].a !== all[i - 1].a && (all[i].f - all[i - 1].f) / all[i].f < 0.05) clashes.push(all[i - 1].f + '/' + all[i].f + ' Hz (' + all[i - 1].a + '+' + all[i].a + ')');
    var schroeder = 2000 * Math.sqrt((rt60 || 0.35) / vol);
    return { volM3: vol, ratioW: rw, ratioL: rl, nearest: refs[0], refs: refs, modes: { L: mL, W: mW, H: mH }, clashes: clashes, schroeder: schroeder,
             cubeWarn: Math.abs(w - d) / d < 0.05 || Math.abs(w - h) / h < 0.05 || Math.abs(d - h) / d < 0.05 };
  }

  // ── AUDIO LAYOUT (RP22 recipe → positions → angles) ────────────────────
  // room {w,d,h}; la {x,y,w,h} listening area (mm, y from screen wall);
  // mlp {x,y}; opts { ear, frontY, sideClear, rearClear, topElevDeg,
  // surroundElevDeg, ceilDrop, subCount, subPos:'opposite'|'front'|'rear',
  // frontMode:'la'|'angle', frontAngleDeg }
  function placeLayout(recipeKey, rm, la, mlp, opts) {
    var L = layouts()[recipeKey]; if (!L) return null;
    var o = Object.assign({ ear: 1200, frontY: 60, sideClear: 150, rearClear: 200, topElevDeg: 45, surroundElevDeg: 10, ceilDrop: 0,
                            subCount: 2, subPos: 'opposite', frontMode: 'la', frontAngleDeg: 26, heightZ: null }, opts || {});
    var RW = rm.w, RD = rm.d, RH = rm.h;
    var TOP_Z = RH - o.ceilDrop - 30, HEIGHT_Z = o.heightZ || (RH - 350);
    var cxLA = la.x + la.w / 2, cyLA = la.y + la.h / 2;
    var FRONT = o.frontY, SIDE = o.sideClear, REAR = o.rearClear;
    var has = function (c) { return L.channels.indexOf(c) >= 0; };
    var clampY = function (y) { return Math.max(FRONT + 100, Math.min(RD - REAR, y)); };
    var spk = [];
    var add = function (ch, x, y, z, note) { spk.push({ channel: ch, x: r0(x), y: r0(y), z: r0(z), klass: CFG.klassOf(ch), name: chanName(ch), atmos: chanAtmos(ch), note: note || '' }); };

    // Screen wall (LCR)
    var flX = la.x, frX = la.x + la.w;
    if (o.frontMode === 'angle') { var off = (mlp.y - FRONT) * Math.tan(rad(o.frontAngleDeg)); flX = mlp.x - off; frX = mlp.x + off; }
    flX = Math.max(SIDE, flX); frX = Math.min(RW - SIDE, frX);
    if (has('FL'))  add('FL',  flX, FRONT, o.ear, 'LA-aligned (RP22 §5.5.1)');
    if (has('FCL')) add('FCL', mlp.x - la.w * 0.25, FRONT, o.ear);
    if (has('FC'))  add('FC',  RW / 2, FRONT, o.ear, 'behind screen centre');
    if (has('FCR')) add('FCR', mlp.x + la.w * 0.25, FRONT, o.ear);
    if (has('FR'))  add('FR',  frX, FRONT, o.ear, 'LA-aligned (RP22 §5.5.1)');
    // Wides — side walls, midway between front wall and LA front edge
    if (has('FWL')) add('FWL', SIDE, Math.max(FRONT + 200, la.y / 2), o.ear, 'RP22 §5.7');
    if (has('FWR')) add('FWR', RW - SIDE, Math.max(FRONT + 200, la.y / 2), o.ear);
    // Surrounds — side walls, level with LA centre, slightly raised
    var sZ = function (dx) { return o.ear + Math.abs(dx) * Math.tan(rad(o.surroundElevDeg)); };
    var surrRear = o.surrPos === 'rear' && !has('SBL');
    if (has('SL')) surrRear ? add('SL', cxLA - la.w * 0.4, RD - REAR, o.ear, 'rear wall (side walls unusable)') : add('SL', SIDE, cyLA, sZ(mlp.x - SIDE), 'RP22 §5.6.1');
    if (has('SR')) surrRear ? add('SR', cxLA + la.w * 0.4, RD - REAR, o.ear, 'rear wall') : add('SR', RW - SIDE, cyLA, sZ(RW - SIDE - mlp.x));
    if (has('SL1')) add('SL1', SIDE, la.y + 100, sZ(mlp.x - SIDE), 'forward pair (multi-row)');
    if (has('SR1')) add('SR1', RW - SIDE, la.y + 100, sZ(RW - SIDE - mlp.x));
    if (has('SBL')) add('SBL', cxLA - la.w * 0.4, RD - REAR, o.ear, 'RP22 §5.6.1 rule 2');
    if (has('SBR')) add('SBR', cxLA + la.w * 0.4, RD - REAR, o.ear);
    // Upper layer — angle-driven from MLP (elevation target) on LA-edge lines
    // Upper-layer elevation is the SECTION-view (fore/aft) angle, as Dolby's
    // and RP22's diagrams measure it; the speaker sits on the LA-edge line.
    var run = (TOP_Z - o.ear) / Math.tan(rad(o.topElevDeg));
    if (has('TFL')) add('TFL', la.x, clampY(mlp.y - run), TOP_Z, o.topElevDeg + '° elev. target');
    if (has('TFR')) add('TFR', la.x + la.w, clampY(mlp.y - run), TOP_Z);
    if (has('TML')) add('TML', la.x, cyLA, TOP_Z, 'above LA centre line');
    if (has('TMR')) add('TMR', la.x + la.w, cyLA, TOP_Z);
    if (has('TMC')) add('TMC', mlp.x, mlp.y, TOP_Z, 'over RSP (±500 mm)');
    if (has('TBL')) add('TBL', la.x, clampY(mlp.y + run), TOP_Z, o.topElevDeg + '° elev. target');
    if (has('TBR')) add('TBR', la.x + la.w, clampY(mlp.y + run), TOP_Z);
    // Height (wall) layer
    if (has('HFL')) add('HFL', la.x, FRONT, HEIGHT_Z);
    if (has('HFC')) add('HFC', RW / 2, FRONT, HEIGHT_Z, 'Auro HC / DTS Ch');
    if (has('HFR')) add('HFR', la.x + la.w, FRONT, HEIGHT_Z);
    if (has('HBL')) add('HBL', la.x, RD - REAR, HEIGHT_Z);
    if (has('HBR')) add('HBR', la.x + la.w, RD - REAR, HEIGHT_Z);
    // Subs — CD convention (corner-loaded, 500 box)
    var minSubs = L.discrete >= 12 ? 2 : 1;
    var n = Math.max(minSubs, Math.min(4, o.subCount | 0));
    var inset = 300, fY = inset, bY = RD - inset, lX = inset, rX = RW - inset;
    var subs = [];
    if (n === 1) subs = [[rX, o.subPos === 'rear' ? bY : fY]];
    else if (n === 2) subs = o.subPos === 'front' ? [[lX, fY], [rX, fY]] : o.subPos === 'rear' ? [[lX, bY], [rX, bY]] : [[lX, fY], [rX, bY]];
    else if (n === 3) subs = [[lX, fY], [rX, fY], [RW / 2, bY]];
    else subs = [[lX, fY], [rX, fY], [lX, bY], [rX, bY]];
    subs.forEach(function (p, i) { add('SUB' + (i + 1), p[0], p[1], 0, n === 4 ? 'SBA — 4 corners (RP22 §6.5)' : 'corner-loaded'); });

    // Angles from MLP + verdicts
    spk.forEach(function (s) {
      var dx = s.x - mlp.x, dy = mlp.y - s.y;                // forward = +dy
      var horiz = Math.sqrt(dx * dx + dy * dy);
      s.az = r1(deg(Math.atan2(Math.abs(dx), dy)));           // 0 front … 180 rear
      s.side = dx < -1 ? 'L' : dx > 1 ? 'R' : 'C';
      s.el = r1(deg(Math.atan2(s.z - o.ear, horiz)));            // true elevation
      s.elFA = r1(deg(Math.atan2(s.z - o.ear, Math.abs(dy))));    // fore/aft (section-view) elevation — Dolby/RP22 upper-layer convention
      s.dist = r0(Math.sqrt(horiz * horiz + Math.pow(s.z - o.ear, 2)));
      var t = CFG.ANGLE_TARGETS[s.channel];
      s.target = t || null;
      s.verdict = t ? angleVerdict(s, t) : { pass: 'pass', note: s.klass === 'sub' ? 'LFE — position for modal smoothing' : '' };
    });
    return { recipe: recipeKey, layout: L, speakers: spk, ear: o.ear, topZ: TOP_Z, la: la, mlp: mlp, subCount: n, opts: o };
  }
  function within(v, lo, hi, tol) { if (v >= lo && v <= hi) return 'pass'; if (v >= lo - tol && v <= hi + tol) return 'warn'; return 'fail'; }
  function angleVerdict(s, t) {
    var az = within(s.az, t.az[0], t.az[1], 8);
    var elv = /^top/.test(s.klass) ? s.elFA : s.el;   // tops judged in the section plane
    var el = (t.el[0] === 0 && t.el[1] === 0) ? (Math.abs(elv) <= 10 ? 'pass' : Math.abs(elv) <= 20 ? 'warn' : 'fail') : within(elv, t.el[0], t.el[1], 8);
    var worst = (az === 'fail' || el === 'fail') ? 'fail' : (az === 'warn' || el === 'warn') ? 'warn' : 'pass';
    var notes = [];
    if (az !== 'pass') notes.push('az ' + s.az + '° vs ' + t.az[0] + '–' + t.az[1] + '°');
    if (el !== 'pass') notes.push('elev ' + elv + '° vs ' + (t.el[0] === 0 && t.el[1] === 0 ? '≈0°' : t.el[0] + '–' + t.el[1] + '°'));
    return { pass: worst, az: az, el: el, note: notes.join(' · ') || t.note };
  }
  // Ear-level channel count summary for a recipe ("channels required" maths)
  function channelSummary(recipeKey) {
    var L = layouts()[recipeKey]; if (!L) return null;
    var g = { screen: 0, wide: 0, surround: 0, back: 0, top: 0, height: 0 };
    L.channels.forEach(function (c) { var k = CFG.klassOf(c); if (/^top/.test(k)) g.top++; else if (g[k] != null) g[k]++; });
    return { discrete: L.discrete, groups: g, channels: L.channels, desc: L.desc };
  }

  global.CinemaToolsEngine = {
    IN: IN, FT: FT, aspectR: aspectR, video: video, layouts: layouts, layoutKeys: layoutKeys, chanName: chanName,
    screen: screen, convertAspect: convertAspect, bars: bars, fitToWall: fitToWall,
    hFov: hFov, distForFov: distForFov, widthForFov: widthForFov, fovVerdict: fovVerdict, ppd: ppd, resVerdict: resVerdict, vertical: vertical, distanceTable: distanceTable,
    throwDist: throwDist, throwRatio: throwRatio, widthFromThrow: widthFromThrow, footLamberts: footLamberts, requiredLumens: requiredLumens, brightnessVerdict: brightnessVerdict,
    riser: riser, room: room, placeLayout: placeLayout, channelSummary: channelSummary
  };
})(typeof window !== 'undefined' ? window : this);
