# Thiết kế — Bài học (Lesson) trong X Flow Tool

| | |
| --- | --- |
| **Loại tài liệu** | Thiết kế tính năng (trước khi lập kế hoạch) |
| **Cập nhật** | 2026-11-21 |
| **Tham khảo** | `../system-design-tutorials` (40 bài JSON, ví dụ `backend/data/lessons/apis.json`) |
| **Thuật ngữ** | Theo [GLOSSARY.md](../../../GLOSSARY.md); thuật ngữ mới ở §9 |

Ghi chú: mục đánh dấu **[quyết định của người viết]** là chỗ chủ sản phẩm chưa nói tới, người viết tự chọn kèm lý do — có thể đổi.

---

## 1. Ý định

system-design-tutorials dạy bằng **bài học từng bước**: mỗi bước có một cảnh sơ đồ và lời giảng (tiêu đề, đoạn văn, callout, danh sách thay đổi, chỉ số). Chủ sản phẩm muốn X Flow Tool có tính năng **cho người dùng tự soạn bài học như vậy bằng tay**, nhưng hình vẫn theo phong cách 2D của X Flow Tool (Block, Frame, Text, Icon, Line, Line style, Effect) — không chuyển sang isometric.

- **Bài học là tính năng riêng**, đứng cạnh Diagram: danh sách riêng, màn hình soạn riêng, trang xem riêng.
- **Kế thừa X Flow Tool**: phần vẽ dùng lại toàn bộ canvas, Element, Line, Line style, Effect, Inspector, Undo/Redo.
- **Mỗi bài học riêng lẻ, tự đứng được**: không có khoá học, module, mục lục, tiến độ. Người soạn làm xong gửi Public link hoặc mở ra trình chiếu.
- **Soạn tay là chính.** JSON (có thể nhờ AI viết) chỉ là đường phụ: Import vào rồi chỉnh tiếp bằng tay.

## 2. Mục tiêu, ngoài phạm vi, phản mục tiêu

### Mục tiêu
1. Người dùng đã đăng nhập tạo, soạn, lưu, xoá bài học của mình.
2. Soạn được một bài học tương đương một bài trong tutorials (ví dụ "REST, RPC & GraphQL"): nhiều bước, hình thay đổi qua các bước, có lời giảng đầy đủ.
3. Người xem mở Public link, không cần đăng nhập, đi qua từng bước bằng chuột hoặc phím.
4. Import/Export bài học dạng JSON, có trang tài liệu định dạng cho AI.

### Ngoài phạm vi bản đầu (để sau)
- Share cho Collaborator, Version history, Save conflict cho bài học.
- Template / Starter cho bài học; trang quản trị bài học.
- Dời vị trí Element theo từng bước (mỗi Element chỉ có một vị trí cho cả bài).
- Replay từng khối (sortOrder / Run mode) bên trong một bước.
- Bài song ngữ EN/VI — mỗi bài viết bằng một ngôn ngữ.
- Chuyển 40 bài của tutorials sang.
- Khoá học, mục lục, tìm kiếm, tiến độ học, tài khoản người học, câu hỏi kiểm tra.
- Hình isometric.

### Phản mục tiêu (dù chạy được vẫn coi là hỏng)
- Người xem phải đăng nhập mới xem được Public link.
- Một file JSON hỏng hoặc thiếu trường làm trắng trang soạn hay trang xem.
- Lời giảng cho chèn HTML/script thô — trang xem là public, đây là lỗ XSS.
- Làm thay đổi hành vi Diagram hiện có: lưu trữ, Firestore rules, các bộ test rules hiện tại phải giữ nguyên và xanh.
- Người soạn phải tick tay hàng chục ô để khai báo khối nào thuộc bước nào.

## 3. Ràng buộc

