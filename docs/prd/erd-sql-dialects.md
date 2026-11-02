# PRD — Table theo loại database (PostgreSQL / MySQL / SQL Server)

| | |
| --- | --- |
| **Loại tài liệu** | PRD + thiết kế cho một hạng mục |
| **Baseline** | [PRD hiện trạng](../PRD.md) · [PRD v0.3](v0.3.md) |
| **Cập nhật** | 2026-10-30 |
| **Thuật ngữ** | Dùng theo [GLOSSARY.md](../../GLOSSARY.md). Thuật ngữ mới: **Database dialect** (§6) |

---

## 1. Bối cảnh

Hiện nay một Table (`FlowNode.table`) không biết nó thuộc database nào:

- `TableColumn.dataType` là ô gõ tự do (`'uuid'`, `'varchar(255)'`…). Gợi ý có sẵn (`COMMON_TYPES` trong `TableColumnsEditor.tsx`) đều là kiểu của PostgreSQL.
- Không có ràng buộc `CHECK`.
- `defaultValue` là chữ tự do, không ai kiểm tra nó.
- `sql-export.ts` cố tình xuất SQL "kiểu ANSI": quote tên bằng `"…"`, data type giữ nguyên như người dùng gõ. Kết quả là chạy trên MySQL hay SQL Server thường lỗi.

Người dùng vẽ ERD để thiết kế schema cho **một database cụ thể**. Họ cần thiết lập đúng data type và đúng ràng buộc `CHECK` của database đó, và cần biết ngay khi gõ sai cú pháp, trước khi đem SQL đi chạy.

## 2. Mục tiêu, ngoài phạm vi, điều không được xảy ra

### Mục tiêu
1. Chọn **một Database dialect cho cả Diagram**: PostgreSQL, MySQL hoặc SQL Server.
2. Data type của cột được chọn từ danh sách đúng của dialect đó, kèm tham số (độ dài, precision/scale) có kiểm tra giới hạn.
3. Có `CHECK` ở mức cột và mức Table. App kiểm tra **cú pháp theo dialect** cùng **tên cột được dùng** trong biểu thức.
4. `DEFAULT` được kiểm tra giống `CHECK`.
5. Có cờ **Auto-increment** cho cột, xuất ra đúng cú pháp của từng dialect.
6. Đổi dialect trên Diagram đã có bảng thì app tự chuyển data type, có dialog xem trước, và cả lần đổi là một bước undo.
7. Export SQL ra đúng cú pháp của dialect: quote tên, identity, `CHECK`, index, FK.

### Ngoài phạm vi
- Import SQL (`CREATE TABLE` → Diagram).
- View, trigger, stored procedure, sequence riêng, ENUM type / domain của PostgreSQL. Những kiểu này vẫn gõ tự do được, chỉ hiện cảnh báo vàng.
- Kiểm tra theo **phiên bản** database. Chỉ nhắm một bản cho mỗi dialect: PostgreSQL 16, MySQL 8 (≥ 8.0.16, bản đầu tiên thực thi `CHECK`), SQL Server 2022.
- Kiểm tra ngữ nghĩa sâu: kiểu của vế trái/phải trong biểu thức, hàm do người dùng tự định nghĩa có tồn tại hay không.
- Chọn dialect riêng cho từng Table.
- MariaDB, SQLite, Oracle. Thiết kế phải để thêm dialect sau này dễ, nhưng lần này không làm.

### Điều không được xảy ra (dù tính năng "chạy được")
- **Chặn người dùng.** Mọi kiểm tra chỉ là cảnh báo. Save, Export, copy/paste vẫn chạy khi còn cảnh báo.
- **Diagram cũ hiện khác đi.** Diagram chưa chọn dialect phải hiện và export **y hệt hôm nay**.
- **Tự đoán khi chuyển dialect.** Cột không có kiểu tương đương, hoặc biểu thức không còn hợp lệ, phải được giữ nguyên và đánh dấu. App không được tự viết lại một biểu thức mà nó không chắc.
- **Canvas crash.** Không giá trị dialect, cột hay `CHECK` nào trong JSON được làm crash canvas (§5.7).
- **Trang chậm vì parser.** Parser SQL chỉ tải khi Diagram có dialect và mở Table để sửa (§5.4).

