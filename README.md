# Tetris — Liquid Glass Edition

A browser-based Tetris clone with an Apple Liquid Glass-inspired UI. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools.

![Tetris Liquid Glass](https://img.shields.io/badge/Status-Playable-50fa7b?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-00d4ff?style=flat-square)

## Features

- **Instant lock** — pieces lock the moment they touch down, no delay
- **Ghost piece** — shows where the current piece will land
- **Hold queue** — press `C` to store a piece for later
- **Next queue** — previews the next 5 upcoming pieces
- **SRS rotation** — Super Rotation System with full wall kick tables
- **7-bag randomizer** — fair piece distribution, every set of 7 contains all pieces
- **NES-style scoring** — increasing speed per level, line clear multipliers
- **DAS (Delayed Auto Shift)** — smooth horizontal movement when holding left/right
- **Procedural SFX** — generated via Web Audio API, no external audio files
- **Dynamic sizing** — board auto-scales to fit any viewport

## Controls

| Key | Action |
|---|---|
| `←` `→` | Move left / right |
| `↓` | Soft drop (accelerates fall, locks on contact) |
| `↑` | Rotate clockwise |
| `Space` | Hard drop (instant drop + lock) |
| `C` / `Shift` | Hold piece |
| `P` / `Escape` | Pause / Resume |

## UI Design

The visual style is inspired by Apple's Liquid Glass design language:

- **Animated background** — floating gradient orbs with smooth motion, subtle grid overlay
- **Frosted glass panels** — translucent surfaces with `backdrop-filter: blur()` and inner light reflections
- **Glass blocks** — each tetromino cell has a gradient fill, specular highlight, inner shadow, and soft border
- **Depth layering** — multiple surface opacity levels create visual hierarchy
- **Shimmer effects** — animated gradient on the title, pulsing logo glow
- **Smooth transitions** — spring-based easing on buttons, fade-in overlays

## Tech Stack

| Component | Technology |
|---|---|
| Rendering | HTML5 Canvas 2D (HiDPI-aware) |
| Styling | Vanilla CSS with custom properties |
| Logic | Vanilla JavaScript (ES2020+, strict mode) |
| Fonts | Inter + Space Grotesk (Google Fonts) |
| Audio | Web Audio API (procedural oscillators) |
| Hosting | Static files, no server required |

## Project Structure

```
tetris-glass/
├── index.html      Main page — game screens, overlays, attribution
├── style.css       Design tokens, glass components, animations, responsive
├── game.js         Game engine — board, pieces, input, rendering, audio
└── README.md
```

## Scoring

| Action | Points |
|---|---|
| Soft drop | 1 per row |
| Hard drop | 2 per row |
| 1 line clear (Single) | 100 × level |
| 2 line clear (Double) | 300 × level |
| 3 line clear (Triple) | 500 × level |
| 4 line clear (Tetris) | 800 × level |

Level increases every 10 lines cleared, which also increases the gravity speed.

## Speed Curve

| Level | Drop interval |
|---|---|
| 1 | 800ms |
| 2–3 | 600ms |
| 4–5 | 400ms |
| 6–7 | 280ms |
| 8–9 | 180ms |
| 10–12 | 120ms |
| 13–15 | 80ms |
| 16+ | 60ms |

## Running Locally

Any static file server works. For example:

```bash
npx serve . -l 3000
```

Then open `http://localhost:3000` in a browser.

## License

MIT
