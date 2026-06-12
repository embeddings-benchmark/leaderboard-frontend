# Blog assets

Source files and the Playwright render pipeline for the MTEB leaderboard launch post.

## Files

- `blog.md` — post draft.
- `leaderboardv{1,2,3}.png` — raw historical screenshots used inside the compositions.
- `mobile-{home,benchmark}.png` — real mobile screenshots captured from the local dev app.
- `crop-{sidebar,table,table-top,hero}.png` — cropped pieces of `leaderboardv3.png`, used by triptych / share compositions.

## Compositions (HTML → PNG)

| HTML | PNG | Canvas | What it shows |
| --- | --- | --- | --- |
| `hero-1.html` | `hero-1.png` | 2240×1180 | Centered v3 leaderboard with title + tagline below |
| `hero-3.html` | `hero-3.png` | 2240×1180 | Triptych: Filter / Explore / Inspect |
| `hero-4.html` | `hero-4.png` | 2240×1180 | Exploded layers: tilted table, floating sidebar + rows |
| `hero-5.html` | `hero-5.png` | 2240×1180 | Constellation: chips connected by dashed lines around the leaderboard |
| `hero-6.html` | `hero-6.png` | 2240×1180 | Browser-window mockup with URL bar |
| `feature-mobile.html` | `feature-mobile.png` | 2240×1180 | Two iPhone-framed mobile screenshots |
| `feature-share.html` | `feature-share.png` | 2240×1180 | Browser window with filter params highlighted in URL + share-button callout |
| `comparison.html` | `leaderboard-versions-comparison.png` | 2240×1345 | v1 / v2 / v3 diagonally stacked |

All compositions share `_stage.css` (canvas + card chrome) and `_dots.js` (`paintDots` for the random blue-dot background + `paintBorder` for the brand dotted border).

## Reproducing

```sh
cd blog
node render.mjs                  # regenerate every PNG
node render.mjs hero-5           # regenerate only matching targets (substring match)
```

Requires `playwright` from the parent project's `node_modules`. The script spins up a tiny HTTP server on `:18765`, drives Chromium through every target, and writes each PNG next to its HTML source. Re-run after editing any HTML/CSS/JS — the dot patterns are seeded so output is deterministic.