## 3. Trải nghiệm người dùng

### 3.1 Chọn dialect
- Trong inspector của Table, phía trên danh sách cột, có dòng **Database: [PostgreSQL ▾]**, với các lựa chọn `Not set`, `PostgreSQL`, `MySQL`, `SQL Server`. Giá trị này dùng chung cho cả Diagram: đổi ở Table nào cũng là đổi cho mọi Table.
- Dialog Export SQL cũng hiện dialect đang dùng và cho đổi ngay tại đó, đi qua cùng luồng §3.4.
- Diagram mới và Diagram cũ đều bắt đầu ở `Not set`. Ở trạng thái này app giữ đúng hành vi hiện nay: data type gõ tự do, gợi ý `COMMON_TYPES` như cũ, không kiểm tra gì, export kiểu cũ. Riêng phần `CHECK` (§3.3) vẫn nhập được, nhưng không kiểm tra cú pháp. Khi đang `Not set`, inspector hiện một dòng mời: "Chọn database để kiểm tra data type và CHECK".

### 3.2 Data type của cột
Khi đã có dialect:
- Ô data type là **combobox** liệt kê các kiểu của dialect, chia nhóm Số / Chuỗi / Ngày giờ / Logic / JSON / Nhị phân / Khác. Gõ vào ô để lọc danh sách.
- Kiểu có tham số thì hiện thêm ô tham số ngay cạnh: `varchar(n)`, `char(n)`, `decimal(p,s)`, `nvarchar(n|max)`, `datetime2(p)`… App kiểm tra giới hạn của từng dialect. Ví dụ, các giới hạn tối thiểu phải có:

  | | PostgreSQL | MySQL | SQL Server |
  | --- | --- | --- | --- |
  | `varchar(n)` | 1–10 485 760 | 1–65 535 | 1–8000 hoặc `max` |
  | `nvarchar(n)` | — | — | 1–4000 hoặc `max` |
  | `char(n)` | 1–10 485 760 | 0–255 | 1–8000 |
  | `decimal(p,s)` | p 1–1000, 0 ≤ s ≤ p | p 1–65, s 0–30, s ≤ p | p 1–38, 0 ≤ s ≤ p |

- Vẫn gõ tự do được. Kiểu không có trong danh sách của dialect (domain, enum type, kiểu của dialect khác) hiện **cảnh báo vàng** ngay dưới ô, ví dụ "`jsonb` không phải data type của MySQL".
- Giá trị lưu trong `dataType` vẫn là **một chuỗi** viết theo dạng chuẩn của danh sách (`varchar(255)`, `decimal(12,2)`, `nvarchar(max)`). Combobox và ô tham số đọc và ghi đúng chuỗi đó. Nhờ vậy card trên canvas, Viewer, Mermaid import và Diagram cũ không phải đổi gì.
- Khi đã có dialect, cột mới và Table mới (`starterColumns`, `newColumn`) dùng kiểu của dialect đó. Ví dụ với SQL Server: `id uniqueidentifier`, `created_at datetime2` với default `SYSUTCDATETIME()`.