- Stack hiện tại: Next.js 16 App Router (đọc `node_modules/next/dist/docs/` trước khi viết code — xem `AGENTS.md`), React 19, zustand, Tailwind 4, shadcn/ui trên Base UI, Firebase Auth + Firestore, Vercel, gói Spark (không Cloud Functions).
- Mọi tài liệu đi vào phải qua lớp "không bao giờ crash": Diagram dùng `normalizeDocument` sẵn có; phần bài học cần lớp tương đương (§6.6).
- Access list (`hasAccess()`) áp dụng cho dữ liệu của người dùng như Diagram; Public link không bị Access list chặn.
- Test: logic thuần đặt `*.test.ts` cạnh module (`npm test`); rules có test trong `tests/rules/` (`npm run test:rules`). Không có test DOM — UI kiểm bằng tay theo mục *Verifying UI work* của `CLAUDE.md`.
- Các component canvas hiện đọc trực tiếp `useEditorStore` (`src/lib/editor-store.ts`). Store này đang mang metadata riêng của Diagram (id, revision, role, Share…) và session localStorage `flowgram:session:{uid}`.

## 4. Các cách đã cân nhắc

| | Cách | Được | Mất |
| --- | --- | --- | --- |
| A | Bài học là một Diagram có thêm khối `lesson` và cờ `kind: 'lesson'`, lưu chung `users/{uid}/diagrams` | Dùng lại Save, revision, Save conflict, Public mirror, rules đã có test; Share/Version sau này gần như miễn phí | Diagram JSON phình; phải sửa validator để không vứt khối `lesson`; phải chặn mở bài học bằng editor Diagram |
| **B** | **Bài học là loại tài liệu hoàn toàn riêng**: collection, mirror, rules, test riêng; bên trong chứa một Diagram JSON | Tách bạch tuyệt đối, không đụng code Diagram đang chạy | Viết lại phần lưu/mirror/rules/test; Share/Version sau này phải làm lại lần nữa |
| C | Bài học trỏ tới một Diagram có sẵn | Dùng lại Diagram đã vẽ | Hai tài liệu phải đồng bộ; sửa/xoá Diagram làm hỏng bài; chia sẻ phải chia sẻ cả hai — trái với "riêng lẻ, tự đứng được". Loại. |

**Chủ sản phẩm chọn B.** Hệ quả: lưu trữ bài học đơn giản hơn Diagram (chỉ Owner, không revision, không Version) vì Share/Version nằm ngoài phạm vi.

## 5. Trải nghiệm người dùng (đã thống nhất)

### 5.1 Mô hình soạn: một hình chung, mỗi bước chọn hiện gì
- Mỗi bài có **một Diagram gốc**. Sửa Diagram gốc thì mọi bước thấy thay đổi.
- Bài có danh sách **Lesson step** có thứ tự (luôn ≥ 1).
- **Ghi theo bước**: đang đứng ở bước N mà vẽ / dán thêm Element hoặc Line, thì nó "xuất hiện từ bước N". Lệnh **"Bỏ khỏi bước này"** làm nó biến mất từ bước N trở đi (không xoá khỏi Diagram gốc). Xoá thật (Delete) vẫn xoá khỏi Diagram gốc như hiện nay.
- Trường hợp hiếm (ẩn rồi hiện lại, hoặc chỉ ẩn ở một bước) chỉnh trong Inspector bằng ghi đè hiện/ẩn của bước (§6.3).
- Ở mỗi bước có thể **ghi đè riêng cho bước đó**: tiêu đề Element, nhãn Line, Effect của Line (gồm tắt hẳn = tắt luồng chạy), Effect của Block, và cờ nhấn mạnh.

