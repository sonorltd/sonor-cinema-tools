# Cinema Tools — HANDOVER (v0.1.0, 2026-09-07)

Quick-calc companion to **Cinema Design (CD)**. Seven tools on one shared set of numbers, Seating-Configurator-style strip + scale SVG output, saved options per project, and a ★ Final option that CD references.

## Where things live

```
APP - Cinema Tools/
├── dashboard/sonor-cinema-tools.html      the app (theme lifted verbatim from Cinema Aesthetic, scoped .sc)
├── data/cinema-tools-config.js            version · aspect ratios · SPEAKER_KLASS colour map · RP22 angle bands · defaults
├── data/cinema-tools-engine.js            pure maths (screen / viewing / projector / riser / room / RP22 placement)
├── data/cinema-tools-app.js               UI · SVG renderers · Supabase saves · ★ Final publish
├── data/sonor-*.js, *.css, sonor-rp22.js, sonor-rp23.js   SYNCED COPIES — sync-everything.sh overwrites these
├── sonor-db.js                            synced copy
├── sql/2026-09-07_cinema_tools_configs.sql   already APPLIED to Supabase (table + RLS + app_versions row)
└── docs/cd-patch/16c-cinema-tools.js      drop-in for CD (options panel + ● linked badge + → Plan)
```

Register the repo as `sonor-cinema-tools` (GitHub Pages → `https://sonorltd.github.io/sonor-cinema-tools/`), add it to `sync-everything.sh`, then push via the `git-push` skill.

## Data contract

**Writes (this app only):** `cinema_tools_configs`
`{ id, project_id, project_name, label, config jsonb, app_version, is_final, archived, metadata, created_at, updated_at }`
`config` = the full cfg object: `room{w,d,h}`, `screen{aspect,diagIn,wMm,hMm,diagMm,solveBy,bottomAfl,wallVoid,contentRes}`, `seating{rows,perRow,perW,depth,recline,pitch,firstRowDist,eyeAfl,earAfl,refRow}`, `projector{throwRatio,throwMm,mode,lumens,gain,ceilingDrop}`, `riser{...}`, `audio{recipe,subCount,subPos,surrPos,topElevDeg,surroundElevDeg,frontMode,...}`, `notes`.

**★ Final →** `projects.metadata.cinema_tools` via `sonor_merge_project_metadata(p_project_id, p_patch)` (single-key merge — same RPC Cinema Aesthetic uses for `design_spec`):
```json
{ "source":"cinema-tools","app_version":"0.1.0","config_id":"<uuid>","label":"…","chosen_at":"…",
  "room":{w,d,h}, "screen":{aspect,w,h,diag_in,bottom_afl,wall_void,content_res},
  "seating":{rows,per_row,per_w,pitch,first_row_dist,eye_afl,ear_afl,mlp{x,y,row},listening_area{x,y,w,h},h_fov_mlp},
  "projector":{throw_ratio,throw_mm,lumens,gain,fl}, "riser":[{row,dist,build}],
  "audio":{recipe,sub_count,sub_pos,"speakers":[{channel,x,y,zMm,klass,az,el}]} }
```
Speaker rows use CD's `{channel,x,y,zMm}` shape so `ct_state.room.speakers` can adopt them directly. Only one `is_final` per project (partial unique index); "Clear" sets the key to `null`.

**Reads (never writes):** `cinema_designs` (room, `ct_state.metadata.screen/seating/projector/video/speakerRecipe/audio`, `display_mode`, `sub_count`), `seating_configs` (rows × seats), `projects.metadata.cinema_tools`.

**URL contract:** `?config=<uuid>` opens a saved option · `?client=1` hides the internal overview.

## Standards (consumed, not duplicated)
- Audio: `SonorRP22` (layouts §E.2.1–E.2.8, labels, PL targets). Angle bands in `ANGLE_TARGETS` (config) — RP22 §5.5–5.8 + Dolby upper-layer 30–55°. **Tops are judged on the fore/aft (section-view) elevation `elFA`**, as the Dolby/RP22 diagrams measure it; true elevation is shown alongside.
- Video: `SonorRP23.STANDARDS` — THX 26/30/36°, CEB23 40°, immersive 45–60°, ITU UHD 58°; SMPTE EG-18 ≤35° to top; 60 ppd acuity; SMPTE 196M 16 fL, 28 fL design-initial, 40/60 fL ambient.
- Riser: eye(n) sees screen bottom over head-top (eye+130) of row n−1 + clearance; builds round to `stepPref`; steps > 220 mm split (Approved Doc K).
- Room: Sepmeyer/Louden/Boner/golden/IEC ratios; axial modes f = c·n/2L; Schroeder 2000√(RT60/V).

## Speaker colour map (mirrors CD `_atmosSpks`)
screen LCR `#8058a1` · wide `#e67eb1` · surround `#4bb9d3` · surround-back `#78ba57` · top-front `#ec6061` · top-middle `#ad9978` · top-rear `#e37c59` · height `#b7b1a7` · sub `#f5d05c`. Change in ONE place: `SPEAKER_KLASS` in `cinema-tools-config.js`.

## Wiring the CD side (5 min, in CD repo)
1. Copy `docs/cd-patch/16c-cinema-tools.js` next to `16b-seating-configs.js`; add its `<script>` after it.
2. Add the panel markup (see file header) to the Audio tab sidebar → lists options, ★ on the final one, `→ Plan` adopts, `Open ↗` deep-links.
3. Optional header badge: `cinemaToolsLinkBadgeHtml()` → "● Cinema Tools: {label}".
4. `applyCinemaToolsToPlan()` touches `ROOM`, `SEAT`, `ctState.metadata.{screen,seating,speakerRecipe,audio,projector}` — verify the globals against CD v7.23 before shipping (they follow the 16b pattern but CD's names may have moved).

## Verified this session
- All 7 tabs render with no JS errors (headless Chromium); project bar loads 69 projects.
- End-to-end on 1392 Greystones: adopt from CD → save → ★ Final → `projects.metadata.cinema_tools` written (11 speakers for 5.1.4 + 2 subs). Test row `cinema_tools_configs` label "Test option — CT smoke test" left in place — archive or reuse.

## Backlog / next
- B: CD wiring (above) + screenshot the ● badge in the Seats/Audio tabs.
- B: `sonor-pdf-luxury.js` proposal export (Print/PDF is browser print for now).
- B: Multi-row MLP: RP22 "listening area" checks per seat, not just MLP.
- B: Screen-wall elevation view (baffle wall speaker cut-outs) + AT screen check.
- B: Sub placement — Welti/Geddes multi-sub presets beyond CD's corner convention.
- Housekeeping: 11 `_backup_*` tables in Supabase have RLS disabled (advisor: critical) — `ALTER TABLE … ENABLE ROW LEVEL SECURITY` pass.