### 3.3 CHECK
- **CHECK mức cột**: mỗi cột có một ô `Check` (tuỳ chọn), viết biểu thức không có từ khoá, ví dụ `price > 0`. Biểu thức này chỉ nên dùng chính cột đó. Dùng cột khác thì cảnh báo và gợi ý chuyển sang CHECK mức Table. SQL Server từ chối trường hợp này, PostgreSQL thì khuyên không nên làm.
- **CHECK mức Table**: một mục "Checks" bên dưới danh sách cột. Mỗi dòng có tên (tuỳ chọn) và biểu thức, ví dụ `start_date < end_date`. Có nút thêm, xoá, đổi thứ tự.
- **Kiểm tra** (khi có dialect), chạy khi rời ô và khi đổi dialect:
  1. **Cú pháp theo dialect**: `code ~ '^[A-Z]'` hợp lệ trên PostgreSQL nhưng sai trên MySQL và SQL Server; `price >` thì sai ở cả ba.
  2. **Hàm**: hàm không nằm trong danh sách hàm có sẵn của dialect thì cảnh báo, ví dụ "`GETDATE` không phải hàm có sẵn của PostgreSQL — dùng `now()`?". Đây chỉ là cảnh báo, vì người dùng có thể đã tự định nghĩa hàm đó.
  3. **Cú pháp riêng mà parser bỏ sót**: ít nhất phải bắt được cast `::` trên MySQL và SQL Server (§5.3).
  4. **Tên cột**: tên cột trong biểu thức phải là cột của Table này. Ví dụ "Không có cột `prise` trong bảng `products`".
- Lỗi hiện dưới ô bằng một câu dễ đọc, chỉ rõ vị trí. Không đổ nguyên danh sách token "Expected …" của parser ra màn hình.
- Lỗi cú pháp màu đỏ, các cảnh báo còn lại màu vàng. Cả hai đều không chặn gì.

### 3.4 Đổi dialect
- Khi Diagram đang ở `Not set` mà chưa có Table nào có cột, hoặc khi đổi sang `Not set`: đổi luôn, không hỏi gì. Đổi sang `Not set` không sửa cột nào.
- Còn lại thì mở **dialog xem trước "Đổi database sang SQL Server"** gồm:
  - bảng các cột sẽ đổi: Table · cột · kiểu cũ → kiểu mới, và default cũ → default mới khi có quy tắc chuyển rõ ràng (`now()` → `SYSUTCDATETIME()`, `true` → `1` cho cột `bit`);
  - danh sách **cần tự sửa**: kiểu không có kiểu tương đương, biểu thức `CHECK`/`DEFAULT` không hợp lệ ở dialect mới. Những mục này được giữ nguyên, không đổi gì;
  - nút **Đổi database** và **Huỷ**.
- Bấm Đổi database thì dialect và mọi cột đổi trong **một lần ghi vào store, tức một bước undo**. ⌘Z đưa cả dialect lẫn kiểu dữ liệu về như cũ.
- Từ `Not set` sang một dialect, app coi mọi kiểu nhận ra được trong danh sách của **bất kỳ** dialect nào là nguồn để chuyển. Ví dụ `uuid` và `timestamptz` (từ `starterColumns` cũ) được nhận là kiểu PostgreSQL. Kiểu không nhận ra được thì vào danh sách cần tự sửa.
- Bảng chuyển kiểu tối thiểu, để builder bổ sung thêm:

  | Ý nghĩa | PostgreSQL | MySQL | SQL Server |
  | --- | --- | --- | --- |
  | UUID | `uuid` | `char(36)` | `uniqueidentifier` |
  | Chuỗi dài | `text` | `text` | `nvarchar(max)` |
  | Logic | `boolean` | `tinyint(1)` | `bit` |
  | Thời điểm có múi giờ | `timestamptz` | `datetime` (mất múi giờ: ghi chú trong dialog) | `datetimeoffset` |
  | Thời điểm | `timestamp` | `datetime` | `datetime2` |
  | JSON | `jsonb` / `json` | `json` | `nvarchar(max)` (ghi chú) |
  | Nhị phân | `bytea` | `blob` | `varbinary(max)` |
  | Số tự tăng | `serial` / `bigserial` | `int` / `bigint` + Auto-increment | `int` / `bigint` + Auto-increment |

  Chuyển `serial` sang dialect khác thì bật cờ Auto-increment trên cột (§3.5). Một lần chuyển nào làm mất ý nghĩa (múi giờ, kiểm tra JSON) phải hiện ghi chú trong dialog.
