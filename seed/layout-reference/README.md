# Auto-layout reference set

The Diagrams Auto-layout (PRD v0.3 §4.3) is judged on. Every `*.json` here is run through the layout in both directions by `src/lib/auto-layout.test.ts`, and must come out with:

- no Line passing through an Element other than its own two ends,
- no more Line crossings than the file has **as it is stored here** (the hand arrangement),
- every 1-in/1-out chain exactly on one axis,
- no overlapping Elements,
- every Frame member inside its Frame,
- Text, Icon and Free line untouched,
- the same result every time, and no change when run a second time.

The measurements come from `src/lib/layout-metrics.ts`, on the Lines as the app actually draws them. Adding a file adds it to the test suite — keep each one a Diagram JSON as exported from the editor (File → Export to JSON), arranged the way a person would arrange it, since that arrangement is the crossing baseline.

| File | What it is | Why it's here |
| --- | --- | --- |
| `starter-flowchart.json` | The "Request flow" Starter, as shipped before Auto-layout (old importer layout) | PRD: both Starters. Has a subgraph Frame and a decision. |
| `starter-er.json` | The "Database schema" Starter, as shipped before Auto-layout | PRD: both Starters. Tables, crow's-foot Lines. |
| `template-database-schema.json` | `seed/templates/database-schema.json` as authored | A hand-arranged ERD with orthogonal Lines. |
| `saas-architecture.json` | Synthetic: SaaS architecture, 25 Elements — a VPC Frame holding three subnet Frames, external services, a title Text, an Icon, a Free line divider and a legend Text | Nested Frames, Lines crossing Frame borders at several depths, a cycle through a Frame (API → Stripe → load balancer), scenery. |
| `purchase-approval.json` | Synthetic: purchase-order approval process, 17 Elements | Decisions with yes/no labels, two loops back to an earlier step (one spanning many ranks), a 2-cycle (send ↔ confirm), a fan-in, a side note Text. |
| `event-pipeline.json` | Synthetic: event/ML pipeline, 20 Elements | Wide fan-out and fan-in, Lines skipping 2–4 ranks, a curved dotted Line, dashed Lines. |

**Before sign-off the product owner adds 3–5 of their own real Diagrams here** (PRD: "3–5 Diagram thật do Owner sản phẩm chọn", at least one with nested Frames and one with a loop). The synthetic ones stand in until then; they are not a substitute for the owner's visual review of every Diagram in the set.

## Measurements

Format: Lines through Elements · crossings · chain links off-axis / chain links · overlapping pairs · members outside their Frame · scenery moved. "Old layout" is the `layoutDocument` that "Tidy layout" ran before it was removed, applied the way that command applied it (positions only; Frames, ports and bends left as they were). Recorded when Auto-layout landed (v0.3, T8).

| Diagram | Dir | Hand crossings | Old layout | Auto-layout |
| --- | --- | --- | --- | --- |
| event-pipeline | TB | 5 | 14 · 15 · 0/3 · 0 · 0 · 0 | 0 · 3 · 0/3 · 0 · 0 · 0 |
| event-pipeline | LR | 5 | 4 · 9 · 0/3 · 0 · 0 · 0 | 0 · 2 · 0/3 · 0 · 0 · 0 |
| purchase-approval | TB | 0 | 1 · 0 · 0/2 · 0 · 0 · 0 | 0 · 0 · 0/2 · 0 · 0 · 0 |
| purchase-approval | LR | 0 | 9 · 7 · 0/2 · 0 · 0 · 0 | 0 · 0 · 0/2 · 0 · 0 · 0 |
| saas-architecture | TB | 4 | 10 · 5 · 0/0 · 7 · 9 · 0 | 0 · 3 · 0/0 · 0 · 0 · 0 |
| saas-architecture | LR | 4 | 9 · 7 · 0/0 · 5 · 9 · 0 | 0 · 3 · 0/0 · 0 · 0 · 0 |
| starter-er | TB | 0 | 0 · 0 · 0/2 · 0 · 0 · 0 | 0 · 0 · 0/2 · 0 · 0 · 0 |
| starter-er | LR | 0 | 0 · 0 · 0/2 · 0 · 0 · 0 | 0 · 0 · 0/2 · 0 · 0 · 0 |
| starter-flowchart | TB | 0 | 1 · 0 · 0/1 · 1 · 0 · 0 | 0 · 0 · 0/1 · 0 · 0 · 0 |
| starter-flowchart | LR | 0 | 1 · 0 · 0/1 · 1 · 3 · 0 | 0 · 0 · 0/1 · 0 · 0 · 0 |
| template-database-schema | TB | 0 | 1 · 1 · 1/1 · 0 · 0 · 0 | 0 · 0 · 0/1 · 0 · 0 · 0 |
| template-database-schema | LR | 0 | 1 · 0 · 1/1 · 0 · 0 · 0 | 0 · 0 · 0/1 · 0 · 0 · 0 |
