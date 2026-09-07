// 16c-cinema-tools.js — CINEMA TOOLS OPTIONS panel for Cinema Design (CD)
// ─────────────────────────────────────────────────────────────────────────────
// Sibling of 16b-seating-configs.js. READ-ONLY on cinema_tools_configs +
// projects.metadata.cinema_tools — Cinema Tools owns all writes.
//
// Lists the saved Cinema Tools options for the ACTIVE project and flags the
// one marked ★ Final (mirrored in projects.metadata.cinema_tools). "→ Plan"
// adopts that option's room / screen / seating / speaker recipe into THIS
// design, the same way applySeatingConfigToPlan() does for seating.
//
// Wiring (CD):
//   1. drop this file next to 16b-seating-configs.js and add the <script> tag
//   2. add to the Audio (or Video) tab sidebar:
//        <div class="section">
//          <div class="section-title">Cinema Tools options
//            <button class="toggle-btn" id="btn-open-cinematools" style="float:right;font-size:11px">Open Cinema Tools ↗</button>
//          </div>
//          <div id="cinema-tools-list"></div>
//        </div>
//   3. optional: in the project bar / header, call cinemaToolsLinkBadgeHtml()
//      to show "● Cinema Tools: {label}" when a final option exists.
//
// URL contract (Cinema Tools): ?config=<uuid> opens that saved option.

function _cinemaToolsUrl(params) {
  var isLocal = location.protocol === 'file:' || /localhost|127\.0\.0\.1/.test(location.hostname);
  var base = isLocal
    ? '../../APP - Cinema Tools/dashboard/sonor-cinema-tools.html'
    : 'https://sonorltd.github.io/sonor-cinema-tools/dashboard/sonor-cinema-tools.html';
  return base + (params ? ('?' + params) : '');
}
function _ctStatus(msg, isErr) {
  var s = document.getElementById('cinema-tools-status');
  if (s) s.innerHTML = '<div class="sub" style="' + (isErr ? 'color:var(--fail,#c0604f)' : 'color:var(--accent)') + ';padding-top:6px">' + msg + '</div>';
}
var _ctEsc = function (s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };

// Header badge — "● Cinema Tools: <label>" when the project has a final option
async function cinemaToolsLinkBadgeHtml() {
  if (typeof _supaDb === 'undefined' || !_supaDb || !_supaDb.client || typeof currentProjectId === 'undefined' || !currentProjectId) return '';
  try {
    var p = await _supaDb.client.from('projects').select('metadata').eq('id', currentProjectId).single();
    var ct = p.data && p.data.metadata && p.data.metadata.cinema_tools;
    if (!ct || !ct.config_id) return '';
    return '<span class="ct-link-badge" title="Final Cinema Tools option — ' + _ctEsc(ct.label) + '" style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--accent);border:1px solid var(--section-1);border-radius:999px;padding:2px 9px;cursor:pointer" onclick="window.open(_cinemaToolsUrl(\'config=' + ct.config_id + '\'),\'_blank\')">● Cinema Tools: ' + _ctEsc(ct.label) + '</span>';
  } catch (e) { return ''; }
}

// Adopt a saved option's figures into this design (mirrors applySeatingConfigToPlan)
async function applyCinemaToolsToPlan(id) {
  if (typeof _supaDb === 'undefined' || !_supaDb || !_supaDb.client) return;
  try {
    var q = await _supaDb.client.from('cinema_tools_configs').select('id,label,config').eq('id', id).single();
    if (q.error) throw q.error;
    var c = q.data.config || {}, changed = [];
    // room
    if (c.room && typeof ROOM !== 'undefined') { ROOM.w = c.room.w; ROOM.d = c.room.d; ROOM.h = c.room.h; changed.push('room ' + c.room.w + '×' + c.room.d + '×' + c.room.h); }
    // screen (CT keeps the screen under metadata.screen — same shape here)
    if (c.screen && c.screen.wMm && typeof ctState !== 'undefined' && ctState && ctState.metadata) {
      ctState.metadata.screen = { w: c.screen.wMm, h: c.screen.hMm, bottomFromFloor: c.screen.bottomAfl };
      if (ctState.room) ctState.room.screenWallDepth = c.screen.wallVoid;
      changed.push('screen ' + c.screen.wMm + '×' + c.screen.hMm);
    }
    // seating
    if (c.seating) {
      if (typeof SEAT !== 'undefined') { SEAT.count = c.seating.perRow; SEAT.perW = c.seating.perW; SEAT.totalW = c.seating.perW * c.seating.perRow; SEAT.depth = c.seating.depth; SEAT.recline = c.seating.recline; }
      if (typeof window.setSeatRows === 'function') { try { window.setSeatRows(c.seating.rows); } catch (e1) {} }
      if (typeof ctState !== 'undefined' && ctState && ctState.metadata) ctState.metadata.seating = Object.assign(ctState.metadata.seating || {}, { count: c.seating.perRow, pitch: c.seating.pitch, mlpDist: (c.screen ? c.screen.wallVoid : 0) + c.seating.firstRowDist + (Math.max(1, c.seating.refRow || 1) - 1) * c.seating.pitch, earHeight: c.seating.earAfl });
      changed.push(c.seating.rows + '×' + c.seating.perRow + ' seats');
    }
    // audio recipe + subs
    if (c.audio && typeof ctState !== 'undefined' && ctState && ctState.metadata) {
      ctState.metadata.speakerRecipe = c.audio.recipe;
      ctState.metadata.audio = Object.assign(ctState.metadata.audio || {}, { atmosConfig: c.audio.recipe, subPos: c.audio.subPos === 'opposite' ? 'front' : c.audio.subPos, surroundPos: c.audio.surrPos });
      if (ctState.room) ctState.room.subCount = c.audio.subCount;
      changed.push(c.audio.recipe);
    }
    // projector
    if (c.projector && typeof ctState !== 'undefined' && ctState && ctState.metadata) { ctState.metadata.projector = Object.assign(ctState.metadata.projector || {}, { throwRatio: c.projector.throwRatio }); }
    window.appliedCinemaTools = { id: q.data.id, label: q.data.label };
    ['renderSeatingTab', 'renderRowLayout', 'redraw', 'scheduleSave'].forEach(function (fn) { if (typeof window[fn] === 'function') { try { window[fn](); } catch (e2) {} } });
    _ctStatus('Loaded “' + _ctEsc(q.data.label) + '” into the design — ' + _ctEsc(changed.join(', ')) + '.');
  } catch (e) {
    _ctStatus('Could not load option: ' + _ctEsc(e && e.message), true);
  }
}