- **Tên kiểu trùng nhau nhưng nghĩa khác nhau** (gọi là "false friend") được chuyển **theo nghĩa**, không giữ nguyên theo tên:
  - `timestamp`: là thời điểm trong PostgreSQL và MySQL, nhưng là rowversion trong SQL Server;
  - `bit`: là bit-field trong MySQL, nhưng là kiểu logic trong SQL Server;
  - `text`: đã lỗi thời trong SQL Server;
  - `datetime`, `tinyint`.

  Cụ thể:
  - Kiểu đã hợp lệ ở dialect đích và **không** nằm trong danh sách false friend thì giữ nguyên tên.
  - Kiểu nằm trong danh sách false friend thì chuyển theo nghĩa ở dialect nguồn, và dialog ghi chú lý do (`timestamp` → `datetime2`: "trong SQL Server `timestamp` là rowversion").
  - Từ `Not set`, tên trùng được hiểu theo nghĩa **PostgreSQL**, vì gợi ý cũ (`COMMON_TYPES`, `starterColumns`) đều là kiểu PostgreSQL.

  Danh sách false friend là một bảng riêng trong `sql-dialects/`, có test.
- **DEFAULT được chuyển khi có quy tắc rõ ràng**, tức một bảng ánh xạ cố định, có test. Ví dụ: `now()` / `CURRENT_TIMESTAMP` ↔ `SYSUTCDATETIME()`; `gen_random_uuid()` ↔ `NEWID()` ↔ `(UUID())`; `true` / `false` ↔ `1` / `0` cho `bit` và `tinyint(1)`. Biểu thức nào không khớp hoàn toàn một quy tắc thì giữ nguyên và vào danh sách cần tự sửa. CHECK không bao giờ được tự viết lại.

### 3.5 Auto-increment
- Thêm cờ **AI** vào hàng cờ của cột, cạnh PK/FK/U/IX/NULL. Cờ chỉ bật được khi data type là kiểu số nguyên. Bật trên kiểu khác thì cảnh báo vàng.
- Export: PostgreSQL ra `GENERATED BY DEFAULT AS IDENTITY`, MySQL ra `AUTO_INCREMENT`, SQL Server ra `IDENTITY(1,1)`. Ở `Not set` cờ vẫn lưu, nhưng export bỏ qua, như cách export hiện nay vốn không biết cờ này. Card trên canvas hiện badge `AI`.

### 3.6 Export SQL
Khi có dialect, `buildCreateTableSql(document)` đọc `settings.sqlDialect` và xuất:
- quote tên theo dialect, chỉ khi tên cần quote: `"users"` cho PostgreSQL, `` `users` `` cho MySQL, `[users]` cho SQL Server;
- schema: `schema.table`. MySQL không có schema riêng, nên schema được hiểu là database (`` `db`.`table` ``);
- identity như §3.5;
- `CHECK` mức cột chỉ dùng chính cột đó thì ghi ngay trên dòng cột. CHECK mức cột có dùng cột khác thì xuất thành `CONSTRAINT` mức Table: biểu thức giữ nguyên, chỉ đổi chỗ đặt, để SQL Server không từ chối. `CHECK` mức Table là `CONSTRAINT ck_<table>_<n hoặc tên> CHECK (…)` trong `CREATE TABLE`;
- những gì dialect bắt buộc mà người dùng không phải tự viết: MySQL bọc DEFAULT dạng biểu thức trong ngoặc (`DEFAULT (UUID())`); Table có schema thì thêm `CREATE SCHEMA IF NOT EXISTS` (PostgreSQL) hoặc `IF SCHEMA_ID(…) IS NULL EXEC('CREATE SCHEMA …')` (SQL Server) ở đầu file;
- index và FK như hiện nay nhưng quote theo dialect;
- một dòng chú thích đầu file: `-- Generated for PostgreSQL 16 by X Flow Tool`.
- Dialog Export SQL hiện số cảnh báo còn lại, ví dụ "3 cảnh báo — xem trong inspector". Vẫn cho Copy và Download.
- `Not set`: xuất **byte-for-byte như hôm nay** với mọi document không có CHECK. Diagram cũ không có CHECK nào, nên vẫn ra y hệt. CHECK người dùng nhập ở `Not set` **vẫn được xuất**, theo kiểu ANSI như phần còn lại (`CHECK (…)`), không bị âm thầm bỏ đi.

