# Maintaining the compact game package

Use Node.js 22 or newer. The project has no npm dependencies and uses the built-in
Node test runner.

## Choose the editable source

- `web/` contains application modules and any materialized asset overrides.
- `packed/index.json` maps packaged assets to byte ranges in `packed/*.pack`.
- `storage.mjs` reads local files first, then falls back to indexed pack segments.
- `server.mjs` serves those resources and their compressed/optimized fallback URLs.
- `docs/` is a generated GitHub Pages snapshot, not a source-documentation folder.

Make application edits in `web/`, not `docs/`. The snapshot workflow deletes and
recreates `docs/`, so hand-authored changes there will not survive regeneration.

## Work with a packed asset

For normal play and JavaScript edits, do not unpack the assets. Start the complete
checkout with:

```sh
npm start
```

If asset inspection or editing requires real files, the optional command is:

```sh
node unpack.mjs
```

It materializes the indexed assets into `web/`; it does not rebuild the pack
files or update `packed/index.json`. Existing materialized files take precedence,
including when the unpack script reads an asset. Do not treat rerunning it as a
way to reset an edited file.

Before committing, inspect `git status --short` and the diff. Unpacking can create
many derived files; include only intentional changes, preserve local work, and
do not accidentally commit an expanded duplicate of the entire asset package.

## Verify a change

```sh
npm test
```

The suite checks module/worker references, packaged HTTP responses and decoded
bytes, WebAssembly handling, gzip fallback, request boundaries, performance-setting
normalization, and nested Pages resource paths. Read failures against the
corresponding files in `tests/`; do not update integrity expectations merely to
silence a changed physics or asset hash.

For interaction or rendering changes, also run `npm start` and manually check
the affected flow. At minimum, start Free Play, drive/jump/boost, pause and resume,
then start an offline bot match. Test controller behavior separately from keyboard
behavior; `?keyboardOnly` deliberately disables connected-controller input.

A Node test pass does not establish browser rendering, all three bot playthroughs,
touch-device behavior, or a frame-rate improvement. The dated [validation
record](VALIDATION.md) describes earlier evidence, not an automatic result for a
new commit.

## Understand the Pages snapshot

On a `main` push outside `docs/**`, `.github/workflows/pages.yml`:

1. Runs `npm test`.
2. Expands the packed assets into `web/`.
3. Materializes `.gz` resources at their original uncompressed URLs and copies
   `.webp` fallbacks to the URLs the browser requests when those URLs are missing.
4. Replaces `docs/` with the prepared files and `.nojekyll`.
5. Creates a bot commit only if the snapshot changed, then pushes it to `main`.

Root-level Markdown changes also match that push trigger. The `docs/**` ignore
filter prevents the snapshot workflow from recursively rebuilding its own output;
it is not a reason to store maintainer documentation in that generated directory.
A normal non-main documentation branch avoids this snapshot trigger.

## Preserve attribution

Keep the existing asset, bot, shader, and dependency notices. The project's MIT
license applies to original contributions and does not relicense inherited Rocket
League assets or third-party components. See the README's source-and-attribution
section before redistributing a changed package.