### 5.2 Màn hình soạn
Dựa trên `EditorShell` (canvas full width, Inspector nổi bên phải), thêm:
- **Thanh bước ở đáy**: chip từng bước (tên ngắn), thêm / xoá / nhân bản / kéo đổi thứ tự, nút "＋ Thêm bước". Bấm một bước → canvas hiện đúng trạng thái bước đó.
- **Panel lời giảng** của bước hiện tại (cạnh / trong Inspector): chương, tên ngắn, tiêu đề, lời giảng, callout, thay đổi, chỉ số.
- **Trên canvas**: Element không thuộc bước đang xem vẫn vẽ nhưng mờ hẳn và có dấu hiệu "từ bước 4" / "đến bước 3", để người soạn biết nó tồn tại; vẫn chọn và sửa được.
- **Thông tin bài** (tiêu đề, tóm tắt, thời lượng, cấp độ, định nghĩa chỉ số, mục tiêu) ở một panel/dialog riêng.
- Header: File, Undo/Redo, Save, Public, **Xem thử**.
- **Xem thử hiện bản đang soạn, kể cả chưa Save** **[quyết định của người viết: người soạn cần thấy ngay cái mình vừa sửa]**. Nó mở chế độ trình chiếu phủ lên trình soạn (không phải tab mới), bắt đầu ở bước hiện tại, `Esc` để quay lại. Vì vậy phần hiển thị của trang xem phải là một component nhận tài liệu qua prop. Route `/lessons/[id]/view` chỉ là một nguồn dữ liệu cho component đó (đọc từ Firestore), còn Xem thử là nguồn còn lại (đọc từ store của trình soạn).
- **Menu File của trình soạn bài học** **[quyết định của người viết]**:
  - *Có*: New lesson, Import JSON, Export JSON, Export image, Export SQL, Auto-layout.
  - *Không có ở bản đầu*: Template, Starter, Import Mermaid, Reset. Các lệnh này thay toàn bộ Diagram bằng id mới, nên sẽ âm thầm xoá sạch `presence` và ghi đè của các bước. Muốn bắt đầu bài từ một Diagram có sẵn thì dùng Import JSON (§6.5). `EditorShell`/`EditorFileMenu` cần cách tắt các mục này cho trình soạn bài học.
  - Auto-layout chỉ dời vị trí, giữ nguyên id, nên giữ lại an toàn.
  - **Export image xuất đúng bước đang xem** (đã áp presence, ghi đè và nhấn mạnh), không xuất cả Diagram gốc. Cách làm: hàm tính trạng thái bước (§8) cho ra một `FlowDocumentJSON` đã lọc, rồi đưa cho `ExportScene` hiện có.

```
┌ X Flow Tool · Lesson: "REST, RPC & GraphQL"   File  ↶↷  Save  Public   ▶ Preview ┐
├──────────────────────────────────────────────────────────┬───────────────────────┤
│     [mobile app]                                         │ STEP 2 · REST         │
│          │  HTTPS + JSON                                 │ Chapter: Technique ▾  │
│          ▼                                               │ Title / Body / Callout│
│     [REST API]                                           │ Changes / Metrics     │
│     ░[GraphQL]░  (from step 4)                           │                       │
├──────────────────────────────────────────────────────────┴───────────────────────┤
│ Steps: (1 Contract) [2 REST] (3 On 4G) (4 GraphQL) …  ＋ Add step                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Trang xem
- Public link mở được khi chưa đăng nhập (giống Viewer Diagram). Owner xem được bài của mình kể cả khi chưa Public.
- Bố cục: header (tiêu đề, thời lượng, cấp độ, theme, toàn màn hình); hình chiếm phần lớn; cột phải là lời giảng của bước; đáy là Prev / chấm bước / Next và danh sách mục tiêu.
- Phím: `←` `→` đổi bước, `Space` dừng/chạy Effect, `0` vừa khung.
- Chuyển bước: Element mới **hiện dần**, Element bị bỏ **mờ dần**. Element vào ở bước này được **tự động nhấn mạnh** (kèm dấu "mới"); Line Effect chạy liên tục như hiện nay.
- Mục tiêu: một mục được đánh dấu ✓ khi người xem đã tới bước nó trỏ tới (chỉ trong phiên, không lưu); bấm mục tiêu nhảy tới bước đó.
- Không tài khoản, không tiến độ, không bình luận.

```
┌ REST, RPC & GraphQL · 11 min · Beginner                          ☀/☾   ⛶ ┐
├───────────────────────────────────────────────┬────────────────────────────┤
│     [mobile app]                              │ TECHNIQUE · Step 2/8       │
│          │ ••• HTTPS + JSON •••               │ REST: resources and verbs  │
│          ▼                                    │ REST treats data as…       │
│     [REST API]  ✦ new                         │ 💡 Tip: Status codes…       │
│                                               │ + Three endpoints for…     │
│                                               │ trips 3 · payload 48 KB    │
├───────────────────────────────────────────────┴────────────────────────────┤
│  ◀ Prev   ● ● ○ ○ ○ ○ ○ ○   Next ▶          Goals: ✓ API contract  ○ …    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Nội dung bài và bước (lấy từ tutorials)
- **Bài**: tiêu đề, tóm tắt, thời lượng (phút), cấp độ (beginner / intermediate / advanced), danh sách chỉ số (id + nhãn), danh sách mục tiêu (văn bản + bước trỏ tới).
- **Bước**: tên ngắn (thanh bước), tiêu đề, chương (setup / problem / solution / technique / tradeoff / insight / recap — màu theo bảng `chapter` của tutorials), lời giảng (nhiều đoạn), callout tuỳ chọn (insight / tip / warning + văn bản), danh sách thay đổi (mỗi dòng bắt đầu `+`, `~` hoặc `-`), giá trị chỉ số (chuỗi; trống hiển thị "—").