## 4. Mô hình dữ liệu

```ts
// flowchart-types.ts
type SqlDialect = 'postgresql' | 'mysql' | 'sqlserver';

interface DiagramSettings {
  // …
  /** Unset = no dialect: free-text types, no checks, legacy export. */
  sqlDialect?: SqlDialect;
}

interface TableColumn {
  // …existing fields
  autoIncrement?: boolean;
  /** Column-level CHECK, the expression only: 'price > 0'. */
  check?: string;
}

interface TableCheck {
  id: string;
  /** Optional constraint name; export derives one when unset. */
  name?: string;
  expression: string;
}

interface TableSpec {
  // …
  checks?: TableCheck[];
}
```

- `sqlDialect` nằm trong `doc.settings`, nên nó đi theo Diagram khi Save, Version, Share, Template và JSON. Nó **ghi nhận undo** như mọi field nội dung khác, nên không được thêm vào `PRESENTATION_SETTINGS`.
- Kết quả kiểm tra (lỗi, cảnh báo) **không lưu vào document**. App tính lại mỗi khi cần.
- Copy/paste một fragment không mang theo dialect. Khi dán, cột giữ nguyên data type và được kiểm tra theo dialect của Diagram đích.

## 5. Ghi chú kỹ thuật

### 5.1 Module
- `src/lib/sql-dialects/` là phần thuần, có Vitest đầy đủ:
  - danh mục kiểu theo dialect: tên chuẩn, alias (`int4` → `integer`, `bool` → `boolean`), nhóm, tham số và giới hạn;
  - `parseDataType(dialect, text)` trả về kiểu chuẩn và tham số, hoặc báo "không nhận ra";
  - danh sách hàm có sẵn theo dialect, đủ cho `CHECK` và `DEFAULT` thông dụng (thời gian, chuỗi, toán, uuid);
  - bảng chuyển kiểu và `planDialectChange(document, to)`, trả về kết quả dùng chung cho dialog xem trước và lần ghi (§3.4);
  - quote và các phần cú pháp mà export dùng.
- `src/lib/sql-expression-check.ts` kiểm tra một biểu thức `CHECK`/`DEFAULT`: parser (§5.2) cộng các lớp kiểm tra riêng (§5.3), trả về `{ severity, message, offset? }[]`.
- `sql-export.ts` nhận dialect. Nhánh `Not set` giữ nguyên code hiện tại.

### 5.2 Parser cú pháp
Dùng `node-sql-parser`, cụ thể là bản build theo từng dialect (`node-sql-parser/build/postgresql`, `…/mysql`, `…/transactsql`; mỗi bản khoảng 220–300 KB chưa nén). Cách kiểm tra là bọc biểu thức vào một câu lệnh hoàn chỉnh rồi parse:
- CHECK: `CREATE TABLE t (<các cột của Table>, CHECK (<expr>))`;
- DEFAULT: `CREATE TABLE t (x <kiểu của cột> DEFAULT <expr>)`.

Đã thử nhanh bản 5.4.0 (2026-10-30), không đưa vào repo:
- phân biệt đúng toán tử riêng của từng dialect: `~` chỉ qua trên PostgreSQL, `REGEXP` chỉ qua trên MySQL, cả hai đều trượt trên SQL Server;
- `price >` trượt trên cả ba;
- **nhưng** nó chấp nhận mọi tên hàm (`GETDATE()` qua trên PostgreSQL), và chấp nhận `::` trên MySQL và SQL Server. Đó là lý do cần §5.3;
- thông báo lỗi là danh sách token "Expected …" rất dài. App phải viết lại thành câu dễ đọc, dùng vị trí (`location`) parser trả về.

Builder có thể chọn parser khác nếu đạt cùng kết quả trên bộ test §7.

### 5.3 Lớp kiểm tra riêng phía trên parser
Đi trên AST mà parser trả về:
- tên hàm: so với danh sách hàm của dialect, không phân biệt hoa thường;
- tên cột: so với cột của Table. Với CHECK mức cột, chỉ được dùng chính cột đó;
- cú pháp parser bỏ sót, tối thiểu là cast `::` ngoài PostgreSQL. Nếu AST không phân biệt được, dùng tokenizer nhẹ, bỏ qua phần trong chuỗi `'…'`.

