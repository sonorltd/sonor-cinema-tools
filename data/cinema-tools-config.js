// cinema-tools-config.js — Cinema Tools (Sonor) static config
// ─────────────────────────────────────────────────────────────────────────────
// Quick-calc companion to Cinema Design (CD). Pure data — no DOM.
// Standards are CONSUMED from the workspace-shared modules where present:
//   data/sonor-rp22.js  → SonorRP22 (CEDIA/CTA-RP22 audio: layouts, labels, PL targets)
//   data/sonor-rp23.js  → SonorRP23 (video geometry + photometry: SMPTE/THX/CEB23/ITU)
// The fallbacks below only fire if those files are missing (they are synced
// by sync-everything.sh — never hand-edit the per-app copies).
//
// v0.2.0 (2026-09-07) — luxury proposal PDF (cinema-tools-pdf.js on the shared
//                       SonorPdfLuxury chrome); drawings refactored to scenes
// v0.1.0 (2026-09-07) — initial build (screen / viewing / projector / riser /
//                       room / audio layout / saved options + CD link)
(function (global) {
  'use strict';

  var VERSION = '0.2.0';
  var APP_KEY = 'cinema-tools';

  // ── Aspect ratios (canonical list — order = UI order) ────────────────────
  var ASPECTS = [
    { id: '16:9',   label: '16:9  (1.78:1) — HDTV / UHD',      r: 16 / 9 },
    { id: '1.85',   label: '1.85:1 — Flat / Academy widescreen', r: 1.85 },
    { id: '2.00',   label: '2.00:1 — Univisium / streaming',     r: 2.0 },
    { id: '2.35',   label: '2.35:1 — Scope (classic)',           r: 2.35 },
    { id: '2.39',   label: '2.39:1 — Scope (DCI)',               r: 2.39 },
    { id: '2.40',   label: '2.40:1 — Scope (Blu-ray)',           r: 2.40 },
    { id: '16:10',  label: '16:10 (1.60:1) — Monitor',           r: 1.6 },
    { id: '4:3',    label: '4:3   (1.33:1) — Academy / legacy',   r: 4 / 3 },
    { id: '1:1',    label: '1:1 — Square',                       r: 1.0 }
  ];

  // ── Common sizes (diagonal inches) for the reference table ───────────────
  var COMMON_TV_IN   = [55, 65, 75, 77, 83, 85, 97, 98, 100, 110, 115];
  var COMMON_PJ_IN   = [100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 200, 220, 250];

  // ── Speaker colour coding — MIRRORS Cinema Design ─────────────────────────
  // Source: CD v1.54 `_atmosSpks()` preview colours (js/16*-audio) + service
  // palette (sonor-db.js SERVICES). Keep in lock-step with CD; if CD changes,
  // change here (single map, every channel resolves through klassOf()).
  //   screen LCR  → 01 Cinema purple   #8058a1
  //   wides       → 07 Control pink    #e67eb1
  //   surrounds   → 02 Audio cyan      #4bb9d3
  //   surround bk → 03 Video green     #78ba57
  //   top front   → 06 Climate red     #ec6061
  //   top rear    → 05 Automation      #e37c59
  //   top middle  → 08 Security gold   #ad9978
  //   height      → 09 WiFi stone      #b7b1a7
  //   subs        → 04 Lighting yellow #f5d05c
  var SPEAKER_KLASS = {
    screen:   { label: 'Screen (LCR)',        hex: '#8058a1' },
    wide:     { label: 'Front wide',          hex: '#e67eb1' },
    surround: { label: 'Surround',            hex: '#4bb9d3' },
    back:     { label: 'Surround back',       hex: '#78ba57' },
    topf:     { label: 'Top front',           hex: '#ec6061' },
    topm:     { label: 'Top middle',          hex: '#ad9978' },
    topb:     { label: 'Top rear',            hex: '#e37c59' },
    height:   { label: 'Height (wall)',       hex: '#b7b1a7' },
    sub:      { label: 'Subwoofer (LFE)',     hex: '#f5d05c' }
  };
  function klassOf(ch) {
    if (/^SUB/.test(ch)) return 'sub';
    if (/^(FL|FC|FR|FCL|FCR)$/.test(ch)) return 'screen';
    if (/^FW/.test(ch)) return 'wide';
    if (/^SB/.test(ch)) return 'back';
    if (/^S[LR]\d?$/.test(ch)) return 'surround';
    if (/^TF/.test(ch)) return 'topf';
    if (/^TM/.test(ch)) return 'topm';
    if (/^TB/.test(ch)) return 'topb';
    if (/^H/.test(ch)) return 'height';
    return 'surround';
  }

  // ── RP22 angle targets (§5.5–5.8, Appendix E) — azimuth from MLP, 0° = screen
  // centre, ±° left/right; elevation from ear plane. Used for PASS/WARN chips.
  var ANGLE_TARGETS = {
    FC:  { az: [0, 0],     el: [0, 0],   note: 'On centre, ear-height (±10° elev. behind AT screen)' },
    FL:  { az: [22, 30],   el: [0, 0],   note: 'RP22 §5.5.1 — 22–30° (ITU 30°, wide screens to LA edge)' },
    FR:  { az: [22, 30],   el: [0, 0],   note: 'RP22 §5.5.1' },
    FCL: { az: [10, 15],   el: [0, 0],   note: 'Between FC and FL' },
    FCR: { az: [10, 15],   el: [0, 0],   note: 'Between FC and FR' },
    FWL: { az: [55, 70],   el: [0, 0],   note: 'RP22 §5.7 — median of FL/SL (~60°)' },
    FWR: { az: [55, 70],   el: [0, 0],   note: 'RP22 §5.7' },
    SL:  { az: [90, 110],  el: [0, 20],  note: 'RP22 §5.6.1 — 90–110°, slightly above ear (≤20° elev.)' },
    SR:  { az: [90, 110],  el: [0, 20],  note: 'RP22 §5.6.1' },
    SL1: { az: [80, 100],  el: [0, 20],  note: 'Multi-row forward surround' },
    SR1: { az: [80, 100],  el: [0, 20],  note: 'Multi-row forward surround' },
    SBL: { az: [135, 150], el: [0, 20],  note: 'RP22 §5.6.1 — 135–150°' },
    SBR: { az: [135, 150], el: [0, 20],  note: 'RP22 §5.6.1' },
    TFL: { az: [30, 55],   el: [30, 55], note: 'Dolby/RP22 upper layer — 30–55° elev. forward' },
    TFR: { az: [30, 55],   el: [30, 55], note: 'Dolby/RP22 upper layer' },
    TML: { az: [65, 100],  el: [65, 100],note: 'Top middle — 65–100° elev. (directly above ±)' },
    TMR: { az: [65, 100],  el: [65, 100],note: 'Top middle' },
    TMC: { az: [0, 0],     el: [80, 100],note: 'Over RSP — Auro T / DTS OH' },
    TBL: { az: [125, 150], el: [30, 55], note: 'Dolby/RP22 upper layer — 30–55° elev. rearward' },
    TBR: { az: [125, 150], el: [30, 55], note: 'Dolby/RP22 upper layer' },
    HFL: { az: [22, 45],   el: [25, 45], note: 'Auro height layer — front wall, high' },
    HFC: { az: [0, 0],     el: [25, 45], note: 'Auro HC / DTS Ch' },
    HFR: { az: [22, 45],   el: [25, 45], note: 'Auro height layer' },
    HBL: { az: [110, 150], el: [25, 45], note: 'Auro rear height' },
    HBR: { az: [110, 150], el: [25, 45], note: 'Auro rear height' }
  };

  // ── Fallback RP22 layouts (only if SonorRP22 not loaded) ─────────────────
  var LAYOUTS_FALLBACK = {
    '5.1':    { discrete: 5,  desc: '5 main + LFE (RP22 §E.2.1)',                  channels: ['FL','FC','FR','SL','SR'] },
    '5.1.2':  { discrete: 7,  desc: '5.1 + 2 top middle (RP22 §E.2.2)',            channels: ['FL','FC','FR','SL','SR','TML','TMR'] },
    '5.1.4':  { discrete: 9,  desc: '5.1 + 4 top (RP22 §E.2.3 — recommended PL1)', channels: ['FL','FC','FR','SL','SR','TFL','TFR','TBL','TBR'] },
    '7.1.4':  { discrete: 11, desc: '7.1 + 4 top (RP22 §E.2.4 — minimum PL2)',     channels: ['FL','FC','FR','SL','SR','SBL','SBR','TFL','TFR','TBL','TBR'] },
    '9.1.4':  { discrete: 13, desc: '7.1.4 + front wides (RP22 §E.2.5)',           channels: ['FL','FC','FR','FWL','FWR','SL','SR','SBL','SBR','TFL','TFR','TBL','TBR'] },
    '9.1.6':  { discrete: 15, desc: '7.1.4 + wides + top middle (RP22 §E.2.6)',    channels: ['FL','FC','FR','FWL','FWR','SL','SR','SBL','SBR','TFL','TFR','TML','TMR','TBL','TBR'] },
    '11.1.6': { discrete: 17, desc: '2-row surround pairs (RP22 §E.2.7)',          channels: ['FL','FC','FR','FWL','FWR','SL','SL1','SR','SR1','SBL','SBR','TFL','TFR','TML','TMR','TBL','TBR'] },
    '13.1.6': { discrete: 19, desc: 'All RP22 channels (RP22 §E.2.8)',             channels: ['FL','FC','FR','FWL','FWR','SL','SL1','SR','SR1','SBL','SBR','HFC','TFL','TFR','TMC','TML','TMR','TBL','TBR'] }
  };
  var LAYOUT_KEYS_FALLBACK = ['5.1','5.1.2','5.1.4','7.1.4','9.1.4','9.1.6','11.1.6','13.1.6'];

  // ── Fallback video bands (only if SonorRP23 not loaded) ─────────────────
  var VIDEO_FALLBACK = {
    hFov: { thxBackRowMin: 30, thxAbsoluteMin: 26, thxDesignTarget: 36, ceb23Reference: 40, sweetSpotLo: 45, ituUhdReference: 58, immersiveMax: 60 },
    vFov: { smpteMaxToTop: 35, comfortToEdge: 15 },
    resolution: { acuityPpd: 60, hPixels: { '1080p': 1920, '4k': 3840, '8k': 7680 }, fullBenefitDistInScreenWidths: { '1080p': 1.7, '4k': 0.8, '8k': 0.4 } },
    luminance: { sdrReferenceFl: 16, dciDeliveredFl: 14, sdrBandLoFl: 12, sdrBandHiFl: 22, designInitialFl: 28, ambientMinFl: 40, ambientHighFl: 60, flToNits: 3.4263 }
  };

  // ── Ergonomic + build defaults (mm) — same defaults CD seeds ─────────────
  var DEFAULTS = {
    room:        { w: 4000, d: 6000, h: 2700 },
    screen:      { aspect: '16:9', diagIn: 120, bottomAfl: 400, wallVoid: 300 },
    seat:        { eyeAfl: 1120, earAfl: 1200, headTopAboveEye: 130, pitch: 1400, perW: 650, depth: 1050, recline: 1575, rowGap: 50, rearClear: 300, sideClear: 150 },
    riser:       { clearance: 50, stepMax: 220, stepPref: 180, nosingMin: 150 },
    projector:   { throwRatio: 1.5, lumens: 2500, gain: 1.0, lensToFrontMm: 0, ceilingDropMm: 200 },
    audio:       { recipe: '7.1.4', subCount: 2, subPos: 'opposite', topElevDeg: 45, surroundElevDeg: 10, ceilDrop: 0 },
    acoustics:   { c: 343 }
  };

  // ── Room-ratio references (H : W : L normalised to H = 1) ────────────────
  var ROOM_RATIOS = [
    { name: 'Sepmeyer A',   w: 1.14, l: 1.39 },
    { name: 'Sepmeyer B',   w: 1.28, l: 1.54 },
    { name: 'Sepmeyer C',   w: 1.60, l: 2.33 },
    { name: 'Louden',       w: 1.40, l: 1.90 },
    { name: 'Boner',        w: 1.26, l: 1.59 },
    { name: 'Golden ratio', w: 1.618, l: 2.618 },
    { name: 'IEC 60268-13', w: 1.50, l: 2.10 }
  ];

  global.__CINEMA_TOOLS_CONFIG__ = {
    version: VERSION, appKey: APP_KEY,
    ASPECTS: ASPECTS, COMMON_TV_IN: COMMON_TV_IN, COMMON_PJ_IN: COMMON_PJ_IN,
    SPEAKER_KLASS: SPEAKER_KLASS, klassOf: klassOf, ANGLE_TARGETS: ANGLE_TARGETS,
    LAYOUTS_FALLBACK: LAYOUTS_FALLBACK, LAYOUT_KEYS_FALLBACK: LAYOUT_KEYS_FALLBACK,
    VIDEO_FALLBACK: VIDEO_FALLBACK, DEFAULTS: DEFAULTS, ROOM_RATIOS: ROOM_RATIOS,
    // CD link contract — the key this app publishes into projects.metadata
    METADATA_KEY: 'cinema_tools',
    TABLE: 'cinema_tools_configs',
    cdUrl: function () {
      var isLocal = location.protocol === 'file:' || /localhost|127\.0\.0\.1/.test(location.hostname);
      return isLocal ? '../../APP - Cinema Design/dashboard/sonor-cinema.html' : 'https://sonorltd.github.io/sonor-cinema/dashboard/sonor-cinema.html';
    }
  };
})(typeof window !== 'undefined' ? window : this);
