# Seed templates

Templates live in Firestore (`templates/{id}`), not in the app bundle, so a
new one is added through the admin UI rather than a code change. These JSON
files are ready-made documents to paste in.

## Importing one

1. Sign in as an administrator and open **Admin → Templates → New template**.
2. Fill in the name, category and description in the strip under the header
   (see the table below for the intended values).
3. Toggle **Info** on the canvas dock, scroll to **JSON Playground**, paste the
   file's contents and press **Render**.
4. Press **Save**. The template now appears in *New from template* for
   everyone in the workspace.

| File | Name | Category | Description |
| --- | --- | --- | --- |
| `database-schema.json` | Database Schema | Technology | ERD tables with keys, indexes and crow's foot relationships. |