### 5.4 Tải và hiệu năng
- Parser tải bằng `import()` động, **chỉ bản của dialect đang chọn**, lần đầu inspector của một Table cần kiểm tra. Diagram `Not set`, Viewer và trang chủ không tải nó. Kiểm tra data type (§3.2) là code thuần, không cần parser.
- Kiểm tra là bất đồng bộ. Trong lúc chờ, inspector không hiện cảnh báo nào, rồi cập nhật khi có kết quả. Không được hiện "đã hợp lệ" trước khi kiểm tra xong.
- Dialog xem trước §3.4 và dialog Export cần kiểm tra mọi biểu thức trong Diagram, nên cũng tải parser lúc mở.

### 5.5 Inspector
- `TableColumnsEditor.tsx` thêm: dòng Database, combobox data type cùng ô tham số, ô Check của cột, cờ AI, mục Checks của Table. Các sửa đổi vẫn ghi thẳng vào document như hiện nay.
- Đổi dialect phải đi qua một store action mới, ví dụ `setSqlDialect(dialect, plan)`, để thành một lần ghi duy nhất và ra một bước undo.
- Mỗi lần ghi cột vẫn tính lại `height: tableCardHeight(n)`. Nếu mục Checks hiện trên card (không bắt buộc, builder quyết) thì chiều cao phải tính cả phần đó.

### 5.6 Card, Viewer, ảnh export
Card hiện data type đúng như chuỗi đã lưu, và thêm badge `AI`. Không hiện cảnh báo trên canvas. Cảnh báo chỉ có trong inspector và dialog Export.

### 5.7 Document validation
- `normalizeDocument`: `settings.sqlDialect` ngoài bộ giá trị cho phép thì bỏ đi, coi như `Not set`, và ghi vào `fixes`. Thêm vào `document-vocabulary.ts` theo đúng cách `allOf<…>()`.
- `COLUMN_RULES` thêm `autoIncrement: boolean` và `check: text`. `TableSpec.checks` không phải list thì bỏ, phần tử nào hỏng (thiếu `id`/`expression` dạng text) thì bỏ phần tử đó, mỗi trường hợp đều ghi `fixes`.
- Thêm các field mới vào fuzz của `document-robustness.test.ts`.

### 5.8 Tài liệu đi kèm
Cập nhật trong cùng commit: `CLAUDE.md` (mục *Database tables (ERD)*), `/help` + `/help/vi` (mục ERD), `/guide` (field mới của `FlowDocumentJSON`), `GLOSSARY.md` (§6). Cập nhật cả `seed/templates/database-schema.json` nếu builder quyết định template mẫu nên có dialect; nếu không thì để nguyên.

## 6. Thuật ngữ mới

**Database dialect**: Loại database mà các Table của một Diagram nhắm tới (PostgreSQL, MySQL, SQL Server). Nó quyết định data type nào được chọn, biểu thức nào hợp lệ, và Export SQL viết ra cú pháp nào. _Tránh dùng_: SQL flavor, engine, DB type.

## 7. Tiêu chí nghiệm thu

