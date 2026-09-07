# Cinema Tools — Claude Code Context (v0.1.0)

> **v0.1.0 (2026-09-07) — app birth.** Quick-calc companion to Cinema Design (CD). Seven tools on one
> shared set of numbers (screen · viewing · projector · riser · room · RP22 audio layout · saved
> options), Seating-Configurator-style strip + scale plan/section SVG, saved options per project,
> ★ Final published to `projects.metadata.cinema_tools` for CD to reference. Built in a chat session;
> went live from disk 2026-09-07 (repo `sonor-cinema-tools`, Pages, Master Hub card in hub v3.22.0).

> Current version: **v0.1.0**
> **Spine version: 1.3** (SONOR-APP-SPINE.md — SonorShell mounted, hidden chrome; S-4.21)
> Inherits: `../CLAUDE.md` (master brand rules + cross-project references) · `../HARMONY.md`
> Brand source: `../Branding - CORE/brand-core.xml`
> Repo: `sonor-cinema-tools` · Pages: https://sonorltd.github.io/sonor-cinema-tools/
> App key: `cinema-tools` · Theme: `slate` (`<html data-theme="slate">`)

> **⚠ READ `/CINEMA-ARCHITECTURE.md` before touching anything that reads CD/CT data.** This app is a
> READ-ONLY consumer of `cinema_designs` and `seating_configs`; it owns nothing in either.

## What this is
Client-faceable (`?client=1`) + internal quick-calc surface for cinema geometry: any screen ratio from
any one figure (CIH/CIW, masking, largest-that-fits), viewing angles (THX 26/30/36°, CEB23 40°,
immersive 45–60°, ITU UHD 58°, SMPTE EG-18 ≤35° to top, 60 ppd acuity), projector throw + fL
(SMPTE 196M 16 fL, 28 fL design, 40/60 fL ambient), riser sightlines (eye over head-top of row n−1,
steps > 220 mm split — Approved Doc K), room ratios + axial modes + Schroeder, RP22 §E.2 speaker
recipes with 3-axis offsets from the RSP, judged on fore/aft elevation `elFA`.

## Modules (keep modular — no monolith)
```
dashboard/sonor-cinema-tools.html   host: hidden SonorShell + scoped .sc canvas (theme lifted verbatim from Cinema Aesthetic)
index.html                          Pages redirect → dashboard/ (GITHUB PAGES URL LAW item 6)
data/cinema-tools-config.js         window.__CINEMA_TOOLS_CONFIG__ — version · aspect ratios · SPEAKER_KLASS colour map · ANGLE_TARGETS · defaults
data/cinema-tools-engine.js         pure maths (screen / viewing / projector / riser / room / RP22 placement) — no DOM
data/cinema-tools-app.js            UI · SVG renderers · Supabase saves · ★ Final publish
data/app-vars.css                   aliasing layer onto brand.css tokens (S-4.1)
data/sonor-*.js, *.css, sonor-rp22.js, sonor-rp23.js, sonor-db.js   SYNCED COPIES — sync-everything.sh overwrites these
sql/2026-09-07_cinema_tools_configs.sql   applied 2026-09-07 (table + RLS + partial unique index + app_versions row)
docs/cd-patch/16c-cinema-tools.js   drop-in for CD (options panel + ● linked badge + → Plan) — B-438
docs/master-hub-patch/              card.html + apply script (card landed in hub v3.22.0 — reference only now)
```

## Shared seams consumed
- `data/brand.css` + `data/app-vars.css` (S-4.1) · `data/sonor-brand.js` (appUrls, service colours)
- `sonor-db.js` (Supabase client) · `data/sonor-shell.js` + `sonor-palette.js` (S-4.21, chrome hidden)
- `data/sonor-project-bar.js` + `sonor-project-bus.js` (active project, HARMONY §6)
- `data/sonor-rp22.js` (`SonorRP22`) · `data/sonor-rp23.js` (`SonorRP23`) — standards, never duplicated
- `sonor_merge_project_metadata(p_project_id, p_patch)` RPC — the ONLY way this app touches `projects.metadata`

## Brand Overrides (preserved on brand regen)
- **Scoped luxury dark-gold canvas** (`.sc` block, raw hex confined there; `:root` untouched — S-4.1) —
  the SAME documented override as Seating Configurator / Cinema Aesthetic. Reason: client-faceable
  proposal surface. Date: 2026-09-07.
- **Speaker colour map** `SPEAKER_KLASS` (config) mirrors CD `_atmosSpks` — service-01 purple for
  LCR plus the 10-service palette by class. Change in ONE place (config); CD parity is a contract.
- Spine chrome hidden (`#sonor-header{display:none}`) — mount kept for version self-report + selfTest.

## Upstream / downstream data flows
| Direction | Table / key | Notes |
|-----------|-------------|-------|
| WRITE (only) | `cinema_tools_configs` | `{id, project_id, project_name, label, config jsonb, app_version, is_final, archived, metadata}`; soft-delete via `archived`; one `is_final` per project (partial unique index) |
| WRITE (merge) | `projects.metadata.cinema_tools` | ★ Final → single-key merge RPC; "Clear" sets the key to `null`; speaker rows use CD's `{channel,x,y,zMm}` shape |
| READ | `cinema_designs` | room, `ct_state.metadata.{screen,seating,projector,video,speakerRecipe,audio}`, `display_mode`, `sub_count` |
| READ | `seating_configs` | rows × seats |
| READ | `projects.metadata.cinema_tools` | shows the current ★ Final |
| URL | `?config=<uuid>` · `?client=1` | open a saved option · hide the internal overview |

## Feature timeline
- v0.1.0 (2026-09-07) — app birth (chat-built). 7 tabs verified headless, project bar loads live
  projects, end-to-end on 1392 Greystones (adopt from CD → save → ★ Final → metadata written; smoke
  row archived at go-live). Go-live from disk: repo + Pages + hub card + registry touchpoints.

## Rules
1. Consumer reads only — NEVER write `cinema_designs`, `seating_configs`, or any Library table.
2. `projects.metadata` is MERGE-ONLY via the RPC (root CLAUDE.md law); never rebuild the object.
3. Version bump = atomic 5-site (`/version-bump`): `data/cinema-tools-config.js VERSION`, this banner,
   Supabase `app_versions` (`cinema-tools`), plus sw/config sites if ever added.
4. Standards come from `SonorRP22` / `SonorRP23`; the config fallbacks fire only when the synced
   files are missing — never extend the fallbacks instead of the masters.
5. Keep CD parity: any change to `SPEAKER_KLASS` or the speaker-row shape is a cross-app change —
   confirm with Bryn and update CD's `_atmosSpks` / `16c-cinema-tools.js` in the same session.

## Backlog (see root BACKLOG.md B-438)
CD wiring via `docs/cd-patch/16c-cinema-tools.js` · `sonor-pdf-luxury.js` export · multi-row MLP ·
screen-wall elevation + AT check · multi-sub presets · Supabase `_backup_*` RLS housekeeping.