## 6. Thiết kế kỹ thuật (phần đã quyết)

### 6.1 Route
| Route | Ghi chú |
| --- | --- |
| `/lessons` | Danh sách bài học của người dùng: tạo / mở / xoá / bật Public. Sau `AuthGate` |
| `/lessons/[id]/edit` | Màn hình soạn. Chỉ Owner. Sau `AuthGate` |
| `/lessons/[id]/view` | Trang xem. Public: ai cũng mở; không Public: chỉ Owner. Không bị Access list chặn |
| `/guide/lessons` | Tài liệu định dạng Lesson JSON cho AI/dev (cùng phong cách `/guide`) |

Trang chủ `/` và sidebar cần lối vào "Lessons" **[quyết định của người viết: một mục điều hướng cạnh Diagrams; vị trí cụ thể để builder chọn]**.

### 6.2 Lưu trữ Firestore (cách B)
- `users/{uid}/lessons/{lessonId}` = `{ name, document: LessonDocumentJSON, public: boolean, createdAt, updatedAt }`.
- `public-lessons/{lessonId}` = bản sao phẳng cho trang xem, cùng ý tưởng `public-diagrams`: có thêm `ownerUid`.
- Save = ghi đè thẳng (không transaction revision, không Version) **[quyết định của người viết: không có Collaborator nên không có Save conflict thật; hai tab cùng một người thì bản Save sau thắng]**. Nếu bài đang Public, Save cập nhật cả mirror trong cùng một batch.
- Bật Public: batch gồm cờ + mirror của bản **đã lưu** (đọc từ server, như Diagram). Tắt: cờ + xoá mirror. Xoá bài: xoá mirror rồi xoá bài.
- Rules mới, tất cả sau `hasAccess()` trừ mirror:
  - `users/{uid}/lessons/{id}`: Owner đọc/ghi/xoá; Administrator chỉ đọc **[quyết định của người viết: nhất quán với Diagram, không tốn thêm UI]**.
  - `public-lessons/{id}`: ai cũng `get`; chỉ Owner (`ownerUid == request.auth.uid`) tạo/sửa/xoá; không ai `list` **[quyết định của người viết: giống tinh thần `public-diagrams` — chỉ mở bằng id]**.
- Test rules mới trong `tests/rules/lessons.test.ts` và `tests/rules/public-lessons.test.ts`; toàn bộ test rules hiện có phải xanh không đổi.
- Không cần chỉ mục composite mới cho bản đầu (danh sách bài sắp theo `updatedAt` trên một collection của một người).

### 6.3 Định dạng `LessonDocumentJSON`
Hình dạng (tên trường builder có thể chỉnh, ngữ nghĩa thì không):

