# Cinema Tools — Integration Ideas

## Data this app can provide
- Per-project quick-calc options (`cinema_tools_configs.config`): room, screen geometry, seating
  layout (rows/pitch/MLP/listening area), projector throw + brightness, riser builds, RP22 speaker
  layout with CD-shaped `{channel,x,y,zMm}` rows.
- The ★ Final option as `projects.metadata.cinema_tools` (single-key merge via
  `sonor_merge_project_metadata`; this app is the ONLY writer of that key).

## Data this app consumes
- `cinema_designs` (room dims, `ct_state.metadata.{screen,seating,projector,video,speakerRecipe,audio}`,
  `display_mode`, `sub_count`) — adopt-from-CD prefill.
- `seating_configs` (rows × seats) — seat context.
- `SonorRP22` / `SonorRP23` shared standards modules (synced, never duplicated).

## Requests to other projects
- **Cinema Design**: drop in `docs/cd-patch/16c-cinema-tools.js` (options panel in the Audio tab
  sidebar, ● linked badge, `→ Plan` adopt) — verify globals against the current CD version first.
- **Cinema Takeoff**: `ct_state.room.speakers` can adopt the final speaker rows directly.
- **Project Master blueprint/brief**: surface the ★ Final summary line + `Open ↗` deep link.

## Later
- `sonor-pdf-luxury.js` proposal export (browser print for now).
- Multi-row MLP: RP22 listening-area checks per seat.
- Screen-wall elevation (baffle-wall cut-outs) + AT screen check.
- Multi-sub presets (Welti / Geddes) beyond CD's corner convention.
