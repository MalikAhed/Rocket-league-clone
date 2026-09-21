# Validation — 2026-09-21

- Original viewer folder: 306,785,102 bytes (306.8 MB).
- Compact standalone project: approximately 37.2 MB, about 88% smaller. It retains all three offline bot models.
- `npm test`: passed. All 367 runtime resources matched the packaged bytes after HTTP decoding. All 153 module/worker references resolved. Tests also covered WASM MIME, the original gameplay SHA-256, gzip fallback, conditional caching, and invalid requests.
- Browser: clean final startup without console errors; extracted arena and Fennec visible; free play, keyboard ball/dribble action, throttle movement, boost/jump diagnostic controls, and goal detection exercised. The test goal displayed GOAL. A Nexto exhibition loaded and scored. Seer and Necto files were integrity-checked but were not separately played through in this validation.
- Low preset geometry counter: 343,531 full triangles versus 206,641 selected triangles in the tracked static meshes. This is not the triangle count of the entire scene. Physics/collision data is unchanged.
- Rendering uses the display refresh cadence by default. Frame rate varied with browser visibility and other running applications; no controlled before/after FPS improvement is claimed.
- Lossless WebP preserves RGB beneath transparent pixels. Texture resizing is deliberately lossy: most textures are capped at 256 pixels; selected field/net/flag textures at 512. Existing shader reconstruction and scenery/net artifacts remain.

Run `npm start` from the repository root. Do not serve `web` alone: the included server resolves compressed assets from `packed/index.json` and streams the corresponding ranges from the pack files.