```jsonc
{
  "format": "x-flow-lesson",
  "version": 1,
  "meta": {
    "title": "REST, RPC & GraphQL",
    "summary": "…",
    "minutes": 11,
    "level": "beginner",
    "metrics": [{ "id": "trips", "label": "Round trips" }],
    "goals": [{ "text": "What an API contract is", "step": "s1" }]
  },
  "diagram": { "nodes": [], "edges": [], "settings": {} },   // FlowDocumentJSON nguyên vẹn
  "presence": {                                              // khi nào mỗi Element/Line có mặt
    "<nodeOrEdgeId>": { "from": "s1", "until": "s4" }        // until tuỳ chọn = có mặt tới hết
  },
  "steps": [
    {
      "id": "s1",
      "short": "Contract",
      "chapter": "setup",
      "title": "Programs need a contract",
      "body": "Đoạn 1…\n\nĐoạn 2 với **đậm**, `code` và [[thuật ngữ]].",
      "callout": { "kind": "insight", "text": "…" },
      "changes": ["+ Three endpoints for the profile screen"],
      "metrics": { "trips": "3" },
      "overrides": {
        "<nodeId>": { "title": "…", "effect": "glow", "visible": false, "emphasis": true },
        "<edgeId>": { "label": "…", "effect": "none", "visible": true }
      }
    }
  ]
}
```

Ngữ nghĩa:
- Bước được tham chiếu bằng **id**, không bằng chỉ số, để kéo đổi thứ tự không làm hỏng tham chiếu. `from`/`until` hiểu theo **thứ tự hiện tại** của danh sách bước: có mặt ở các bước có vị trí trong `[from, until)`.
- Element/Line không có mục trong `presence` = có mặt ở mọi bước.
- Ghi đè `visible` của một bước thắng `presence` ở đúng bước đó (đây là cách "ẩn rồi hiện lại").
- Line chỉ hiện khi chính nó có mặt **và** cả hai đầu đều hiện. Element nằm trong Frame bị ẩn thì cũng ẩn.
- Nhấn mạnh ở một bước = Element/Line có `from` là bước đó **cộng** những cái có `emphasis: true`. Khi có ít nhất một cái được nhấn mạnh, phần còn lại hơi mờ đi **[quyết định của người viết: đã đưa ra trong cuộc trao đổi, chủ sản phẩm không phản đối; độ mờ để builder chọn]**.
- Ghi đè được phép đúng các trường liệt kê: Element `title`, `effect`, `visible`, `emphasis`; Line `label`, `effect`, `visible`, `emphasis`.
- Trong bài học, Replay của Diagram (sortOrder, Run mode, repeat) **không dùng**; Effect chạy liên tục, `Space` dừng/chạy.
- Xoá một bước: Element/Line có `from` = bước đó chuyển `from` sang bước kế tiếp (hoặc bước trước nếu là bước cuối); `until` = bước đó chuyển sang bước kế tiếp (nếu là bước cuối thì bỏ `until`). Mục tiêu trỏ vào bước đó chuyển sang bước kế tiếp / trước **[quyết định của người viết]**.
- Khi kéo đổi thứ tự làm `until` đứng trước `from`, Element đó không có mặt ở bước nào — trình soạn phải cảnh báo, không tự sửa **[quyết định của người viết]**.

### 6.4 Lời giảng: định dạng văn bản an toàn
**[quyết định của người viết]** Lời giảng, callout, mục thay đổi là văn bản thuần với một tập markup nhỏ: đoạn tách bằng dòng trống, `**đậm**`, `*nghiêng*`, `` `code` ``, `[[thuật ngữ]]` (hiển thị như `.term` của tutorials). Không HTML; renderer tự viết hoặc dùng thư viện nhưng tắt HTML thô. Lý do: soạn tay trong textarea là đủ, và trang xem public không được chèn HTML.

