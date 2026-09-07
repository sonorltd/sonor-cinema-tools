// cinema-tools-app.js — Cinema Tools (Sonor) UI
// ─────────────────────────────────────────────────────────────────────────────
// Stripped-down quick-calc companion to Cinema Design (CD). One state object
// (cfg) drives seven tools; every tab re-uses the same room/seating/screen
// figures so the numbers never disagree with each other. Output = the same
// strip + scale SVG plan the Seating Configurator produces, plus a section.
//
// Writes ONLY cinema_tools_configs (+ projects.metadata.cinema_tools via the
// sonor_merge_project_metadata RPC when an option is marked FINAL). Reads
// cinema_designs / seating_configs / projects to prefill — never writes them.
(function (global) {
  'use strict';

  var CFG = global.__CINEMA_TOOLS_CONFIG__, E = null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var r0 = function (n) { return Math.round(n); }, r1 = function (n) { return Math.round(n * 10) / 10; }, r2 = function (n) { return Math.round(n * 100) / 100; };
  var mm = function (n) { return n == null ? '—' : r0(n).toLocaleString('en-GB') + ' mm'; };
  var inch = function (n) { return n == null ? '—' : r1(n) + '"'; };
  var m = function (n) { return n == null ? '—' : r2(n / 1000) + ' m'; };
  var chip = function (p, t) { return '<span class="vc ' + (p || 'pass') + '">' + esc(t || (p === 'pass' ? 'PASS' : p === 'warn' ? 'MARGINAL' : 'FAIL')) + '</span>'; };
  var TABS = [
    { id: 'screen',    n: 'Screen' },
    { id: 'viewing',   n: 'Viewing' },
    { id: 'projector', n: 'Projector' },
    { id: 'riser',     n: 'Riser' },
    { id: 'room',      n: 'Room' },
    { id: 'audio',     n: 'Audio' },
    { id: 'output',    n: 'Output' }
  ];
  var D = CFG.DEFAULTS;

  // ── STATE ────────────────────────────────────────────────────────────────
  var cfg = freshCfg();
  var ctx = { design: null, seating: null, project: null, final: null, saved: [] };
  var CLIENT = /[?&]client=1/.test(location.search);
  function freshCfg() {
    return {
      projectId: null, projectName: '', label: '', _savedId: null, _savedLabel: null, _isFinal: false, tab: 'screen', notes: '',
      room: { w: D.room.w, d: D.room.d, h: D.room.h },
      screen: { aspect: D.screen.aspect, diagIn: D.screen.diagIn, bottomAfl: D.screen.bottomAfl, wallVoid: D.screen.wallVoid, contentRes: '4k', solveBy: 'diagIn', wMm: null, hMm: null, diagMm: null },
      seating: { rows: 2, perRow: 4, perW: D.seat.perW, depth: D.seat.depth, recline: D.seat.recline, pitch: D.seat.pitch, firstRowDist: 3600, eyeAfl: D.seat.eyeAfl, earAfl: D.seat.earAfl, refRow: 1, sideClear: D.seat.sideClear },
      projector: { throwRatio: D.projector.throwRatio, lumens: D.projector.lumens, gain: D.projector.gain, ceilingDrop: D.projector.ceilingDropMm, mode: 'ratio', throwMm: null },
      riser: { clearance: D.riser.clearance, headTop: D.seat.headTopAboveEye, stepPref: D.riser.stepPref, stepMax: D.riser.stepMax },
      audio: { recipe: D.audio.recipe, subCount: D.audio.subCount, subPos: D.audio.subPos, surrPos: 'side', topElevDeg: D.audio.topElevDeg, surroundElevDeg: D.audio.surroundElevDeg, frontMode: 'la', frontAngleDeg: 26, sideClear: 150, rearClear: 200, ceilDrop: 0, format: 'rp22' }
    };
  }
  function dbc() { try { return (global.__CT_DB__ && global.__CT_DB__.client) || (global.db && global.db.client) || null; } catch (e) { return null; } }
  function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, cfg); }
  function set(path, v) {
    var ks = path.split('.'), o = cfg;
    for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = v;
    if (path === 'screen.diagIn') cfg.screen.solveBy = 'diagIn';
    if (path === 'screen.wMm') cfg.screen.solveBy = 'wMm';
    if (path === 'screen.hMm') cfg.screen.solveBy = 'hMm';
    if (path === 'screen.diagMm') cfg.screen.solveBy = 'diagMm';
    if (path === 'projector.throwMm') cfg.projector.mode = 'dist';
    if (path === 'projector.throwRatio') cfg.projector.mode = 'ratio';
    draftSave(); renderResults();
  }

  // ── DERIVED ──────────────────────────────────────────────────────────────
  function scr() {
    var s = cfg.screen, g = {};
    g[s.solveBy] = +s[s.solveBy];
    var out = E.screen(s.aspect, g) || E.screen(s.aspect, { diagIn: 120 });
    // keep the other fields in step so any tab can read them
    s.wMm = r0(out.w); s.hMm = r0(out.h); s.diagMm = r0(out.diag); if (s.solveBy !== 'diagIn') s.diagIn = r1(out.diagIn);
    return out;
  }
  function rowDist(i) { return cfg.seating.firstRowDist + i * cfg.seating.pitch; }   // eye → screen surface
  function screenY() { return cfg.screen.wallVoid; }                                 // screen surface from front wall
  function eyeY(i) { return screenY() + rowDist(i); }                                 // eye y in room coords
  function rowRun() { return cfg.seating.perRow * cfg.seating.perW; }
  // seat footprint around the eye: head sits ~300 mm forward of the seat rear
  function seatSpan(i) { var e = eyeY(i), d = cfg.seating.depth; return { y0: e - (d - 300), y1: e + 300 }; }
  function la() { var s = cfg.seating, run = rowRun(); return { x: r0((cfg.room.w - run) / 2), w: run, y: r0(eyeY(0) - 400), h: r0((s.rows - 1) * s.pitch + 800) }; }
  function mlp() { var i = Math.min(cfg.seating.rows, Math.max(1, cfg.seating.refRow | 0)) - 1; return { x: cfg.room.w / 2, y: r0(eyeY(i)), row: i + 1 }; }
  function throwMm() { var p = cfg.projector, s = scr(); return p.mode === 'dist' && p.throwMm > 0 ? +p.throwMm : p.throwRatio * s.w; }
  function riserRows() { var s = cfg.seating; return E.riser({ rows: s.rows, pitch: s.pitch, firstRowDist: s.firstRowDist, eyeAfl: s.eyeAfl, headTopAboveEye: cfg.riser.headTop, clearance: cfg.riser.clearance, screenBottomAfl: cfg.screen.bottomAfl, stepPref: cfg.riser.stepPref, stepMax: cfg.riser.stepMax }); }
  function audioLayout() {
    var a = cfg.audio;
    return E.placeLayout(a.recipe, cfg.room, la(), mlp(), { ear: cfg.seating.earAfl, frontY: cfg.screen.wallVoid > 0 ? Math.max(60, cfg.screen.wallVoid - 100) : 60, sideClear: a.sideClear, rearClear: a.rearClear, topElevDeg: a.topElevDeg, surroundElevDeg: a.surroundElevDeg, ceilDrop: a.ceilDrop, subCount: a.subCount, subPos: a.subPos, surrPos: a.surrPos, frontMode: a.frontMode, frontAngleDeg: a.frontAngleDeg });
  }
  function fitFlags() {
    var s = cfg.seating, f = [];
    var lastSeatRear = seatSpan(s.rows - 1).y1;
    if (lastSeatRear + D.seat.rearClear > cfg.room.d) f.push({ p: 'fail', t: 'Rear row runs ' + mm(lastSeatRear + D.seat.rearClear - cfg.room.d) + ' past the rear wall allowance' });
    var side = (cfg.room.w - rowRun()) / 2;
    if (side < 0) f.push({ p: 'fail', t: 'Row is ' + mm(-side) + ' wider than the room' });
    else if (side < s.sideClear) f.push({ p: 'warn', t: 'Tight — only ' + mm(side) + ' each side (want ≥ ' + s.sideClear + ')' });
    var S = scr(); if (S.w > cfg.room.w - 300) f.push({ p: 'warn', t: 'Screen leaves < 150 mm each side of the wall' });
    if (cfg.screen.bottomAfl + S.h > cfg.room.h - 100) f.push({ p: 'fail', t: 'Screen top ' + mm(cfg.screen.bottomAfl + S.h) + ' AFL exceeds ceiling' });
    return f;
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────
  function boot() {
    E = global.CinemaToolsEngine;
    draftLoad();
    renderPills(); renderTab();
    initProjectBar(0);
    var url = new URLSearchParams(location.search);
    if (url.get('config')) setTimeout(function () { openSaved(url.get('config')); }, 1200);
    var note = $('sourceNote'); if (note) { note.textContent = (global.SonorRP22 ? 'RP22 ' + (global.SonorRP22.__version || '') : 'RP22 fallback') + ' · ' + (global.SonorRP23 ? 'RP23 ' + (global.SonorRP23.__version || '') : 'video fallback'); note.className = 'src-note src-supabase'; }
  }
  function draftSave() { try { localStorage.setItem('sonor_cinema_tools_draft', JSON.stringify(cfg)); } catch (e) {} }
  function draftLoad() { try { var s = localStorage.getItem('sonor_cinema_tools_draft'); if (s) { var o = JSON.parse(s); var f = freshCfg(); ['room', 'screen', 'seating', 'projector', 'riser', 'audio'].forEach(function (k) { Object.assign(f[k], o[k] || {}); }); f.label = o.label || ''; f.notes = o.notes || ''; f._savedId = o._savedId || null; f._savedLabel = o._savedLabel || null; f._isFinal = !!o._isFinal; f.tab = o.tab || 'screen'; cfg = f; } } catch (e) {} }

  // ── PROJECT BAR + CONTEXT ────────────────────────────────────────────────
  function initProjectBar(attempt) {
    var bar = global.SonorProjectBar, db = dbc();
    if ((!bar || !db) && attempt < 6) { setTimeout(function () { initProjectBar(attempt + 1); }, 1000); return; }
    if (!bar || !db) { renderOverview(); return; }
    try {
      bar.init({ supa: db, appKey: CFG.appKey, host: $('projectBarHost'), onChange: onProject });
      var pid = bar.getActiveId && bar.getActiveId();
      if (pid) onProject({ currentId: pid, project: bar.getProject && bar.getProject(pid) }); else renderOverview();
    } catch (e) { renderOverview(); }
  }
  async function onProject(detail) {
    var newId = detail && detail.currentId || null;
    if (newId !== cfg.projectId) { cfg._savedId = null; cfg._savedLabel = null; cfg._isFinal = false; }
    cfg.projectId = newId; ctx.project = detail && detail.project || null;
    cfg.projectName = ctx.project ? (ctx.project.name || '') : '';
    await pullContext();
    await loadSaved();
    renderOverview(); renderTab();
  }
  async function pullContext() {
    var db = dbc(); ctx.design = null; ctx.seating = null; ctx.final = null;
    if (!db || !cfg.projectId) return;
    try {
      var q = await db.from('cinema_designs').select('id,name,room_width,room_depth,room_height,seat_count,atmos_config,display_mode,sub_count,seat_eye_height,ct_state,updated_at').eq('project_id', cfg.projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (q.data) ctx.design = q.data;
    } catch (e) {}
    try {
      var s = await db.from('seating_configs').select('id,label,range_id,config,updated_at').eq('project_id', cfg.projectId).eq('archived', false).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (s.data) ctx.seating = s.data;
    } catch (e) {}
    try {
      var p = await db.from('projects').select('metadata').eq('id', cfg.projectId).maybeSingle();
      ctx.final = (p.data && p.data.metadata && p.data.metadata[CFG.METADATA_KEY]) || null;
    } catch (e) {}
  }
  // Adopt CD's room + screen + seating figures into the calculator
  function adoptFromCD() {
    var d = ctx.design; if (!d) return;
    if (d.room_width) cfg.room.w = d.room_width; if (d.room_depth) cfg.room.d = d.room_depth; if (d.room_height) cfg.room.h = d.room_height;
    var md = (d.ct_state && d.ct_state.metadata) || {};
    var rm = (d.ct_state && d.ct_state.room) || {};
    if (rm.screenWallDepth) cfg.screen.wallVoid = rm.screenWallDepth;
    var scn = md.screen || (d.ct_state && d.ct_state.screen) || null;   // CT keeps the screen under metadata.screen
    if (scn && scn.w && scn.h) { cfg.screen.solveBy = 'wMm'; cfg.screen.wMm = scn.w; cfg.screen.aspect = nearestAspect(scn.w / scn.h); if (scn.bottomFromFloor) cfg.screen.bottomAfl = scn.bottomFromFloor; }
    else if (/^pj-(\d+)/.test(d.display_mode || '')) { cfg.screen.solveBy = 'diagIn'; cfg.screen.diagIn = +RegExp.$1; }
    if (md.seating) { if (md.seating.pitch >= 1000) cfg.seating.pitch = md.seating.pitch; if (md.seating.mlpDist) cfg.seating.firstRowDist = md.seating.mlpDist - cfg.screen.wallVoid; if (md.seating.earHeight) cfg.seating.earAfl = md.seating.earHeight; }
    if (d.seat_eye_height) cfg.seating.eyeAfl = d.seat_eye_height;
    if (d.seat_count) cfg.seating.perRow = d.seat_count;
    if (md.projector && md.projector.throwRatio) { cfg.projector.throwRatio = md.projector.throwRatio; cfg.projector.mode = 'ratio'; }
    if (md.video) { if (md.video.projLumens) cfg.projector.lumens = md.video.projLumens; if (md.video.screenGain) cfg.projector.gain = md.video.screenGain; if (md.video.contentRes) cfg.screen.contentRes = md.video.contentRes; }
    var recipe = md.speakerRecipe || (md.audio && md.audio.atmosConfig) || d.atmos_config;
    if (recipe && E.layouts()[recipe]) cfg.audio.recipe = recipe;
    if (d.sub_count) cfg.audio.subCount = d.sub_count;
    if (md.audio && md.audio.subPos) cfg.audio.subPos = md.audio.subPos === 'front' ? 'front' : md.audio.subPos === 'rear' ? 'rear' : 'opposite';
    if (md.audio && md.audio.surroundPos === 'rear') cfg.audio.surrPos = 'rear';
    draftSave(); renderTab(); toast('Adopted room, screen, seating and audio from Cinema Design (' + esc(d.name || '') + ')');
  }
  function adoptFromSeating() {
    var s = ctx.seating; if (!s) return;
    var L = (s.config && s.config.layout) || {};
    if (L.rows) cfg.seating.rows = L.rows; if (L.seatsPerRow) cfg.seating.perRow = L.seatsPerRow;
    if (L.widthMm) cfg.room.w = L.widthMm; if (L.lengthMm) cfg.room.d = L.lengthMm;
    draftSave(); renderTab(); toast('Adopted rows × seats from seating config “' + esc(s.label) + '”');
  }
  function nearestAspect(r) { var best = CFG.ASPECTS[0]; CFG.ASPECTS.forEach(function (a) { if (Math.abs(a.r - r) < Math.abs(best.r - r)) best = a; }); return best.id; }

  // ── SAVED OPTIONS (cinema_tools_configs) ─────────────────────────────────
  async function loadSaved() {
    var db = dbc(); ctx.saved = []; if (!db) return;
    try {
      var q = db.from(CFG.TABLE).select('id,label,app_version,is_final,updated_at,config').eq('archived', false).order('updated_at', { ascending: false }).limit(30);
      var r = await (cfg.projectId ? q.eq('project_id', cfg.projectId) : q.is('project_id', null));
      if (!r.error) ctx.saved = r.data || [];
    } catch (e) {}
    renderSavedPanel();
  }
  async function saveOption(asNew) {
    var db = dbc(); if (!db) { toast('Supabase not connected — option kept as local draft', 'warn'); return; }
    var label = (cfg.label || '').trim() || defaultLabel();
    cfg.label = label;
    var body = { project_id: cfg.projectId, project_name: cfg.projectName || null, label: label, config: stripCfg(), app_version: CFG.version, updated_at: new Date().toISOString() };
    try {
      var res;
      if (cfg._savedId && !asNew) res = await db.from(CFG.TABLE).update(body).eq('id', cfg._savedId).select('id').single();
      else res = await db.from(CFG.TABLE).insert(body).select('id').single();
      if (res.error) throw res.error;
      cfg._savedId = res.data.id; cfg._savedLabel = label;
      if (cfg._isFinal && !asNew) await publishFinal();   // keep CD's copy current
      draftSave(); await loadSaved(); renderOverview(); toast('Saved “' + esc(label) + '”');
    } catch (e) { toast('Save failed: ' + (e.message || e), 'fail'); }
  }
  function stripCfg() { var c = JSON.parse(JSON.stringify(cfg)); delete c._savedId; delete c._savedLabel; delete c._isFinal; delete c.tab; return c; }
  function defaultLabel() { var s = scr(); return r0(s.diagIn) + '" ' + cfg.screen.aspect + ' · ' + cfg.seating.rows + '×' + cfg.seating.perRow + ' · ' + cfg.audio.recipe; }
  async function openSaved(id) {
    var db = dbc(); if (!db) return;
    try {
      var r = await db.from(CFG.TABLE).select('id,label,is_final,config,project_id').eq('id', id).single();
      if (r.error) throw r.error;
      var f = freshCfg(); var o = r.data.config || {};
      ['room', 'screen', 'seating', 'projector', 'riser', 'audio'].forEach(function (k) { Object.assign(f[k], o[k] || {}); });
      f.label = r.data.label; f.notes = o.notes || ''; f._savedId = r.data.id; f._savedLabel = r.data.label; f._isFinal = !!r.data.is_final;
      f.projectId = cfg.projectId || r.data.project_id; f.projectName = cfg.projectName; f.tab = 'output';
      cfg = f; draftSave(); enter(); renderTab(); toast('Opened “' + esc(r.data.label) + '”');
    } catch (e) { toast('Could not open option: ' + (e.message || e), 'fail'); }
  }
  async function renameSaved(id, cur) {
    var n = prompt('Rename option', cur || ''); if (!n) return;
    var db = dbc(); await db.from(CFG.TABLE).update({ label: n, updated_at: new Date().toISOString() }).eq('id', id);
    if (cfg._savedId === id) { cfg.label = n; cfg._savedLabel = n; if (cfg._isFinal) await publishFinal(); }
    loadSaved(); renderOverview();
  }
  async function archiveSaved(id) {
    if (!confirm('Archive this option? It stays in the database but leaves the list.')) return;
    var db = dbc(); await db.from(CFG.TABLE).update({ archived: true, is_final: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (cfg._savedId === id) { cfg._savedId = null; cfg._isFinal = false; }
    loadSaved(); renderOverview();
  }
  // ── FINAL OPTION → projects.metadata.cinema_tools (CD reads this) ────────
  async function setFinal(id) {
    var db = dbc(); if (!db || !cfg.projectId) { toast('Select a project first', 'warn'); return; }
    if (id && id !== cfg._savedId) { await openSaved(id); }
    if (!cfg._savedId) { await saveOption(false); if (!cfg._savedId) return; }
    try {
      await db.from(CFG.TABLE).update({ is_final: false }).eq('project_id', cfg.projectId).eq('is_final', true);
      await db.from(CFG.TABLE).update({ is_final: true, updated_at: new Date().toISOString() }).eq('id', cfg._savedId);
      cfg._isFinal = true; await publishFinal(); draftSave(); await loadSaved(); await pullContext(); renderOverview(); renderTab();
      toast('★ “' + esc(cfg.label) + '” is now the FINAL option — Cinema Design will show the link');
    } catch (e) { toast('Could not set final: ' + (e.message || e), 'fail'); }
  }
  async function clearFinal() {
    var db = dbc(); if (!db || !cfg.projectId) return;
    await db.from(CFG.TABLE).update({ is_final: false }).eq('project_id', cfg.projectId).eq('is_final', true);
    var patch = {}; patch[CFG.METADATA_KEY] = null;
    try { await db.rpc('sonor_merge_project_metadata', { p_project_id: cfg.projectId, p_patch: patch }); } catch (e) {}
    cfg._isFinal = false; draftSave(); await loadSaved(); await pullContext(); renderOverview(); renderTab(); toast('Final option cleared');
  }
  function finalSpec() {
    var S = scr(), A = audioLayout(), R = riserRows(), fov = E.hFov(S.w, rowDist(mlp().row - 1));
    return {
      source: CFG.appKey, app_version: CFG.version, config_id: cfg._savedId, label: cfg.label, chosen_at: new Date().toISOString(),
      room: { w: cfg.room.w, d: cfg.room.d, h: cfg.room.h },
      screen: { aspect: cfg.screen.aspect, w: r0(S.w), h: r0(S.h), diag_in: r1(S.diagIn), bottom_afl: cfg.screen.bottomAfl, wall_void: cfg.screen.wallVoid, content_res: cfg.screen.contentRes },
      seating: { rows: cfg.seating.rows, per_row: cfg.seating.perRow, per_w: cfg.seating.perW, pitch: cfg.seating.pitch, first_row_dist: cfg.seating.firstRowDist, eye_afl: cfg.seating.eyeAfl, ear_afl: cfg.seating.earAfl, mlp: mlp(), listening_area: la(), h_fov_mlp: r1(fov) },
      projector: { throw_ratio: r2(throwMm() / S.w), throw_mm: r0(throwMm()), lumens: cfg.projector.lumens, gain: cfg.projector.gain, fl: r1(E.footLamberts(cfg.projector.lumens, cfg.projector.gain, S.areaFt2)) },
      riser: R.map(function (r) { return { row: r.row, dist: r0(r.dist), build: r.riserBuild }; }),
      audio: { recipe: cfg.audio.recipe, sub_count: A.subCount, sub_pos: cfg.audio.subPos, speakers: A.speakers.map(function (s) { return { channel: s.channel, x: s.x, y: s.y, zMm: s.z, klass: s.klass, az: s.az, el: s.el }; }) }
    };
  }
  async function publishFinal() {
    var db = dbc(); if (!db || !cfg.projectId) return;
    var patch = {}; patch[CFG.METADATA_KEY] = finalSpec();
    var r = await db.rpc('sonor_merge_project_metadata', { p_project_id: cfg.projectId, p_patch: patch });
    if (r.error) throw r.error;
  }

  // ── NAV ──────────────────────────────────────────────────────────────────
  function enter() { $('intro').style.display = 'none'; $('wizard').style.display = 'flex'; window.scrollTo(0, 0); }
  function backToIntro() { $('wizard').style.display = 'none'; $('intro').style.display = 'block'; renderOverview(); }
  function go(tab) { cfg.tab = tab; draftSave(); renderPills(); renderTab(); }
  function renderPills() {
    var host = $('stepPills'); if (!host) return;
    host.innerHTML = TABS.map(function (t, i) { return '<div class="pill ' + (cfg.tab === t.id ? 'active' : 'done') + '" onclick="CinemaToolsApp.go(\'' + t.id + '\')"><span class="pn">' + (i + 1) + '</span>' + t.n + '</div>' + (i < TABS.length - 1 ? '<span class="parr">›</span>' : ''); }).join('');
  }
  function toast(msg, kind) { if (global.SonorShell && SonorShell.toast) { SonorShell.toast(msg.replace(/<[^>]+>/g, ''), { kind: kind === 'fail' ? 'error' : kind || 'ok' }); return; } var t = $('ctToast'); if (!t) return; t.innerHTML = msg; t.className = 'ct-toast show ' + (kind || 'ok'); clearTimeout(t._t); t._t = setTimeout(function () { t.className = 'ct-toast'; }, 3200); }

  // ── FIELD HELPERS ────────────────────────────────────────────────────────
  function num(path, label, opts) {
    opts = opts || {}; var v = get(path);
    return '<label class="fld2"><span>' + esc(label) + (opts.unit ? ' <em>' + esc(opts.unit) + '</em>' : '') + '</span><input type="number" ' + (opts.step ? 'step="' + opts.step + '"' : '') + ' ' + (opts.min != null ? 'min="' + opts.min + '"' : '') + ' value="' + (v == null ? '' : v) + '" onchange="CinemaToolsApp.set(\'' + path + '\', +this.value)"></label>';
  }
  function sel(path, label, options) {
    var v = get(path);
    return '<label class="fld2"><span>' + esc(label) + '</span><select onchange="CinemaToolsApp.set(\'' + path + '\', this.value)">' + options.map(function (o) { return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(v) ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select></label>';
  }
  function opts(path, label, options) {
    var v = get(path);
    return '<div class="lbl">' + esc(label) + '</div><div class="opts">' + options.map(function (o) { return '<button class="opt' + (String(o.v) === String(v) ? ' on' : '') + '" onclick="CinemaToolsApp.set(\'' + path + '\',' + (typeof o.v === 'number' ? o.v : '\'' + o.v + '\'') + ')">' + esc(o.l) + '</button>'; }).join('') + '</div>';
  }
  function panel(title, body, extra) { return '<div class="panel' + (extra ? ' ' + extra : '') + '"><div class="ptt">' + title + '</div>' + body + '</div>'; }
  function roomFields() { return panel('Room', num('room.w', 'Width', { unit: 'mm' }) + num('room.d', 'Depth', { unit: 'mm' }) + num('room.h', 'Height', { unit: 'mm' }) + contextButtons()); }
  function contextButtons() {
    var b = '';
    if (ctx.design) b += '<button class="ghost sm" onclick="CinemaToolsApp.adoptFromCD()">↙ Adopt from Cinema Design (' + esc(ctx.design.name || 'design') + ')</button> ';
    if (ctx.seating) b += '<button class="ghost sm" onclick="CinemaToolsApp.adoptFromSeating()">↙ Seating config “' + esc(ctx.seating.label) + '”</button>';
    return b ? '<div class="hint" style="margin-top:10px">' + b + '</div>' : '';
  }

  // ── TAB RENDER ───────────────────────────────────────────────────────────
  function renderTab() {
    var body = $('stepBody'); if (!body) return;
    var t = cfg.tab, left = '', title = '', lead = '';
    if (t === 'screen') {
      title = 'Screen <span class="lt">size</span>.'; lead = 'Solve from any one figure — diagonal, width or height — for any aspect ratio, and see what the same screen gives you in every other format.';
      left = panel('Solve from', sel('screen.aspect', 'Aspect ratio', CFG.ASPECTS.map(function (a) { return { v: a.id, l: a.label }; })) +
        '<div class="solve-grid">' + num('screen.diagIn', 'Diagonal', { unit: 'in', step: 0.5 }) + num('screen.diagMm', 'Diagonal', { unit: 'mm' }) + num('screen.wMm', 'Width', { unit: 'mm' }) + num('screen.hMm', 'Height', { unit: 'mm' }) + '</div>' +
        '<div class="hint">Last field edited wins (currently: <b>' + esc({ diagIn: 'diagonal in', diagMm: 'diagonal mm', wMm: 'width', hMm: 'height' }[cfg.screen.solveBy]) + '</b>).</div>' +
        num('screen.bottomAfl', 'Screen bottom AFL', { unit: 'mm' }) + num('screen.wallVoid', 'Screen wall void / baffle depth', { unit: 'mm' }) +
        sel('screen.contentRes', 'Content resolution', [{ v: '1080p', l: '1080p' }, { v: '4k', l: '4K UHD' }, { v: '8k', l: '8K' }])) + roomFields();
    } else if (t === 'viewing') {
      title = 'Viewing <span class="lt">distances</span>.'; lead = 'Horizontal field of view per row against SMPTE / THX / CEB23 / ITU bands, pixel density for the content resolution, and vertical sightlines to the screen top.';
      left = panel('Seating', num('seating.rows', 'Rows', { min: 1 }) + num('seating.perRow', 'Seats per row', { min: 1 }) + num('seating.firstRowDist', 'Row 1 eye → screen', { unit: 'mm' }) + num('seating.pitch', 'Row pitch', { unit: 'mm' }) + num('seating.eyeAfl', 'Seated eye height AFL', { unit: 'mm' }) + opts('seating.refRow', 'Reference row (MLP)', rowsOpts()) + contextButtons()) + roomFields();
    } else if (t === 'projector') {
      title = 'Projector <span class="lt">throw & brightness</span>.'; lead = 'Throw ratio ↔ throw distance ↔ image width, plus on-screen foot-lamberts from lumens and gain against the SMPTE 196M reference band.';
      left = panel('Throw', num('projector.throwRatio', 'Throw ratio', { step: 0.01 }) + num('projector.throwMm', 'Throw distance (lens → screen)', { unit: 'mm' }) + '<div class="hint">Edit either — the other is solved from the screen width (' + mm(scr().w) + '). Mode: <b>' + (cfg.projector.mode === 'dist' ? 'distance' : 'ratio') + '</b>.</div>' + num('projector.ceilingDrop', 'Lens drop below ceiling', { unit: 'mm' })) +
        panel('Brightness', num('projector.lumens', 'Projector output', { unit: 'ANSI lm' }) + num('projector.gain', 'Screen gain', { step: 0.1 }));
    } else if (t === 'riser') {
      title = 'Riser <span class="lt">heights</span>.'; lead = 'Every row\'s eye clears the head of the row in front to the screen bottom. Build heights round up to your step preference; risers over 220 mm split into steps (Part K).';
      left = panel('Sightline rule', num('riser.headTop', 'Head-top above eye', { unit: 'mm' }) + num('riser.clearance', 'Clearance over head', { unit: 'mm' }) + num('riser.stepPref', 'Round build heights to', { unit: 'mm' }) + num('riser.stepMax', 'Max single step', { unit: 'mm' })) +
        panel('Seating', num('seating.rows', 'Rows', { min: 1 }) + num('seating.firstRowDist', 'Row 1 eye → screen', { unit: 'mm' }) + num('seating.pitch', 'Row pitch', { unit: 'mm' }) + num('seating.eyeAfl', 'Seated eye height AFL', { unit: 'mm' }) + num('screen.bottomAfl', 'Screen bottom AFL', { unit: 'mm' }));
    } else if (t === 'room') {
      title = 'Room <span class="lt">proportions</span>.'; lead = 'Ratio check against Sepmeyer / Louden / Bolt-area classics, first axial modes per axis with coincidence flags, and the Schroeder frequency.';
      left = roomFields();
    } else if (t === 'audio') {
      title = 'Audio <span class="lt">layout</span>.'; lead = 'CEDIA/CTA-RP22 Appendix E recipe placed against this room + listening area, colour-coded exactly as Cinema Design, with azimuth / elevation from the MLP checked against the RP22 bands.';
      left = panel('Layout', sel('audio.recipe', 'Recipe (RP22 App. E)', E.layoutKeys().map(function (k) { return { v: k, l: k + ' — ' + E.layouts()[k].desc.replace(/\s*\(RP22[^)]*\)/, '') }; })) +
        opts('audio.subCount', 'Subwoofers', [{ v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 4, l: '4 (SBA)' }]) +
        opts('audio.subPos', 'Sub position', [{ v: 'opposite', l: 'Opposite corners' }, { v: 'front', l: 'Front pair' }, { v: 'rear', l: 'Rear pair' }]) +
        opts('audio.surrPos', '5.x surround pair', [{ v: 'side', l: 'Side walls' }, { v: 'rear', l: 'Rear wall' }]) +
        opts('audio.frontMode', 'FL / FR placement', [{ v: 'la', l: 'Listening-area edge (CD)' }, { v: 'angle', l: 'By angle' }]) + (cfg.audio.frontMode === 'angle' ? num('audio.frontAngleDeg', 'FL / FR azimuth', { unit: '°' }) : '') +
        opts('audio.format', 'Labels', [{ v: 'rp22', l: 'RP22' }, { v: 'atmos', l: 'Atmos' }, { v: 'name', l: 'Names' }])) +
        panel('Geometry', num('seating.earAfl', 'Ear height AFL', { unit: 'mm' }) + num('audio.topElevDeg', 'Top layer elevation target', { unit: '°' }) + num('audio.surroundElevDeg', 'Surround elevation', { unit: '°' }) + num('audio.ceilDrop', 'Ceiling drop (coffer / soffit)', { unit: 'mm' }) + num('audio.sideClear', 'Speaker → side wall', { unit: 'mm' }) + num('audio.rearClear', 'Speaker → rear wall', { unit: 'mm' }) + opts('seating.refRow', 'Reference row (MLP)', rowsOpts()) + contextButtons());
    } else if (t === 'output') {
      title = 'Design <span class="lt">option</span>.'; lead = 'Everything above on one sheet — the same strip + scale plan the Seating Configurator produces, with a section, the audio schedule and the numbers Cinema Design will reference.';
      left = panel('This option', '<label class="fld2"><span>Label</span><input type="text" value="' + esc(cfg.label) + '" placeholder="' + esc(defaultLabel()) + '" onchange="CinemaToolsApp.setLabel(this.value)"></label><label class="fld2 col"><span>Notes</span><textarea rows="3" onchange="CinemaToolsApp.setNotes(this.value)">' + esc(cfg.notes) + '</textarea></label>' +
        '<div class="actions" style="margin-top:12px;flex-wrap:wrap"><button class="btn primary" onclick="CinemaToolsApp.saveOption(false)">' + (cfg._savedId ? 'Save changes' : 'Save option') + '</button>' + (cfg._savedId ? '<button class="btn ghost" onclick="CinemaToolsApp.saveOption(true)">Save as new</button>' : '') + '<button class="btn ghost" onclick="CinemaToolsApp.setFinal()" ' + (cfg._isFinal ? 'disabled' : '') + '>★ Set as FINAL for CD</button><button class="btn sec" onclick="window.print()">Print / PDF</button><button class="btn sec" onclick="CinemaToolsApp.downloadSVG()">Download plan SVG</button></div>' +
        finalBadge(), 'saved-panel') + '<div id="savedPanel"></div>';
    }
    body.innerHTML = '<div class="lead"><h2>' + title + '</h2><p>' + lead + '</p></div><div class="cfg-grid' + (t === 'output' ? ' out' : '') + '"><div class="cfg-left">' + left + '</div><div class="sticky" id="results"></div></div>';
    renderResults(); renderSavedPanel();
  }
  function rowsOpts() { var o = []; for (var i = 1; i <= cfg.seating.rows; i++) o.push({ v: i, l: 'Row ' + i }); return o; }
  function setLabel(v) { cfg.label = v; draftSave(); }
  function setNotes(v) { cfg.notes = v; draftSave(); }
  function finalBadge() {
    if (cfg._isFinal) return '<div class="final-note on">★ FINAL — published to <code>projects.metadata.' + CFG.METADATA_KEY + '</code>. Cinema Design shows the ● linked indicator. <a href="#" onclick="CinemaToolsApp.clearFinal();return false;">Clear</a></div>';
    if (ctx.final && ctx.final.config_id) return '<div class="final-note">Current final option for this project: <b>' + esc(ctx.final.label) + '</b> <a href="#" onclick="CinemaToolsApp.openSaved(\'' + ctx.final.config_id + '\');return false;">open</a></div>';
    return '';
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────
  function renderResults() {
    var host = $('results'); if (!host) return;
    var t = cfg.tab, S = scr(), h = '';
    var flags = fitFlags().map(function (f) { return '<div class="fitwarn ' + f.p + '">⚠ ' + esc(f.t) + '</div>'; }).join('');
    if (t === 'screen') {
      h += strip([['Width', mm(S.w), inch(S.wIn)], ['Height', mm(S.h), inch(S.hIn)], ['Diagonal', inch(S.diagIn), mm(S.diag)], ['Area', r2(S.areaM2) + ' m²', r1(S.areaFt2) + ' ft²'], ['Top AFL', mm(cfg.screen.bottomAfl + S.h), 'centre ' + mm(cfg.screen.bottomAfl + S.h / 2)]]);
      h += '<div class="svgcard">' + screenSVG(S) + '</div>';
      h += panel('Same screen, other formats', '<table class="tbl"><thead><tr><th>Ratio</th><th>CIH — constant height</th><th>CIW — constant width</th><th>Bars on this screen</th></tr></thead><tbody>' + CFG.ASPECTS.filter(function (a) { return a.id !== cfg.screen.aspect; }).map(function (a) {
        var cih = E.convertAspect(S, a.r, 'cih'), ciw = E.convertAspect(S, a.r, 'ciw'), b = E.bars(S, a.r);
        return '<tr><td>' + esc(a.id) + '</td><td class="mono">' + mm(cih.w) + ' × ' + mm(cih.h) + ' · ' + inch(cih.diagIn) + '</td><td class="mono">' + mm(ciw.w) + ' × ' + mm(ciw.h) + ' · ' + inch(ciw.diagIn) + '</td><td class="mono">' + (b.type === 'none' ? '—' : b.type + ' ' + mm(b.each) + ' each') + '</td></tr>';
      }).join('') + '</tbody></table>');
      var fit = E.fitToWall(cfg.screen.aspect, cfg.room.w, cfg.room.h, 150, cfg.screen.bottomAfl, 150);
      h += panel('Largest that fits this wall', '<div class="cv">' + inch(fit.screen.diagIn) + ' <span class="cn">' + esc(cfg.screen.aspect) + ' · ' + mm(fit.screen.w) + ' × ' + mm(fit.screen.h) + ' · limited by ' + fit.limitedBy + '</span></div><div class="hint">150 mm side margins · 150 mm above · bottom at ' + mm(cfg.screen.bottomAfl) + ' AFL. Row 1 at THX 36° would sit ' + mm(E.distForFov(fit.screen.w, 36)) + ' from it.</div>');
      h += panel('Common sizes — ' + esc(cfg.screen.aspect), '<table class="tbl"><thead><tr><th>Diag</th><th>Width</th><th>Height</th><th>36° THX dist</th><th>45° immersive</th></tr></thead><tbody>' + CFG.COMMON_TV_IN.concat(CFG.COMMON_PJ_IN).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }).map(function (d) { var s = E.screen(cfg.screen.aspect, { diagIn: d }); return '<tr' + (Math.abs(d - S.diagIn) < 0.6 ? ' class="cur"' : '') + '><td>' + d + '"</td><td class="mono">' + mm(s.w) + '</td><td class="mono">' + mm(s.h) + '</td><td class="mono">' + m(E.distForFov(s.w, 36)) + '</td><td class="mono">' + m(E.distForFov(s.w, 45)) + '</td></tr>'; }).join('') + '</tbody></table>');
    } else if (t === 'viewing') {
      var rows = [];
      for (var i = 0; i < cfg.seating.rows; i++) {
        var d = rowDist(i), fov = E.hFov(S.w, d), fv = E.fovVerdict(fov), rv = E.resVerdict(cfg.screen.contentRes, fov), vv = E.vertical(S, cfg.screen.bottomAfl, cfg.seating.eyeAfl, d);
        rows.push({ i: i, d: d, fov: fov, fv: fv, rv: rv, vv: vv });
      }
      var ref = rows[mlp().row - 1];
      h += strip([['MLP (row ' + mlp().row + ')', r1(ref.fov) + '°', ref.fv.band], ['Distance', mm(ref.d), r2(ref.d / S.w) + '× screen width'], ['Pixels / °', r0(ref.rv.ppd), cfg.screen.contentRes], ['Angle to top', '+' + r1(ref.vv.toTop) + '°', vv.note || ''], ['Rows', cfg.seating.rows + ' × ' + cfg.seating.perRow, cfg.seating.rows * cfg.seating.perRow + ' seats']]);
      h += flags + '<div class="svgcard">' + planSVG(false, { speakers: false }) + '</div>';
      h += panel('Per row', '<table class="tbl"><thead><tr><th>Row</th><th>Eye → screen</th><th>H FoV</th><th>Band</th><th>ppd</th><th>To top</th><th>Vertical</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr' + (r.i === mlp().row - 1 ? ' class="cur"' : '') + '><td>' + (r.i + 1) + '</td><td class="mono">' + mm(r.d) + '</td><td class="mono">' + r1(r.fov) + '°</td><td>' + chip(r.fv.pass, r.fv.band) + '</td><td class="mono">' + r0(r.rv.ppd) + ' ' + chip(r.rv.pass, r.rv.pass === 'pass' ? 'OK' : 'SOFT') + '</td><td class="mono">+' + r1(r.vv.toTop) + '°</td><td>' + chip(r.vv.pass, r.vv.pass === 'pass' ? 'COMFORT' : r.vv.pass === 'warn' ? 'SMPTE OK' : '> 35°') + '</td></tr>';
      }).join('') + '</tbody></table><div class="hint">Bands: THX floor 26° · SMPTE 30° · THX target 36° · CEB23 40° · immersive 45–60° (ITU UHD 58°). ≥ 60 ppd = pixel grid invisible. Vertical: SMPTE EG-18 ≤ 35° to screen top, comfort ≤ 15°.</div>');
      h += panel('Distance for this screen (' + mm(S.w) + ' wide)', '<table class="tbl"><thead><tr><th>Standard</th><th>Angle</th><th>Eye → screen</th></tr></thead><tbody>' + E.distanceTable(S).map(function (b) { return '<tr><td>' + esc(b.key) + '</td><td class="mono">' + b.fov + '°</td><td class="mono">' + mm(b.dist) + ' · ' + m(b.dist) + '</td></tr>'; }).join('') + '</tbody></table>');
    } else if (t === 'projector') {
      var td = throwMm(), tr = td / S.w, fl = E.footLamberts(cfg.projector.lumens, cfg.projector.gain, S.areaFt2), bv = E.brightnessVerdict(fl);
      var lensY = screenY() + td, L = E.video().luminance;
      h += strip([['Throw ratio', r2(tr) + ':1', cfg.projector.mode === 'dist' ? 'from distance' : 'input'], ['Throw distance', mm(td), 'lens → screen surface'], ['Lens from front wall', mm(lensY), mm(cfg.room.d - lensY) + ' from rear wall'], ['On-screen', r1(fl) + ' fL', r0(fl * L.flToNits) + ' nits'], ['Verdict', chip(bv.pass), bv.note]]);
      if (lensY > cfg.room.d - 150) h += '<div class="fitwarn block">⚠ Lens position ' + mm(lensY) + ' is beyond the rear wall (' + mm(cfg.room.d) + ') — needs a shorter-throw lens (≤ ' + r2((cfg.room.d - 300) / S.w) + ':1) or a smaller screen.</div>';
      var lastEye = eyeY(cfg.seating.rows - 1);
      if (lensY < lastEye + 600 && lensY > eyeY(0) - 600) h += '<div class="fitwarn tight">⚠ Lens sits over the seating — check hush box / noise and that the lens height clears the rear-row head-top (' + mm(cfg.seating.eyeAfl + cfg.riser.headTop + (riserRows()[cfg.seating.rows - 1] || {}).riserBuild) + ').</div>';
      h += '<div class="svgcard">' + sectionSVG() + '</div>';
      h += panel('Lumens needed for this screen (' + r1(S.areaFt2) + ' ft² · gain ' + cfg.projector.gain + ')', '<table class="tbl"><thead><tr><th>Target</th><th>fL</th><th>ANSI lumens</th></tr></thead><tbody>' + [['SMPTE 196M reference', L.sdrReferenceFl], ['Design initial (lamp ageing → 14 fL EOL)', L.designInitialFl], ['Some ambient light', L.ambientMinFl], ['High ambient / media room', L.ambientHighFl]].map(function (r) { return '<tr><td>' + r[0] + '</td><td class="mono">' + r[1] + '</td><td class="mono">' + r0(E.requiredLumens(r[1], cfg.projector.gain, S.areaFt2)).toLocaleString('en-GB') + '</td></tr>'; }).join('') + '</tbody></table><div class="hint">fL = lumens × gain ÷ ft². AT screens run ≈ 0.9–1.0 gain; ALR / grey screens raise perceived contrast, not lumens. Laser sources hold output — bulb projectors should be specified at design-initial.</div>');
      h += panel('Throw ratio → distance for this width', '<table class="tbl"><thead><tr><th>Ratio</th><th>Throw</th><th>Lens from front wall</th></tr></thead><tbody>' + [0.8, 1.0, 1.2, 1.4, 1.5, 1.7, 2.0, 2.4].map(function (r) { var dd = E.throwDist(r, S.w); return '<tr' + (Math.abs(r - tr) < 0.05 ? ' class="cur"' : '') + '><td class="mono">' + r.toFixed(2) + ':1</td><td class="mono">' + mm(dd) + '</td><td class="mono">' + mm(screenY() + dd) + (screenY() + dd > cfg.room.d ? ' ✗' : '') + '</td></tr>'; }).join('') + '</tbody></table>');
    } else if (t === 'riser') {
      var R = riserRows();
      h += strip(R.slice(0, 5).map(function (r) { return ['Row ' + r.row, mm(r.riserBuild), r.row === 1 ? 'floor' : 'needs ≥ ' + mm(r.riserRaw)]; }));
      h += flags + '<div class="svgcard">' + sectionSVG() + '</div>';
      h += panel('Riser schedule', '<table class="tbl"><thead><tr><th>Row</th><th>Eye → screen</th><th>Eye req. AFL</th><th>Riser (min)</th><th>Build</th><th>Rise from prev</th><th>Steps</th></tr></thead><tbody>' + R.map(function (r) { return '<tr><td>' + r.row + '</td><td class="mono">' + mm(r.dist) + '</td><td class="mono">' + mm(r.eyeReq) + '</td><td class="mono">' + mm(r.riserRaw) + '</td><td class="mono"><b>' + mm(r.riserBuild) + '</b></td><td class="mono">' + (r.row === 1 ? '—' : mm(r.riseFromPrev)) + '</td><td class="mono">' + (r.row === 1 ? '—' : r.steps + ' × ' + mm(r.stepH)) + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<div class="hint">Rule: eye of row n sees the screen bottom (' + mm(cfg.screen.bottomAfl) + ' AFL) over head-top (eye + ' + cfg.riser.headTop + ' mm) of row n−1 with ' + cfg.riser.clearance + ' mm clearance. Build rounds up to ' + cfg.riser.stepPref + ' mm. Steps > ' + cfg.riser.stepMax + ' mm split (Approved Doc K: 150–220 mm rise, ≥ 220 mm going). Lowering the screen or raising row 1\'s eye height reduces every riser.</div>');
    } else if (t === 'room') {
      var rm = E.room(cfg.room.w, cfg.room.d, cfg.room.h, 0.35);
      h += strip([['Volume', r1(rm.volM3) + ' m³', ''], ['Ratio (H:W:L)', '1 : ' + r2(rm.ratioW) + ' : ' + r2(rm.ratioL), 'nearest ' + rm.nearest.name], ['Schroeder', r0(rm.schroeder) + ' Hz', 'modal region below'], ['Floor area', r1(cfg.room.w * cfg.room.d / 1e6) + ' m²', ''], ['Cube risk', rm.cubeWarn ? chip('fail', 'YES') : chip('pass', 'NO'), rm.cubeWarn ? 'two dims within 5%' : '']]);
      if (rm.clashes.length) h += '<div class="fitwarn tight">⚠ Axial mode coincidences: ' + esc(rm.clashes.join(', ')) + ' — expect strong peaks; plan sub placement / EQ / bass traps accordingly.</div>';
      h += panel('Axial modes (first 4 per axis)', '<table class="tbl"><thead><tr><th>Axis</th><th>Length</th><th>1st</th><th>2nd</th><th>3rd</th><th>4th</th></tr></thead><tbody>' + [['Length', cfg.room.d, rm.modes.L], ['Width', cfg.room.w, rm.modes.W], ['Height', cfg.room.h, rm.modes.H]].map(function (r) { return '<tr><td>' + r[0] + '</td><td class="mono">' + mm(r[1]) + '</td>' + r[2].map(function (f) { return '<td class="mono">' + f + ' Hz</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><div class="hint">f = c·n ÷ 2L, c = 343 m/s. Even spacing between all axial modes below the Schroeder frequency is the goal; matching or near-matching frequencies across two axes stack.</div>');
      h += panel('Reference ratios (normalised to height 1)', '<table class="tbl"><thead><tr><th>Reference</th><th>W</th><th>L</th><th>For ' + mm(cfg.room.h) + ' ceiling</th><th>Δ</th></tr></thead><tbody>' + rm.refs.map(function (r, i) { return '<tr' + (i === 0 ? ' class="cur"' : '') + '><td>' + esc(r.name) + '</td><td class="mono">' + r.w + '</td><td class="mono">' + r.l + '</td><td class="mono">' + mm(r.w * cfg.room.h) + ' × ' + mm(r.l * cfg.room.h) + '</td><td class="mono">' + r2(r.err) + '</td></tr>'; }).join('') + '</tbody></table>');
    } else if (t === 'audio') {
      var A = audioLayout(), cs = E.channelSummary(cfg.audio.recipe);
      h += strip([['Recipe', cfg.audio.recipe, cs.discrete + ' discrete + ' + A.subCount + ' sub'], ['Screen', cs.groups.screen, 'LCR'], ['Surround', cs.groups.surround + cs.groups.back + cs.groups.wide, cs.groups.wide ? 'incl. ' + cs.groups.wide + ' wides' : ''], ['Upper', cs.groups.top + cs.groups.height, cs.groups.height ? cs.groups.height + ' on-wall' : 'in-ceiling'], ['MLP', 'row ' + A.mlp.row, mm(rowDist(A.mlp.row - 1)) + ' from screen']]);
      var fails = A.speakers.filter(function (s) { return s.verdict.pass === 'fail'; }).length, warns = A.speakers.filter(function (s) { return s.verdict.pass === 'warn'; }).length;
      if (fails || warns) h += '<div class="fitwarn ' + (fails ? 'block' : 'tight') + '">' + (fails ? '✗ ' + fails + ' channel' + (fails > 1 ? 's' : '') + ' outside RP22 angle bands' : '') + (fails && warns ? ' · ' : '') + (warns ? '⚠ ' + warns + ' marginal' : '') + ' — adjust listening-area / elevation targets or accept per RP22 PL tolerance.</div>';
      h += flags + '<div class="svgcard">' + planSVG(false, { speakers: true }) + '</div>';
      h += '<div class="legend">' + Object.keys(CFG.SPEAKER_KLASS).map(function (k) { return '<span><i style="background:' + CFG.SPEAKER_KLASS[k].hex + '"></i>' + esc(CFG.SPEAKER_KLASS[k].label) + '</span>'; }).join('') + '</div>';
      h += panel('Speaker schedule — positions from front-left corner, heights AFL', audioTable(A));
    } else if (t === 'output') {
      var A2 = audioLayout(), R2 = riserRows(), ref2 = rowDist(mlp().row - 1), fov2 = E.hFov(S.w, ref2), fl2 = E.footLamberts(cfg.projector.lumens, cfg.projector.gain, S.areaFt2);
      h += '<div class="sm-head"><div><div class="sm-mfr">Sonor · Cinema Tools' + (cfg.projectName ? ' · ' + esc(cfg.projectName) : '') + '</div><h2>' + esc(cfg.label || defaultLabel()) + (cfg._isFinal ? ' <span class="ovw-badge">★ FINAL</span>' : '') + '</h2></div><div class="sm-date">' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · v' + CFG.version + '</div></div>';
      h += strip([['Room', mm(cfg.room.w) + ' × ' + mm(cfg.room.d), 'h ' + mm(cfg.room.h)], ['Screen', inch(S.diagIn) + ' ' + esc(cfg.screen.aspect), mm(S.w) + ' × ' + mm(S.h)], ['Seating', cfg.seating.rows + ' × ' + cfg.seating.perRow, 'pitch ' + mm(cfg.seating.pitch)], ['MLP FoV', r1(fov2) + '°', E.fovVerdict(fov2).band], ['Projector', r2(throwMm() / S.w) + ':1', mm(throwMm()) + ' · ' + r1(fl2) + ' fL'], ['Audio', cfg.audio.recipe, A2.subCount + ' sub · ' + A2.layout.discrete + ' ch']]);
      h += flags;
      h += '<div class="svgcard" id="planCard">' + planSVG(true, { speakers: true }) + '</div>';
      h += '<div class="legend">' + Object.keys(CFG.SPEAKER_KLASS).map(function (k) { return '<span><i style="background:' + CFG.SPEAKER_KLASS[k].hex + '"></i>' + esc(CFG.SPEAKER_KLASS[k].label) + '</span>'; }).join('') + '</div>';
      h += '<div class="svgcard">' + sectionSVG(true) + '</div>';
      h += panel('Riser schedule', '<table class="tbl"><thead><tr><th>Row</th><th>Eye → screen</th><th>H FoV</th><th>Build height</th><th>Steps</th></tr></thead><tbody>' + R2.map(function (r) { var f = E.hFov(S.w, r.dist); return '<tr><td>' + r.row + '</td><td class="mono">' + mm(r.dist) + '</td><td class="mono">' + r1(f) + '° ' + chip(E.fovVerdict(f).pass, E.fovVerdict(f).band) + '</td><td class="mono"><b>' + mm(r.riserBuild) + '</b></td><td class="mono">' + (r.row === 1 ? '—' : r.steps + ' × ' + mm(r.stepH)) + '</td></tr>'; }).join('') + '</tbody></table>');
      h += panel('Speaker schedule — ' + cfg.audio.recipe, audioTable(A2));
      if (cfg.notes) h += panel('Notes', '<div class="hint" style="font-size:13px;color:var(--cream);white-space:pre-wrap">' + esc(cfg.notes) + '</div>');
      h += '<div class="disc">Quick-calc figures for design discussion. Geometry per SMPTE EG-18 / THX / CTA-CEDIA CEB23; audio per CEDIA/CTA-RP22 v1.2 Appendix E; brightness per SMPTE 196M. Cinema Design remains the source of the detailed design.</div>';
    }
    host.innerHTML = h;
  }
  function strip(cells) { return '<div class="strip">' + cells.map(function (c) { return '<div class="cellx"><div class="cl">' + c[0] + '</div><div class="cv">' + c[1] + '</div>' + (c[2] ? '<div class="cn">' + c[2] + '</div>' : '') + '</div>'; }).join('') + '</div>'; }
  function lab(ch) { var f = cfg.audio.format; if (f === 'atmos') { var m = global.SonorRP22; return (m && m.formatLabel) ? m.formatLabel(ch, 'atmos') : ch; } if (f === 'name') return E.chanName(ch); return ch; }
  function audioTable(A) {
    return '<table class="tbl"><thead><tr><th></th><th>Ch</th><th>Name</th><th>X</th><th>Y (from front)</th><th>Z AFL</th><th>Az</th><th>Elev</th><th>Dist</th><th>RP22</th></tr></thead><tbody>' + A.speakers.map(function (s) {
      return '<tr><td><i class="dot" style="background:' + CFG.SPEAKER_KLASS[s.klass].hex + '"></i></td><td class="mono"><b>' + esc(lab(s.channel)) + '</b></td><td>' + esc(s.name) + (s.note ? ' <span class="cn">' + esc(s.note) + '</span>' : '') + '</td><td class="mono">' + mm(s.x) + '</td><td class="mono">' + mm(s.y) + '</td><td class="mono">' + mm(s.z) + '</td><td class="mono">' + (s.side === 'C' ? '' : s.side + ' ') + s.az + '°</td><td class="mono">' + (s.el >= 0 ? '+' : '') + s.el + '°</td><td class="mono">' + mm(s.dist) + '</td><td>' + chip(s.verdict.pass, s.verdict.pass === 'pass' ? 'OK' : s.verdict.pass === 'warn' ? 'MARGINAL' : 'OUT') + (s.verdict.pass !== 'pass' ? '<div class="cn">' + esc(s.verdict.note) + '</div>' : '') + '</td></tr>';
    }).join('') + '</tbody></table><div class="hint">Azimuth from MLP (0° = screen centre, L/R); elevation from ear plane (' + mm(cfg.seating.earAfl) + '). Bands per RP22 §5.5–5.8 + Dolby upper-layer guidance (tops judged on the fore/aft “f/a” angle, as the section diagrams measure it). Subwoofers: corner/SBA convention as Cinema Design — final positions by measurement.</div>';
  }

  // ── SVG — PLAN (Seating Configurator visual language) ────────────────────
  var FONT = 'Gilroy,system-ui', DIMC = 'rgba(173,153,120,0.9)';
  var G = function (a) { return 'rgba(200,180,142,' + a + ')'; };
  function rr(x, y, w, h, r, fill, stroke, sw, extra) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(0, w).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="' + r + '" fill="' + (fill || 'none') + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' : '') + (extra || '') + '/>'; }
  function txt(s, x, y, size, fill, anchor, ls, extra) { return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + size + '" fill="' + fill + '" font-family="' + FONT + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + (ls ? ' letter-spacing="' + ls + '"' : '') + (extra || '') + '>' + s + '</text>'; }
  function line(x1, y1, x2, y2, c, w, dash) { return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + c + '" stroke-width="' + (w || 0.7) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; }
  function dimH(x1, x2, y, label, above) { return line(x1, y, x2, y, DIMC) + line(x1, y - 3, x1, y + 3, DIMC) + line(x2, y - 3, x2, y + 3, DIMC) + txt(label, (x1 + x2) / 2, above ? y - 4 : y + 10, 8, DIMC, 'middle'); }
  function dimV(x, y1, y2, label) { return line(x, y1, x, y2, DIMC) + line(x - 3, y1, x + 3, y1, DIMC) + line(x - 3, y2, x + 3, y2, DIMC) + txt(label, x - 5, (y1 + y2) / 2, 8, DIMC, 'middle', null, ' transform="rotate(-90 ' + (x - 5).toFixed(1) + ' ' + ((y1 + y2) / 2).toFixed(1) + ')"'); }

  function planSVG(big, o) {
    o = o || {}; var S = scr(), RW = cfg.room.w, RD = cfg.room.d, st = cfg.seating;
    var boxW = big ? 680 : 460, boxH = big ? 560 : 400, padL = 44, padR = 48, padT = 30, padB = 42;
    var sc = Math.min((boxW - padL - padR) / RW, (boxH - padT - padB) / RD);
    var rw = RW * sc, rl = RD * sc, rx = padL + ((boxW - padL - padR) - rw) / 2, ry = padT + ((boxH - padT - padB) - rl) / 2;
    var X = function (mmx) { return rx + mmx * sc; }, Y = function (mmy) { return ry + mmy * sc; };
    var s = '';
    s += rr(rx - 2.5, ry - 2.5, rw + 5, rl + 5, 3, 'none', G(0.55), 1.3);
    s += rr(rx, ry, rw, rl, 2, 'rgba(9,7,15,0.55)', G(0.35), 0.7);
    // screen wall void + screen
    if (cfg.screen.wallVoid > 0) s += rr(rx, ry, rw, cfg.screen.wallVoid * sc, 0, 'rgba(128,88,161,0.06)', G(0.25), 0.5, ' stroke-dasharray="3,3"');
    s += rr(X((RW - S.w) / 2), Y(cfg.screen.wallVoid) - 2, S.w * sc, 4, 1.5, '#ad9978');
    s += txt('S C R E E N', rx + rw / 2, Y(cfg.screen.wallVoid) + 12, 6, G(0.8), 'middle', 3);
    // listening area + MLP
    var LA = la(), M = mlp();
    s += rr(X(LA.x), Y(LA.y), LA.w * sc, LA.h * sc, 3, 'none', 'rgba(128,88,161,0.55)', 0.8, ' stroke-dasharray="4,3"');
    // seats
    var seatPX = st.perW * sc, uprPX = st.depth * sc, reclPX = st.recline * sc, run = rowRun();
    var sx0 = X((RW - run) / 2);
    for (var r = 0; r < st.rows; r++) {
      var ey = Y(eyeY(r)), sp = seatSpan(r), ryU = Y(sp.y0), ryR = ryU + uprPX - reclPX;
      var cx = sx0;
      for (var i = 0; i < st.perRow; i++) {
        if (reclPX > uprPX + 2) s += rr(cx + 1, ryR, seatPX - 2, reclPX, 2, 'none', G(0.28), 0.7);
        s += rr(cx, ryU, seatPX, uprPX, 3, 'rgba(128,88,161,0.14)', G(0.85), 1);
        s += rr(cx + seatPX * 0.15 + 2, ryU + uprPX * 0.08, seatPX * 0.7 - 4, uprPX * 0.52, 2, 'none', G(0.5), 0.7);
        s += rr(cx + seatPX * 0.15 + 2, ryU + uprPX * 0.66, seatPX * 0.7 - 4, uprPX * 0.26, 2, G(0.14), G(0.7), 0.9);
        cx += seatPX;
      }
      s += txt('R' + (r + 1), sx0 - 6, ey + 3, 7, G(0.7), 'end');
    }
    s += '<circle cx="' + X(M.x).toFixed(1) + '" cy="' + Y(M.y).toFixed(1) + '" r="4" fill="none" stroke="#c8b48e" stroke-width="1"/>' + line(X(M.x) - 7, Y(M.y), X(M.x) + 7, Y(M.y), '#c8b48e', 0.8) + line(X(M.x), Y(M.y) - 7, X(M.x), Y(M.y) + 7, '#c8b48e', 0.8);
    // projector
    var lensY = screenY() + throwMm();
    if (lensY < RD) s += rr(X(RW / 2) - 9, Y(lensY) - 6, 18, 12, 2, 'rgba(173,153,120,0.18)', '#ad9978', 0.9) + txt('PJ', X(RW / 2), Y(lensY) + 3, 6, '#c8b48e', 'middle');
    // speakers
    if (o.speakers) {
      var A = audioLayout();
      A.speakers.forEach(function (sp) {
        var col = CFG.SPEAKER_KLASS[sp.klass].hex, px = X(sp.x), py = Y(sp.y), rad = sp.klass === 'sub' ? 7 : 5.5;
        var upper = /^top|height/.test(sp.klass);
        if (sp.klass === 'sub') s += rr(px - rad, py - rad, rad * 2, rad * 2, 2, col, '#0a0908', 1);
        else if (upper) s += '<polygon points="' + (px - rad).toFixed(1) + ',' + (py + rad * 0.85).toFixed(1) + ' ' + (px + rad).toFixed(1) + ',' + (py + rad * 0.85).toFixed(1) + ' ' + px.toFixed(1) + ',' + (py - rad).toFixed(1) + '" fill="' + col + '" stroke="#0a0908" stroke-width="1"/>';
        else s += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="' + rad + '" fill="' + col + '" stroke="#0a0908" stroke-width="1"/>';
        var lx = px + (sp.x < RW / 2 ? -9 : 9), anchor = sp.x < RW / 2 ? 'end' : 'start';
        if (sp.klass === 'screen' || sp.channel === 'HFC' || sp.channel === 'TMC') { lx = px; anchor = 'middle'; }
        s += txt(esc(lab(sp.channel)), lx, py + (anchor === 'middle' ? (sp.y < RD / 2 ? -9 : 15) : 3), 6.5, col, anchor, 0.5, ' font-weight="700"');
      });
    }
    // dims
    s += dimH(rx, rx + rw, ry - 12, RW + '', true);
    s += dimV(rx - 14, ry, ry + rl, RD + '');
    var side = r0((RW - run) / 2); if (side > 0) { var syc = Y(eyeY(st.rows - 1)); s += dimH(rx, sx0, syc, side + '', true); s += dimH(sx0 + run * sc, rx + rw, syc, side + '', true); }
    s += dimH(sx0, sx0 + run * sc, ry + rl + 12, r0(run) + '', false);
    s += dimV(rx + rw + 14, Y(screenY()), Y(eyeY(0)), r0(st.firstRowDist) + '');
    if (st.rows > 1) s += dimV(rx + rw + 14, Y(eyeY(0)), Y(eyeY(1)), r0(st.pitch) + '');
    s += dimH(X((RW - S.w) / 2), X((RW + S.w) / 2), Y(cfg.screen.wallVoid) - 10, r0(S.w) + '', true);
    s += txt((o.speakers ? cfg.audio.recipe + ' · ' : '') + inch(S.diagIn) + ' ' + esc(cfg.screen.aspect) + ' · ' + st.rows + '×' + st.perRow + ' · dims in mm · plan', boxW / 2, boxH - 6, 8.5, 'rgba(143,133,116,0.9)', 'middle');
    return '<svg viewBox="0 0 ' + boxW + ' ' + boxH + '" width="100%" style="max-width:' + (big ? 760 : 500) + 'px;display:block" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }

  // ── SVG — SECTION (side view: screen, rows, risers, sightlines, projector)
  function sectionSVG(big) {
    var S = scr(), RD = cfg.room.d, RH = cfg.room.h, st = cfg.seating, R = riserRows();
    var boxW = big ? 680 : 460, boxH = big ? 330 : 250, padL = 44, padR = 48, padT = 26, padB = 40;
    var sc = Math.min((boxW - padL - padR) / RD, (boxH - padT - padB) / RH);
    var rl = RD * sc, rh = RH * sc, rx = padL + ((boxW - padL - padR) - rl) / 2, ry = padT + ((boxH - padT - padB) - rh) / 2;
    var X = function (y) { return rx + y * sc; }, Z = function (z) { return ry + rh - z * sc; };
    var s = '';
    s += rr(rx - 2.5, ry - 2.5, rl + 5, rh + 5, 3, 'none', G(0.55), 1.3);
    s += rr(rx, ry, rl, rh, 2, 'rgba(9,7,15,0.55)', G(0.35), 0.7);
    // screen
    var sy = X(screenY()), sb = cfg.screen.bottomAfl, stp = sb + S.h;
    s += line(sy, Z(sb), sy, Z(stp), '#ad9978', 3);
    s += txt('SCREEN', sy + 4, Z(stp) - 4, 6, G(0.8), null, 1.5);
    // risers + seats + eyes
    for (var i = 0; i < st.rows; i++) {
      var ey = eyeY(i), build = R[i].riserBuild, sp = seatSpan(i), y0 = sp.y0, y1 = sp.y1;
      if (build > 0) { var pr = y0 - st.pitch * 0.15; s += rr(X(pr), Z(build), (Math.min(RD, y1 + st.pitch * 0.35) - pr) * sc, build * sc, 0, 'rgba(173,153,120,0.10)', G(0.45), 0.7); }
      // chair side profile: plinth, seat pan, backrest + headrest (recliner proportions)
      s += rr(X(y0 + 80), Z(build + 150), (y1 - y0 - 160) * sc, 150 * sc, 1, 'rgba(128,88,161,0.08)', G(0.45), 0.7);
      s += rr(X(y0), Z(build + 480), (y1 - y0 - 120) * sc, 330 * sc, 3, 'rgba(128,88,161,0.16)', G(0.85), 1);
      s += rr(X(y1 - 260), Z(build + st.eyeAfl + cfg.riser.headTop), 260 * sc, (st.eyeAfl + cfg.riser.headTop - 150) * sc, 4, 'rgba(128,88,161,0.12)', G(0.7), 0.9);
      s += '<circle cx="' + X(ey).toFixed(1) + '" cy="' + Z(build + st.eyeAfl + 60).toFixed(1) + '" r="' + (110 * sc).toFixed(1) + '" fill="rgba(128,88,161,0.10)" stroke="' + G(0.5) + '" stroke-width="0.7"/>';
      var ez = build + st.eyeAfl;
      s += '<circle cx="' + X(ey).toFixed(1) + '" cy="' + Z(ez).toFixed(1) + '" r="2.2" fill="#c8b48e"/>';
      s += line(X(ey), Z(ez), sy, Z(sb), 'rgba(128,88,161,0.6)', 0.6, '3,2');
      s += line(X(ey), Z(ez), sy, Z(stp), 'rgba(128,88,161,0.3)', 0.5, '2,3');
      s += txt('R' + (i + 1) + (build ? ' +' + build : ''), X(ey), Z(build) + 9 > ry + rh ? Z(0) - 3 : Z(build) - 3, 6.5, G(0.75), 'middle');
    }
    // projector
    var pz = RH - cfg.projector.ceilingDrop, py = screenY() + throwMm();
    if (py < RD) { s += rr(X(py) - 8, Z(pz) - 4, 16, 8, 1.5, 'rgba(173,153,120,0.18)', '#ad9978', 0.9); s += line(X(py) - 8, Z(pz), sy, Z(stp), 'rgba(173,153,120,0.35)', 0.5, '2,2') + line(X(py) - 8, Z(pz), sy, Z(sb), 'rgba(173,153,120,0.35)', 0.5, '2,2'); s += txt('PJ ' + r2(throwMm() / S.w) + ':1', X(py), Z(pz) - 7, 6, '#c8b48e', 'middle'); }
    // dims
    s += dimH(rx, rx + rl, ry + rh + 12, RD + '', false);
    s += dimV(rx - 14, ry, ry + rh, RH + '');
    s += dimV(rx + rl + 14, Z(stp), Z(sb), r0(S.h) + '');
    s += dimV(rx + rl + 30, Z(sb), Z(0), sb + '');
    s += txt('section · eye ' + st.eyeAfl + ' AFL · sightlines to screen bottom · dims in mm', boxW / 2, boxH - 6, 8.5, 'rgba(143,133,116,0.9)', 'middle');
    return '<svg viewBox="0 0 ' + boxW + ' ' + boxH + '" width="100%" style="max-width:' + (big ? 760 : 500) + 'px;display:block" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }

  // ── SVG — SCREEN FACE with format overlays
  function screenSVG(S) {
    var boxW = 460, boxH = 300, pad = 40;
    var sc = Math.min((boxW - 2 * pad) / S.w, (boxH - 2 * pad - 20) / S.h);
    var w = S.w * sc, h = S.h * sc, x = (boxW - w) / 2, y = (boxH - 20 - h) / 2 + 6;
    var s = rr(x, y, w, h, 2, 'rgba(128,88,161,0.12)', '#ad9978', 1.4);
    var others = [['2.39', 2.39, 'rgba(75,185,211,0.8)'], ['16:9', 16 / 9, 'rgba(230,126,177,0.8)'], ['1.85', 1.85, 'rgba(120,186,87,0.8)']].filter(function (a) { return Math.abs(a[1] - S.ratio) > 0.02; });
    others.forEach(function (a) { var b = E.bars(S, a[1]); var iw = b.imageW * sc, ih = b.imageH * sc; s += rr(x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, 1, 'none', a[2], 0.7, ' stroke-dasharray="4,3"'); s += txt(a[0] + (b.type === 'letterbox' ? ' ▬ ' + r0(b.each) : b.type === 'pillarbox' ? ' ▮ ' + r0(b.each) : ''), x + (w - iw) / 2 + 4, y + (h - ih) / 2 + 9, 6.5, a[2]); });
    s += dimH(x, x + w, y - 10, r0(S.w) + ' (' + r1(S.wIn) + '")', true) + dimV(x - 12, y, y + h, r0(S.h) + ' (' + r1(S.hIn) + '")');
    s += line(x, y + h, x + w, y, 'rgba(200,180,142,0.35)', 0.6, '2,3') + txt(inch(S.diagIn) + ' · ' + r0(S.diag) + ' mm', x + w / 2, y + h / 2 + 3, 8, '#c8b48e', 'middle');
    s += txt(esc(cfg.screen.aspect) + ' screen face · dashed = other formats on this screen · bar height in mm', boxW / 2, boxH - 6, 8.5, 'rgba(143,133,116,0.9)', 'middle');
    return '<svg viewBox="0 0 ' + boxW + ' ' + boxH + '" width="100%" style="max-width:500px;display:block" xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
  }
  function downloadSVG() {
    var svg = planSVG(true, { speakers: true }).replace('<svg ', '<svg style="background:#0b0a0c" ');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = ((cfg.projectName || 'cinema') + ' - ' + (cfg.label || defaultLabel()) + ' - plan.svg').replace(/[\/\\:]/g, '-'); a.click();
  }

  // ── SAVED PANEL + LANDING OVERVIEW ───────────────────────────────────────
  function savedRow(r, ovw) {
    var d = new Date(r.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    var cur = cfg._savedId === r.id, c = r.config || {};
    var sub = (c.screen ? (c.screen.diagIn ? r1(c.screen.diagIn) + '" ' : '') + (c.screen.aspect || '') : '') + (c.seating ? ' · ' + c.seating.rows + '×' + c.seating.perRow : '') + (c.audio ? ' · ' + c.audio.recipe : '') + ' · ' + d + ' · v' + esc(r.app_version || '?');
    if (ovw) return '<div class="ovw-row' + (cur ? ' cur' : '') + '"><div class="ovw-b"><div class="ovw-n">' + esc(r.label) + (r.is_final ? ' <span class="ovw-badge">★ Final</span>' : '') + (cur ? ' <span class="cn">● open</span>' : '') + '</div><div class="ovw-d">' + sub + '</div></div><button class="ovw-btn" onclick="CinemaToolsApp.openFromOverview(\'' + r.id + '\')">Open</button>' + (r.is_final ? '' : '<button class="ovw-btn" title="Make this the option Cinema Design references" onclick="CinemaToolsApp.setFinal(\'' + r.id + '\')">★</button>') + '</div>';
    return '<div class="saved-row' + (cur ? ' cur' : '') + '"><div class="saved-b"><div class="saved-n">' + esc(r.label) + (r.is_final ? ' <span class="ovw-badge">★ Final</span>' : '') + (cur ? ' <span class="cn">● open</span>' : '') + '</div><div class="saved-d">' + sub + '</div></div>' + (cur ? '' : '<button class="ghost sm" onclick="CinemaToolsApp.openSaved(\'' + r.id + '\')">Open</button>') + (r.is_final ? '' : '<button class="ghost sm" onclick="CinemaToolsApp.setFinal(\'' + r.id + '\')">★</button>') + '<button class="ghost sm" onclick="CinemaToolsApp.renameSaved(\'' + r.id + '\',\'' + esc(r.label).replace(/'/g, '&#39;') + '\')">✎</button><button class="ghost sm" onclick="CinemaToolsApp.archiveSaved(\'' + r.id + '\')">⌫</button></div>';
  }
  function renderSavedPanel() {
    var el = $('savedPanel'); if (!el) return;
    el.innerHTML = panel('Saved options' + (cfg.projectName ? ' — ' + esc(cfg.projectName) : ' (no project)'), (ctx.saved.length ? ctx.saved.map(function (r) { return savedRow(r, false); }).join('') : '<div class="hint">No saved options yet' + (dbc() ? '' : ' (Supabase offline — local draft only)') + '.</div>') + '<div class="hint" style="margin-top:8px">Cinema Design → <a href="' + CFG.cdUrl() + '" target="_blank" rel="noopener">open CD ↗</a> — its Cinema Tools panel lists these options and shows ● linked for the ★ Final one.</div>', 'saved-panel');
  }
  function renderOverview() {
    var host = $('ovw'); if (!host) return;
    if (CLIENT) { host.style.display = 'none'; return; }
    host.style.display = '';
    $('ovwTitle').innerHTML = (cfg.projectName ? esc(cfg.projectName) + ' — ' : '') + 'saved <span class="lt">options</span>.';
    var f = ctx.final;
    $('ovwSummary').textContent = f ? 'Cinema Design is referencing “' + f.label + '” (' + (f.screen ? f.screen.diag_in + '" ' + f.screen.aspect : '') + (f.audio ? ' · ' + f.audio.recipe : '') + ', chosen ' + new Date(f.chosen_at).toLocaleDateString('en-GB') + ').' : (cfg.projectId ? 'No final option chosen yet — save an option and mark it ★ Final to link it into Cinema Design.' : 'Select a project in the bar above to keep options per project.');
    $('ovwOptions').innerHTML = ctx.saved.length ? ctx.saved.map(function (r) { return savedRow(r, true); }).join('') : '<div class="ovw-hint">No saved options for this project yet.</div>';
    var c = [];
    if (ctx.design) c.push('<div class="ovw-row"><div class="ovw-b"><div class="ovw-n">Cinema Design · ' + esc(ctx.design.name || '') + '</div><div class="ovw-d">' + mm(ctx.design.room_width) + ' × ' + mm(ctx.design.room_depth) + ' × ' + mm(ctx.design.room_height) + ' · ' + esc(ctx.design.atmos_config || '') + ' · ' + esc(ctx.design.display_mode || '') + '</div></div><button class="ovw-btn" onclick="CinemaToolsApp.enter();CinemaToolsApp.adoptFromCD()">Adopt →</button></div>');
    if (ctx.seating) c.push('<div class="ovw-row"><div class="ovw-b"><div class="ovw-n">Seating config · ' + esc(ctx.seating.label) + '</div><div class="ovw-d">' + esc(ctx.seating.range_id || '') + (ctx.seating.config && ctx.seating.config.layout ? ' · ' + ctx.seating.config.layout.rows + '×' + ctx.seating.config.layout.seatsPerRow : '') + '</div></div><button class="ovw-btn" onclick="CinemaToolsApp.enter();CinemaToolsApp.adoptFromSeating()">Adopt →</button></div>');
    $('ovwContext').innerHTML = c.length ? c.join('') : '<div class="ovw-hint">' + (cfg.projectId ? 'No Cinema Design or seating configuration for this project yet — start from the defaults.' : 'Pick a project to pull its room, screen and seating in.') + '</div>';
  }
  function openFromOverview(id) { enter(); openSaved(id); }
  function newOption() { var keep = cfg.projectId, name = cfg.projectName; cfg = freshCfg(); cfg.projectId = keep; cfg.projectName = name; draftSave(); enter(); go('screen'); }

  global.CinemaToolsApp = { boot: boot, enter: enter, backToIntro: backToIntro, go: go, set: set, setLabel: setLabel, setNotes: setNotes, saveOption: saveOption, openSaved: openSaved, openFromOverview: openFromOverview, renameSaved: renameSaved, archiveSaved: archiveSaved, setFinal: setFinal, clearFinal: clearFinal, adoptFromCD: adoptFromCD, adoptFromSeating: adoptFromSeating, downloadSVG: downloadSVG, newOption: newOption, finalSpec: finalSpec, _cfg: function () { return cfg; } };
})(typeof window !== 'undefined' ? window : this);
