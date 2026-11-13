# Research: web game framework for Coin Sniffer

Resolves issue #2 (parent map #1). Researched 2026-11-13 against first-party docs and release pages. Terms follow `GLOSSARY.md`.

## Recommendation

**Phaser 4 with TypeScript, bundled with Vite.** Desktop port later (if wanted) by wrapping the static web build in Tauri or Electron.

Why, in short:
- It is a 2D web-first game framework with a stable 4.x line that is actively released (v4.2.1 on 2026-07-09).
- Static build (HTML + JS + assets) deploys to any static host with no special headers.
- TypeScript gives a plain `vitest` unit-test path for the pure logic (level generation, scaling formula, Score and High Scores).
- Godot is the strongest rival, but only with GDScript. The C# route is blocked on web today.

## Facts verified

### Godot 4
- C# web export is still not supported: "Projects written in C# using Godot 4 currently cannot be exported to the web." Docs advise Godot 3 for C# on web. Source: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html (page is the 4.7 stable docs); same statement in https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/index.html
- Latest stable: 4.7.2 (2026-08-18). 3.6.3 also released 2026-08-22. Source: https://godotengine.org/download/archive/
- Web export needs WebAssembly and WebGL 2.0; Safari has WebGL 2.0 issues; `user://` persistence uses IndexedDB (blocked in private mode). Source: web export page above.
- Since 4.3, single-threaded web export is the default, so no cross-origin-isolation headers are needed; threaded exports need COOP/COEP headers (or a PWA service-worker workaround). Source: web export page above.
- Desktop: C# supports Windows, Linux, macOS since 4.2 (irrelevant to web, but means a C# desktop-only build exists). Source: C# docs page above.
- Testing: gdUnit4 supports GDScript and C#, has a CLI for CI, JUnit XML output and a GitHub Action. Source: https://github.com/MikeSchulze/gdUnit4

### Phaser
- Phaser 4.0.0 stable released 2026-04-10; 4.1.0 on 2026-04-30; 4.2.0 on 2026-06-19; 4.2.1 on 2026-07-09 (latest). Source: https://github.com/phaserjs/phaser/releases
- Free open-source HTML5 2D framework, WebGL and Canvas rendering, JavaScript or TypeScript with provided type definitions, distributed via npm/CDN; can be converted to native apps with third-party tools. Source: https://docs.phaser.io/phaser/getting-started/what-is-phaser
- Not verified in this pass: the docs pages for tilemaps/arcade physics returned 404 at the URLs tried. Phaser's tilemap and physics support should be confirmed from the docs when the project layout ticket is worked.

### Excalibur
- Excalibur 1.0.0 released 2026-11-08, 1.0.1 on 2026-11-13 (days old). 1.0 added a plugin API, 2D lighting, ESM-only output. Source: https://github.com/excaliburjs/Excalibur/releases (release page omits the year; inferred from ordering and that 0.32.0 was the prior release).
- TypeScript, free and open source, "batteries included", docs list Tile Maps and Physics. Source: https://excaliburjs.com/docs/

### PixiJS
- Latest v8.23.0 (2026-11-11, year inferred). Source: https://github.com/pixijs/pixijs/releases
- Describes itself as a 2D rendering engine (WebGL and WebGPU, scene graph, asset loader, text, filters), with Tauri and Electron integration mentioned. No game-level features (physics, tilemaps, entity model) are listed. Source: https://pixijs.com/8.x/guides/getting-started/intro

### Desktop-port options
- Tauri 2: wraps any HTML/JS/CSS frontend in the system webview; targets desktop and mobile. Source: https://v2.tauri.app/start/
- Electron: embeds Chromium and Node.js; Windows, macOS, Linux; docs show 45.3.2. Source: https://www.electronjs.org/docs/latest/
- Not verified: Vitest major version (docs fetch reported v5; treat as unconfirmed). Source: https://vitest.dev/guide/

## Comparison

| | Phaser 4 (TS) | Godot 4.7 (GDScript) | Godot 4.7 (C#) | Excalibur 1.0 (TS) | PixiJS 8 (TS) |
|---|---|---|---|---|---|
| Web export | Native web, static files | Works, WASM + WebGL 2 | Not supported | Native web | Native web |
| 2D top-down fit | Game framework | Strong, full editor | n/a on web | Game engine, tilemaps | Renderer only; build everything else |
| Maturity | 4.x stable since Apr 2026 | Very mature | n/a | 1.0 days old | Very mature renderer |
| Hosting | Any static host | Static, but 4.x needs care with COOP/COEP only if threaded | n/a | Any static host | Any static host |
| Testing | vitest for logic | gdUnit4 | gdUnit4 | vitest for logic | vitest for logic |
| Desktop port | Wrap in Tauri/Electron | Native export templates | Desktop only | Wrap in Tauri/Electron | Wrap in Tauri/Electron |

## Reasoning and caveats

- C# on Godot web is the deciding blocker for the C# language preference; no date for a fix was found in first-party docs.
- Godot (GDScript) is a credible runner-up: best editor, built-in desktop export. Trade-offs: GDScript instead of TypeScript, WASM payload size (docs give no absolute size), Safari WebGL 2.0 issues, IndexedDB-backed storage.
- Excalibur is the closest TypeScript alternative, but 1.0 shipped within the last week; wait-and-see is prudent. Reconsider if Phaser 4 proves rough.
- PixiJS would require building the engine layer; not justified for this scope.
- Phaser 4 is also recent (about seven months stable); pin the version.

## Follow-ups
- Confirm Phaser tilemap and physics APIs against the docs at project-layout time.
- Confirm Vitest current version at setup.
