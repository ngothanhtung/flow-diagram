# 001 — Redesign the `binary` edge effect as a two-layer bitstream-on-a-trace

- **Status**: DONE (superseded in feel by a follow-up revision — see note below)
- **Commit**: 1de6e4b
- **Severity**: HIGH
- **Category**: Easing & duration (loop tiling) / Physicality / Cohesion
- **Estimated scope**: 2 files, ~30 lines added/changed

## Problem

The `binary` effect ("Short and long digital packets") currently looks like a soft dotted line, not data traveling a wire:

```tsx
// src/components/edge-effect-layer.tsx:267-278 — current
{effect === 'binary' && (
  <path
    d={d}
    stroke="currentColor"
    strokeWidth={effectWidth + effectSize}
    strokeLinecap="round"
    fill="none"
    strokeDasharray="2 3 8 3"
    className="animate-[edge-traffic_1.2s_linear_infinite]"
    style={animationStyle}
  />
)}
```

Three concrete problems:

1. **Non-tiling loop.** `strokeDasharray="2 3 8 3"` has a period of `2+3+8+3 = 16`. It's animated with the borrowed `edge-traffic` keyframe (`src/app/globals.css:167-170`), which travels `stroke-dashoffset` by `-17px` — one pixel short of a full period. Every loop the dash pattern visibly snaps sideways instead of tiling seamlessly.
2. **Wrong linecap for a "digital" effect.** `strokeLinecap="round"` turns every bit segment into a soft rounded blob, which reads as fuzzy dashes, not crisp bits. The `marching` effect two cases up (`edge-effect-layer.tsx:255-265`) already gets this right with `strokeLinecap="square"`.
3. **Single flat layer, no depth.** Unlike `rail` (`edge-effect-layer.tsx:291-304`), which pairs a dim static backdrop path with a bright moving path to suggest a physical channel, `binary` is one lone traveling dash — it doesn't read as "data moving over a wire," just as a moving dotted line.

The picker preview also currently shares one generic swatch class between `marching`, `binary`, `heartbeat`, and `rail` (`src/app/globals.css:237-243`), so the dropdown doesn't even preview what the canvas will show.

## Target

A two-layer effect: a dim always-visible "trace" (the wire) plus a crisp, square-capped byte pattern traveling on top of it (the bits). The byte pattern spells out a literal 8-bit sequence `10110010` so the rhythm is deliberate, not random noise — mark length 3 for `1`, mark length 1 for `0`, gap 2 between every mark. That gives dasharray `"3 2 1 2 3 2 3 2 1 2 1 2 3 2 1 2"`, period **32**, which the new keyframe must travel exactly.

```tsx
/* target: src/components/edge-effect-layer.tsx */
{effect === 'binary' && (
  <>
    <path
      d={d}
      stroke="currentColor"
      strokeWidth={effectWidth + effectSize * 3}
      strokeOpacity={0.15}
      fill="none"
    />
    <path
      d={d}
      pathLength={undefined}
      stroke="currentColor"
      strokeWidth={effectWidth + effectSize}
      strokeLinecap="square"
      fill="none"
      strokeDasharray="3 2 1 2 3 2 3 2 1 2 1 2 3 2 1 2"
      className="animate-[edge-binary_1.05s_linear_infinite]"
      style={animationStyle}
    />
  </>
)}
```

```css
/* target: src/app/globals.css — new keyframe, placed after edge-traffic (line 170) */
/* Edge-binary: bit-stream travel for the `binary` effect. The dasharray
   "3 2 1 2 3 2 3 2 1 2 1 2 3 2 1 2" (byte 10110010, mark 3 = "1",
   mark 1 = "0", gap 2 between marks) has period 32, so offsetting by
   exactly -32 makes the loop tile with no visible seam. */
@keyframes edge-binary {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -32; }
}
```

```ts
/* target: src/components/edge-effect-layer.tsx — PATTERN_DURATION, line 29 */
binary: 1.05,
```

(up from `0.88` — the byte pattern has more visual information than the old two-segment dash; a touch slower keeps individual bits legible instead of blurring into a stripe. This duration is a judgment call — verify by eye per the feel check below, not a value from AUDIT.md.)

```css
/* target: src/app/globals.css — dedicated preview swatch, replacing binary's
   entry in the shared marching/heartbeat/rail selector (lines 237-243) */
.edge-preview-marching,
.edge-preview-heartbeat,
.edge-preview-rail {
  background: repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px, currentColor 6px 13px, transparent 13px 17px);
  animation: preview-slide .7s linear infinite;
}
.edge-preview-binary {
  background: repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 4px, currentColor 4px 6px, transparent 6px 9px);
  background-size: 18px 1px;
  animation: preview-slide .75s linear infinite;
}
```