async function renderCinemaToolsOptions() {
  var el = document.getElementById('cinema-tools-list');
  if (!el) return;
  var btn = document.getElementById('btn-open-cinematools');
  if (typeof _supaDb === 'undefined' || !_supaDb || !_supaDb.client || typeof currentProjectId === 'undefined' || !currentProjectId) {
    el.innerHTML = '<div class="sub">Select a project to see its Cinema Tools options.</div>';
    if (btn) btn.onclick = function () { window.open(_cinemaToolsUrl(''), '_blank'); };
    return;
  }
  try {
    if (btn) btn.onclick = function () { window.open(_cinemaToolsUrl(''), '_blank'); };
    var pq = await _supaDb.client.from('projects').select('metadata').eq('id', currentProjectId).single();
    var fin = (pq.data && pq.data.metadata && pq.data.metadata.cinema_tools) || null;
    var q = await _supaDb.client.from('cinema_tools_configs')
      .select('id,label,is_final,app_version,updated_at,config')
      .eq('project_id', currentProjectId).eq('archived', false)
      .order('updated_at', { ascending: false }).limit(12);
    if (q.error) throw q.error;
    if (!q.data || !q.data.length) {
      el.innerHTML = '<div class="sub">No Cinema Tools options for this project yet — open Cinema Tools, run the calcs against this project and save an option.</div><div id="cinema-tools-status"></div>';
      return;
    }
    var applied = window.appliedCinemaTools && window.appliedCinemaTools.id;
    el.innerHTML = q.data.map(function (r) {
      var d = new Date(r.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      var c = r.config || {}, sub = (c.screen ? c.screen.diagIn + '" ' + c.screen.aspect : '') + (c.seating ? ' · ' + c.seating.rows + '×' + c.seating.perRow : '') + (c.audio ? ' · ' + c.audio.recipe : '');
      var isFinal = r.is_final || (fin && fin.config_id === r.id);
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--section-1)">' +
        '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">' + (isFinal ? '<span style="color:var(--accent)" title="Final option — linked to this project">★ </span>' : '') + _ctEsc(r.label) + (applied === r.id ? ' <span style="color:var(--accent);font-size:10px">● on plan</span>' : '') + '</div>' +
        '<div style="font-size:10.5px;color:var(--text-muted)">' + _ctEsc(sub) + ' · ' + d + ' · v' + _ctEsc(r.app_version || '?') + '</div></div>' +
        '<button class="toggle-btn" style="font-size:11px;padding:3px 10px" title="Adopt this option\'s room, screen, seating and recipe into the design" onclick="applyCinemaToolsToPlan(\'' + r.id + '\')">→ Plan</button>' +
        '<button class="toggle-btn" style="font-size:11px;padding:3px 10px" onclick="window.open(_cinemaToolsUrl(\'config=' + r.id + '\'),\'_blank\')">Open ↗</button></div>';
    }).join('') + '<div id="cinema-tools-status"></div>';
  } catch (e) {
    el.innerHTML = '<div class="sub">Cinema Tools options unavailable: ' + _ctEsc(e && e.message) + '</div>';
  }
}

window.addEventListener('sonor-active-project-changed', function () { setTimeout(renderCinemaToolsOptions, 300); });
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(renderCinemaToolsOptions, 1500); });
}
