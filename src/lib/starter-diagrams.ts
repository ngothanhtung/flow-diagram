import { importMermaid } from './mermaid-import';
import type { FlowDocumentJSON } from './flowchart-types';

/**
 * Built-in starting points, one per diagram kind.
 *
 * These are **not** the template library. Templates live in Firestore,
 * are curated by an administrator, and an empty collection still
 * produces an empty library — that stays true. A starter is the much
 * smaller thing an empty canvas needs: enough structure that the next
 * action is "edit this" rather than "work out where to begin", available
 * offline and on a brand new deployment with no Firestore content at
 * all.
 *
 * Each one is written as the mermaid the importer already parses, so
 * there is exactly one description of "a small sequence diagram" in the
 * codebase rather than a hand-built `FlowDocumentJSON` beside it that
 * would drift. It also means every starter doubles as a worked example
 * of what the importer accepts.
 */
export interface StarterDiagram {
  id: string;
  name: string;
  description: string;
  /** The mermaid source, also shown as the example in the import dialog. */
  source: string;
}

export const STARTER_DIAGRAMS: StarterDiagram[] = [
  {
    id: 'flowchart',
    name: 'Request flow',
    description: 'A branching flowchart: entry point, a decision, two outcomes, grouped into a layer.',
    source: `flowchart TD
    IN((Request)) --> AUTH[Authenticate]
    AUTH --> CHECK{Valid token?}
    CHECK -->|yes| HANDLE[Handle request]
    CHECK -->|no| DENY[/401 Unauthorized/]
    HANDLE --> STORE[(Write to database)]
    STORE --> DONE((Response))
    DENY --> DONE
    subgraph core [Core service]
      AUTH
      CHECK
      HANDLE
    end`,
  },
  {
    id: 'sequence',
    name: 'Service call sequence',
    description: 'Three participants exchanging messages, with an activation bar and an alt band.',
    source: `sequenceDiagram
    participant U as User
    participant A as API
    participant D as Database
    U->>A: POST /orders
    activate A
    A->>D: INSERT order
    D-->>A: order id
    alt payment declined
      A-->>U: 402 Payment Required
    end
    A-->>U: 201 Created
    deactivate A`,
  },
  {
    id: 'er',
    name: 'Database schema',
    description: 'Three tables with typed columns and crow-foot relationships.',
    source: `erDiagram
    USERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    USERS {
      uuid id PK
      string email UK
      string display_name
      timestamptz created_at
    }
    ORDERS {
      uuid id PK
      uuid user_id FK
      string status
      numeric total
    }
    ORDER_ITEMS {
      uuid id PK
      uuid order_id FK
      string sku
      int quantity
    }`,
  },
];

/**
 * Build a starter's document. Done on demand rather than stored as JSON
 * so a change to the importer or the layout is reflected here too — a
 * starter that renders differently from the same mermaid pasted into the
 * import dialog would be a bug that nothing else would catch.
 */
export function buildStarterDocument(starter: StarterDiagram): FlowDocumentJSON {
  return importMermaid(starter.source).document;
}