### 6.5 Hành vi trình soạn
- Bài mới có sẵn 1 bước rỗng.
- Vẽ, dán (⌘V, dán fragment Diagram JSON), nhân bản (⌘D) khi đang ở bước N → tạo mục `presence: { from: N }` cho những gì vừa tạo. Ở bước 1 thì không cần ghi mục (có mặt mọi bước) **[quyết định của người viết: giữ JSON gọn]** — trừ khi đó không phải bước đầu.
- "Bỏ khỏi bước này" (trong Inspector và menu chuột phải nếu có) → đặt `until` = bước N. Áp cho cả selection nhiều phần tử.
- Sửa thuộc tính trong Inspector mặc định sửa **Diagram gốc**. Các trường ghi đè được (§6.3) có thêm công tắc "chỉ ở bước này" **[quyết định của người viết: cách thể hiện công tắc để builder chọn]**.
- Undo/Redo phủ **mọi** thay đổi của bài: hình, bước, presence, ghi đè, lời giảng, thông tin bài.
- Local autosave giống Diagram nhưng **khoá riêng**, không đụng `flowgram:session:{uid}`.
- "Dirty" và cảnh báo rời trang khi chưa Save, như Diagram.
- Export JSON: tải file `LessonDocumentJSON`. Import JSON: thay toàn bộ bài hiện tại (một bước Undo). Import một **Diagram JSON thường** cũng được: nó thành bài 1 bước **[quyết định của người viết: cho phép bắt đầu bài từ Diagram có sẵn mà không cần liên kết như cách C]**.

### 6.6 Chống crash
Hàm chuẩn hoá bài học thuần (Vitest), theo tinh thần `normalizeDocument`:
- `diagram` đi qua `normalizeDocument`.
- Từ chối chỉ khi không thể vẽ (không phải object, `diagram` bị từ chối). Mọi thứ khác **sửa và cảnh báo**: bước thiếu id → cấp id; id bước trùng → đổi; `presence`/`overrides`/`goals` trỏ tới Element hay bước không tồn tại → bỏ; chương / callout / cấp độ lạ → bỏ về mặc định; không có bước nào → tạo 1 bước.
- Mọi đường vào đều qua hàm này: tải từ Firestore, mirror, Import, khôi phục session.

## 7. Phần để builder quyết
- Cách tổ chức state: mở rộng `useEditorStore` với một nhánh "lesson" hay tạo store/instance riêng mà canvas vẫn dùng lại được — miễn là đáp ứng §6.5 (Undo phủ tất cả, session riêng) và không làm thay đổi hành vi editor Diagram.
- Cách tách component dùng chung giữa `DiagramEditor` / `DiagramViewer` và trình soạn / trang xem bài học (`EditorShell`, `RunControls`…).
- Thời lượng và kiểu chuyển cảnh fade; độ mờ của Element không thuộc bước / không được nhấn mạnh.
- Bố cục trang xem trên màn hình hẹp (gợi ý: lời giảng xuống dưới hình).
- Cách hiển thị chỉ số và callout (bám tutorials).
- Nội dung `/guide/lessons` và cập nhật `/help`, `/help/vi`, `README`, `CLAUDE.md` (mục Routes, Persistence).
- Có tự gợi ý dòng "thay đổi" từ Element vào/ra hay không (không bắt buộc).
- Chống chiếm id ở `public-lessons` (tham khảo cách `diagram-access` dùng tiền tố uid), giới hạn kích thước bài, cách khôi phục session khi không có revision.

## 8. Kiểm chứng
- Vitest cho: chuẩn hoá bài học; tính trạng thái hiển thị của một bước (presence + ghi đè + Frame + Line hai đầu + nhấn mạnh); xoá / đổi thứ tự bước; renderer markup (đặc biệt: HTML thô không bao giờ ra DOM).
- Test rules cho hai collection mới; test rules cũ xanh nguyên.
- Kiểm tay: soạn lại bài "REST, RPC & GraphQL" từ tutorials (ít nhất 5 bước, có thêm/bỏ khối, đổi Effect theo bước, callout, chỉ số, mục tiêu), bật Public, mở ở cửa sổ ẩn danh, đi hết các bước bằng phím.

