# Beckwith Park Lightweight

## Play online

**[Launch the GitHub Pages version](https://malikahed.github.io/Rocket-league-clone/)**

Playable web port of the locally extracted Beckwith Park map, with the original extracted Fennec and ball visuals, RocketSim physics, free play, controller/keyboard controls, garage paint, and Seer/Necto/Nexto offline matches.

## Run

Install Node.js 22 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:4188/. No npm install, build step, account, CDN, or internet connection is needed to play. Keep the terminal running. `PORT` and `HOST` can override the default loopback address.

WASD drives, left mouse jumps, right mouse boosts, Shift powerslides, and Space toggles ball camera; use the in-game controls panel for the complete bindings and controller mapping. Escape pauses. Play → Free Play starts training; Play → Offline Play starts an exhibition.

## Graphics and performance

Open **Settings** in the top-right corner during the menu or a match. Quality, render scale, scheduling, FPS limit, and the FPS overlay save on this device. **Maximum FPS**, **Balanced**, and **Best detail** apply presets. Set FPS cap to **0** with **Uncapped** scheduling to remove the application limit; the browser, GPU and display still determine achieved performance. Matches pause while the settings dialog is open.

## Lightweight package

- One compact texture set: most textures are capped at 256 pixels, with selected pitch, net, and flag textures up to 512. Lookup tables retain their dimensions. WebP encoding preserves transparent RGB used by shader masks.
- Duplicate quality tiers and obsolete model exports are omitted. The quality selector still controls geometry and shader complexity; higher presets cannot restore omitted high-resolution textures.
- Binary geometry, physics, models, and JSON use lossless gzip. The server sends the correct Content-Encoding and MIME type; browsers decode automatically. It also supports clients without gzip.
- Low is the default preset, at the inherited 60% render scale. Uncapped rendering is the default; display-paced mode remains available to reduce GPU use. Physics retains its fixed 120 Hz simulation.
- Bot models load when an offline match is requested. All three models remain included for offline operation.

The `web` directory contains editable application modules. Binary assets and compressed vendor files are indexed in `packed/index.json` and stored in 18 `.pack` files. The server streams only the requested byte range; it does not load or unpack the complete archive into memory. Run `node unpack.mjs` to materialize every asset for editing. Some vendor source and data use `.gz` to avoid duplicate compressed/uncompressed copies. The server exposes their original URL. For a normal local checkout, this package uses the included server. The repository's GitHub Pages workflow creates a static deployment by expanding the packed assets and materializing the server's compressed/optimized fallback URLs before publishing `web/`; simply uploading the unprocessed `web` directory would not work.

Use `?keyboardOnly` in the URL to ignore a connected controller, for example when another game is using it.

## Verify

```sh
npm test
```

Tests check module/worker dependencies, every packaged HTTP resource against its decoded bytes, WebAssembly MIME types and the gameplay physics hash, uncompressed HTTP fallback, and basic server boundary handling. See `VALIDATION.md` for browser checks and size measurements.

## Source and attribution

This is an optimization of the existing Beckwith viewer, not the separate car-soccer arena project. Original map, car, ball, and texture assets were extracted locally from Rocket League. Their rights remain with their owners. This package does not apply a new blanket license to those assets.

Recovered shader JavaScript and editable application JavaScript are included. The native physics dependency is shipped as a verified WebAssembly binary with build metadata; the original Psyonix engine source and a reproducible native C++ build are not included. RocketSim is an independent simulation, not Rocket League's original engine. Existing rendering reconstruction limitations remain, including some net/scenery artifacts and differences from Unreal lighting.

Existing third-party licenses and bot notices are preserved in `web/licenses`, `web/physics/THIRD-PARTY-NOTICES.txt`, `web/vendor`, and `web/assets/bot`.