- [ ] Diagram cũ, chưa chọn dialect: Table hiện y hệt; Export SQL ra **giống từng byte** với bản trước khi có tính năng (snapshot test trên `seed/templates/database-schema.json` và `seed/layout-reference/starter-er.json`).
- [ ] Chọn PostgreSQL ở Table A → inspector của Table B cũng hiện PostgreSQL; Save, reload → vẫn là PostgreSQL.
- [ ] Combobox data type chỉ liệt kê kiểu của dialect đang chọn; chọn `varchar` → hiện ô độ dài; `varchar(70000)` trên MySQL → cảnh báo vượt giới hạn; `nvarchar(max)` trên SQL Server → không cảnh báo.
- [ ] Gõ `jsonb` khi đang chọn MySQL → cảnh báo vàng, giá trị vẫn được lưu, Save vẫn chạy.
- [ ] CHECK `code ~ '^[A-Z]'`: không lỗi trên PostgreSQL, lỗi cú pháp trên MySQL và SQL Server. CHECK `code REGEXP '^[A-Z]'`: chỉ qua trên MySQL.
- [ ] CHECK `price >` → lỗi cú pháp có vị trí, câu dễ đọc, không phải danh sách token.
- [ ] CHECK `prise > 0` trên Table không có cột `prise` → cảnh báo tên cột.
- [ ] DEFAULT `GETDATE()` trên PostgreSQL → cảnh báo hàm, gợi ý `now()`. DEFAULT `now()::date` trên SQL Server → báo lỗi `::`.
- [ ] CHECK mức cột dùng cột khác → cảnh báo, gợi ý chuyển sang CHECK mức Table.
- [ ] Đổi PostgreSQL → SQL Server trên `database-schema.json` → dialog liệt kê đúng các cột đổi kiểu và mục cần tự sửa; bấm Đổi → mọi cột đổi, dialect đổi; **một** ⌘Z → về đúng như trước, cả dialect.
- [ ] Huỷ dialog đổi dialect → không có gì đổi, không có bước undo nào.
- [ ] Bật AI trên cột `bigint` → Export ra đúng cú pháp identity của cả ba dialect; bật AI trên `varchar` → cảnh báo.
- [ ] Export SQL của mỗi dialect cho `database-schema.json` (sau khi chuyển) **chạy được** trên đúng database: PostgreSQL 16, MySQL 8.0, SQL Server 2022, ví dụ bằng container Docker một lần lúc nghiệm thu, không cần đưa vào CI. Điều kiện là người dùng đã sửa xong các mục trong danh sách "cần tự sửa" của dialog đổi dialect. Các DEFAULT thông dụng (§3.4), cặp ngoặc bắt buộc của MySQL và lệnh tạo schema (§3.6) phải được app tự xử lý, người dùng không phải sửa tay (owner chọn mức này, 2026-10-30).
- [ ] Diagram `Not set` hoặc Viewer → không có request tải parser (kiểm bằng Network tab).
- [ ] JSON có `sqlDialect: 'oracle'`, `checks: 'x'`, `autoIncrement: 'yes'` → canvas không crash, `fixes` liệt kê từng chỗ đã sửa.
- [ ] Copy Table từ Diagram PostgreSQL, dán vào Diagram MySQL → data type giữ nguyên, có cảnh báo theo MySQL, dialect của Diagram đích không đổi.

## 8. Quyết định của người viết (owner chưa xác nhận từng điểm)
- Chọn dialect ngay trong inspector của Table và trong dialog Export SQL, không đặt ở File menu.
- Diagram mới mặc định `Not set`, không mặc định PostgreSQL.
- `dataType` vẫn lưu dạng chuỗi chuẩn, không tách thành `{ type, params }`. Chuỗi là thứ người dùng đọc và gõ, và Mermaid import, card, Viewer, Diagram cũ đều đã dùng chuỗi. `parseDataType` là nơi duy nhất tách chuỗi thành kiểu và tham số.
- Tên kiểu trùng nhưng khác nghĩa được chuyển theo nghĩa; từ `Not set` thì hiểu theo nghĩa PostgreSQL (§3.4).
- DEFAULT chỉ được tự chuyển theo bảng quy tắc cố định; CHECK không bao giờ được tự viết lại (§3.4).
- CHECK nhập ở `Not set` vẫn được export; CHECK mức cột dùng cột khác được export thành constraint mức Table (§3.6).
- PostgreSQL identity dùng `BY DEFAULT`, không dùng `ALWAYS`, để insert kèm id (seed, migrate dữ liệu) vẫn chạy.
- Cảnh báo chỉ hiện trong inspector và dialog Export, không hiện trên canvas.
- Tài liệu đặt ở `docs/prd/erd-sql-dialects.md`. Sẽ thêm một task vào `docs/implementation-plan.md` khi lên kế hoạch.