## 9. Thuật ngữ mới (bổ sung GLOSSARY)
- **Lesson**: Một chuỗi Lesson step có lời giảng, dựng trên một Diagram gốc, xem được qua Public link. _Tránh_: course, tutorial, presentation.
- **Lesson step**: Một bước của Lesson — những gì hiện trên hình cộng lời giảng của bước đó. Khác **Step** của Replay. _Tránh_: slide, scene, Step (không kèm "Lesson").
- **Narration**: Phần lời giảng của một Lesson step (tiêu đề, đoạn văn, callout, thay đổi, chỉ số). _Tránh_: notes, description.

Giao diện bài học dùng tiếng Anh như phần còn lại của app **[quyết định của người viết]**; nội dung bài viết bằng ngôn ngữ người soạn chọn (font hiện có đã hỗ trợ tiếng Việt).

---

## 10. Bổ sung (2026-11-21): chuyển 40 bài của system-design-tutorials sang

Chủ sản phẩm yêu cầu sau khi duyệt: chuyển **toàn bộ** bài học của `../system-design-tutorials` thành Lesson của X Flow Tool (trước đây nằm ở "ngoài phạm vi"). Bài vẫn trình bày theo phong cách 2D.

**Nguồn:** `system-design-tutorials/backend/data/lessons/*.json` (40 bài; mỗi bước có `scene` riêng: `entities`, `links`, `flows`), bản dịch `translations/<id>.json` (bảng tra chuỗi EN → VI), nhãn chỉ số trong `frontend/src/engine/metrics.ts` (`METRIC_DEFS`, có hàm định dạng giá trị).

**Kết quả:**
- 80 file `seed/lessons/en/<id>.lesson.json` và `seed/lessons/vi/<id>.lesson.json` (mỗi bài một bản tiếng Anh và một bản tiếng Việt), commit vào repo; ai cũng Import được qua UI.
- Một script nạp toàn bộ vào **emulator** cho tài khoản thử `admin@claudecode.ai` (quyền administrator), bật Public để xem được ngay. Mật khẩu truyền qua biến môi trường, không ghi vào repo. Không ghi vào Firebase thật (rules bài học chưa deploy ở đó).

**Cách chuyển (quyết định của người viết):**
- Mặt phẳng isometric (x, y) chiếu thành mặt bằng 2D: `position = (x·S, y·S)` với một hệ số S chung, để bố cục giữ nguyên tương quan.
- Thực thể → Element: `block` → Block bo góc (màu và icon theo `color`/`glyph`), `db` → hình `database`, `queue` → hình `queue`, `device` → Block có icon điện thoại/laptop, `crowd` → Icon `users` kèm nhãn, `zone` → Frame, `panel` → Block hình `note` (tiêu đề + các dòng), `ring` → hình tròn, `ghost` → Block nét đứt mờ. Các chi tiết `sub`/`tags`/`pills`/`cpu`/`heat` gộp vào phụ đề.
- Mỗi thực thể ở các bước khác nhau có thể khác nhau (nhãn, màu, vị trí, tag). Bộ chuyển nhóm các bước có cùng "chữ ký hiển thị" thành một **biến thể** (một Element riêng), và dùng `presence` (cộng ghi đè `visible` nếu không liền mạch) để biến thể đó chỉ hiện ở đúng các bước của nó. Line làm tương tự; Line nối vào biến thể đang hiện ở bước đó.
- Luồng (`flows`) → Effect của Line. Hiệu ứng nền là luồng phổ biến nhất; bước nào khác hoặc không có luồng thì dùng ghi đè `effect` theo bước (kể cả `none`). Màu và kiểu theo `kind` (req, write, msg, heavy, fail/kill/poison, ping, slow, push…), `bounce` → chạy hai chiều.
- Lời giảng: HTML trong `body` → markup Narration (`<span class="term">` → `[[…]]`, `<b>` → `**…**`, `<em>` → `*…*`, `<code>` → `` `…` ``; thẻ khác bỏ, entity giải mã). Callout `warn` → `warning`. Chỉ số: nhãn từ `METRIC_DEFS`, giá trị qua hàm định dạng của nó thành chuỗi. Mục tiêu: chỉ số bước → id bước.
- Mọi file đầu ra phải qua `normalizeLessonDocument` **không có fix nào**.
