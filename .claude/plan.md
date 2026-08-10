# Plan: Logo panel for blocks

## User choices
- Panel form: **Dialog popup** (like the existing icon picker).
- Attachment mode: **Click a logo to apply it to the currently selected block**.
- SVG delivery: **Copy `logos/logos` into `public/logos`**.

## Goal
Add a searchable, category-filtered logo picker that lets the user attach any SVG from the local `logos/` catalog to a flowchart block. A chosen logo is stored on the node as `icon: "logo:<slug>"` and rendered inside the node card.

## Architecture
1. **Build-time catalog index**  
   A Node script reads `logos/categories/*.md`, extracts each category title and the `<code>`/file slugs it lists, then writes `public/logos.json`. It also mirrors `logos/logos/*.svg` into `public/logos/*.svg` so the app can reference them as static assets.
2. **Runtime picker component**  
   `LogoPicker` is a dialog with:
   - a search input,
   - category tabs derived from `logos.json`,
   - a virtual-scrolled grid of logo thumbnails (`<img src="/logos/<slug>.svg" loading="lazy" />`),
   - a "No logo" option to clear the selection.
3. **Node integration**  
   `NodeInspector` exposes the new picker next to the existing icon picker. Selecting a logo calls `onNodeUpdate(id, { icon: "logo:<slug>" })`.
4. **Canvas rendering**  
   `FlowNodeCard` detects the `logo:` prefix and renders the SVG as an `<img>` inside the same bordered icon wrapper used for Lucide/Tabler icons.

## Files to change / create

| File | Change |
|------|--------|
| `scripts/build-logo-index.mjs` (new) | Parse category markdown files, copy SVGs to `public/logos`, emit `public/logos.json`. |
| `package.json` | Add `build:logos` script and call it from a post-install / build step so the catalog is always present. |
| `.gitignore` | Ignore generated `public/logos/` and `public/logos.json`. |
| `src/lib/flowchart-types.ts` | Extend `NodeIcon` union with `\`logo:${string}\``. |
| `src/components/LogoPicker.tsx` (new) | Dialog component: fetch `/logos.json`, search, category tabs, virtual grid, select/clear. |
| `src/components/NodeInspector.tsx` | Add a "Logo" row with preview thumbnail and the new `LogoPicker`; selection updates `node.icon`. |
| `src/components/FlowNodeCard.tsx` | In the icon span, branch on `logo:` prefix and render `<img src={`/logos/${slug}.svg`} />`. |

## Data shape of `public/logos.json`
```json
{
  "categories": [
    { "id": "ai", "label": "AI & Machine Learning", "count": 144 }
  ],
  "logos": [
    { "id": "anthropic", "name": "anthropic", "categories": ["ai"] }
  ]
}
```

## UX details
- The picker is opened from `NodeInspector` only when a block is selected.
- Search filters by `id` and `name` (case-insensitive substring).
- Category tabs use the first available category; an "All" tab shows every logo.
- Thumbnails are 36×36 px, `object-contain`, with a subtle hover/active ring.
- If a block already carries a logo, the picker highlights it and shows a "No logo" button to revert to the default icon behavior.
- The existing Lucide/Tabler icon picker stays untouched so both icon types remain available.

## Build / run flow
After cloning or pulling, run once:
```bash
npm run build:logos
```
Then the normal dev server works:
```bash
npm run dev
```

## Tradeoffs
- Copying ~15k files into `public/logos` is simple and lets Next.js serve them as static assets, but it increases the file count the dev server watches. If this becomes slow, the next iteration can switch to a dynamic `/api/logos/[name]` route that reads directly from `logos/logos` without copying.
- Storing only the slug (`logo:anthropic`) keeps documents small and reusable; the SVGs must be present at the same public path on every deployment.

## Out of scope
- Dragging logos from the panel onto the canvas to create new blocks (user chose click-to-apply).
- Serving SVGs via API route or inlining SVG content into the document (kept as slug references).