(The preview is a scaled-down approximation of the real dasharray's short/long rhythm, sized so its 9px repeat tiles cleanly within `preview-slide`'s 18px shift — the same approximation approach already used by `.edge-preview-comet` and `.edge-preview-dots`, which don't mirror their canvas dasharrays pixel-for-pixel either.)

## Repo conventions to follow

- Two-layer "backdrop + moving foreground" is an established pattern in this file — imitate `rail` exactly (`src/components/edge-effect-layer.tsx:291-304`): a low-opacity static `<path>` first, then the animated one.
- Effect-specific keyframes live in `src/app/globals.css` alongside the others (`edge-dash`, `edge-traffic`, `edge-wave`, etc., lines 99-170); add `edge-binary` in that same block, don't inline a one-off animation.
- `TRAVEL_VELOCITY` vs `PATTERN_DURATION` in `edge-effect-layer.tsx:9-32`: `binary` is a repeating-texture effect, so it stays in `PATTERN_DURATION` (not `TRAVEL_VELOCITY`) — only change the number, not which map it lives in.
- Preview swatches follow the `.edge-preview-<effect>` naming convention seeded per effect or shared across visually-identical effects (`src/app/globals.css:172-243`) — `binary` earns its own now that it no longer looks like `marching`/`heartbeat`/`rail`.

## Steps

1. In `src/components/edge-effect-layer.tsx`, change `PATTERN_DURATION.binary` from `0.88` to `1.05` (line 29).
2. In the same file, replace the entire `{effect === 'binary' && (...)}` block (lines 267-278) with the two-path target shown above — backdrop path first, then the animated square-capped bit path with `strokeDasharray="3 2 1 2 3 2 3 2 1 2 1 2 3 2 1 2"` and `className="animate-[edge-binary_1.05s_linear_infinite]"`.
3. In `src/app/globals.css`, add the `@keyframes edge-binary { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -32; } }` block immediately after `@keyframes edge-traffic` (after line 170).
4. In `src/app/globals.css`, remove `.edge-preview-binary` from the shared selector at line 238 (leaving `.edge-preview-marching`, `.edge-preview-heartbeat`, `.edge-preview-rail` grouped as before), and add the new standalone `.edge-preview-binary` rule shown in Target, placed directly after that shared block.
5. Leave `EdgeInspector.tsx:97`'s label/description/icon untouched — "Short and long digital packets" still accurately describes the new effect; no copy change needed.

## Boundaries

- Do NOT touch any other effect branch in `edge-effect-layer.tsx` (`marching`, `heartbeat`, `rail`, etc.) — they are not in scope even though `rail` is used as a reference pattern.
- Do NOT change `TRAVEL_VELOCITY`, `particleCount`, `dotDasharray`, or `cometDasharray` — unrelated to `binary`.
- Do NOT add new dependencies or new shared components — this is a same-file dasharray/keyframe change.
- Do NOT change `EdgeInspector.tsx` beyond what step 5 explicitly declines to do (i.e., don't touch it at all).
- If the current code at any cited line has drifted from what's quoted in Problem/Target (different dasharray, different line numbers), STOP and report instead of improvising a merge.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` — expect no new errors introduced by this change (pre-existing unrelated errors in `FlowCanvas.tsx`/`edge-marker.tsx`/`ShapeToolbar.tsx` are known and out of scope). `npm run lint` — expect 0 errors (existing unused-var warnings elsewhere are unrelated).
- **Feel check**: open the app, create an edge, set its effect to "Binary" in the inspector, and confirm:
  - The line shows a dim, always-visible backdrop trace with a brighter, crisp, square-edged bit pattern traveling over it — not a single row of round dots.
  - Watch a full loop (~1 second) at 100% speed: the bit pattern must not visibly jump, snap, or skip at the seam where it repeats — it should tile perfectly.
  - In DevTools, throttle CPU or use the browser's "slow motion" (e.g. reduce `animationSpeed` via the inspector's speed control to 0.25×) and confirm the byte rhythm (long-short-long-long-short-short-long-short) is readable as distinct bits, not a blur.
  - Compare against the "Marching" effect preview in the same dropdown — both should now read as crisp/square, not one round and one square.
  - Open the effect picker dropdown itself and confirm the "Binary" preview swatch no longer looks identical to "Marching"/"Heartbeat"/"Rail" previews.
- **Done when**: the loop tiles with no visible seam at 100% and 25% speed, the bit segments render with square (not round) caps, the backdrop trace is visible but clearly secondary to the bit stream, and the picker preview is visually distinct from the three effects it used to share a swatch with.

## Follow-up revision (post-implementation)

After this plan shipped, user feedback was that the single-track short/long dash pattern still didn't read as "binary" — it looked like generic Morse-style dashes, not digital data. Revised `src/components/edge-effect-layer.tsx`'s `binary` block to two **complementary** dasharrays sharing the same `edge-binary` keyframe: one lights only the "1" bit slots at full brightness/opacity, the other lights only the "0" bit slots at `strokeOpacity=0.35` and no glow filter — so the pattern reads as an alternating bright/dim high-low signal (the universal visual shorthand for binary/digital data), not just varying dash lengths on one track. Byte stayed `10110010` (mark 3, gap 2, 8 bits) but period grew from 32 to 40 since each bit now reserves a fixed 5px slot on both tracks; `@keyframes edge-binary` in `globals.css` was updated from `-32px` to `-40px` to match, and `PATTERN_DURATION.binary` moved from `1.05` to `1.15` to keep the (now longer) pattern legible. Also switched from a per-effect `trackWidth`/`baseWidth` split to a single `baseWidth` for the backdrop, following the separate decision to unify all effects' object sizing to one consistent scale (see conversation — Laser/Glow/etc. sizing tiers were removed in the same session).
