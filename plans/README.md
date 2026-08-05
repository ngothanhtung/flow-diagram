# Animation plans

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| [001](001-redesign-binary-effect.md) | Redesign the `binary` edge effect as a two-layer bitstream-on-a-trace | HIGH | DONE |

## Execution order

Just 001 for now — no dependencies, single-area change (`edge-effect-layer.tsx` + `globals.css`).

## Notes

- 001 supersedes the earlier binary findings from the quick audit (non-tiling loop, round linecap, shared preview swatch) with one combined creative redesign rather than three separate patches, since all three touch the same two files and the same visual outcome.
