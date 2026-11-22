# Thiết kế — Cây bài học (Lesson tree)

| | |
| --- | --- |
| **Loại tài liệu** | Thiết kế tính năng (trước khi lập kế hoạch) |
| **Cập nhật** | 2026-11-22 |
| **Xây trên** | [2026-11-21-lessons-design.md](2026-11-21-lessons-design.md) (Lesson, Lesson step, Narration) |
| **Tham khảo** | `../system-design-tutorials`: `backend/data/curriculum.json` (9 chương, 40 bài), `frontend/src/components/Sidebar.tsx` (cây ở thanh bên), `backend/data/i18n/vi.json` (tên chương tiếng Việt) |
| **Thuật ngữ** | Theo [GLOSSARY.md](../../../GLOSSARY.md); thuật ngữ mới ở §9 |

Mục đánh dấu **[quyết định của người viết]** là chỗ chủ sản phẩm chưa nói tới, người viết tự chọn kèm lý do — có thể đổi.

---

## 1. Ý định

Bài học hiện là các mục rời: `/lessons` là một bảng phẳng, trang xem `/lessons/{id}/view` đứng một mình. Với 80 bài nạp từ system-design-tutorials (40 EN + 40 VI) thì bảng phẳng không còn dùng được, và người học không có đường đi từ bài này sang bài khác. Chủ sản phẩm muốn **tổ chức bài học theo cây như system-design-tutorials**:

- **Người soạn** sắp xếp bài của mình vào cây thư mục, thêm/sửa/xoá/sắp xếp được cây (CRUD).
- **Người học** thấy cây ở thanh bên trang xem bài và đi từ bài này sang bài khác, như thanh bên của tutorials.
- **Không được xoá một thư mục còn bài học.**

Điều này đảo một quyết định của thiết kế bài học gốc (§1 ở đó: "không có khoá học, module, mục lục, tiến độ"). Từng bài vẫn tự đứng được — cây chỉ là lớp sắp xếp và điều hướng phía trên, không đổi định dạng `LessonDocumentJSON`.

## 2. Mục tiêu, ngoài phạm vi, phản mục tiêu

### Mục tiêu
1. Mỗi người dùng có **một cây riêng** cho bài học của mình (chủ sản phẩm chọn cách A: cây thuộc người soạn, không phải một khoá chung của cả trang).
2. Trên `/lessons`: tạo thư mục (gốc hoặc con), đổi tên, đổi màu, sắp thứ tự, chuyển thư mục sang nhánh khác, chuyển bài vào thư mục, tạo bài mới ngay trong thư mục.
3. Xoá thư mục bị **chặn** khi nhánh của nó (kể cả thư mục con) còn ít nhất một bài.
4. Trang xem bài có thanh bên: cây của tác giả bài đó, bài đang xem được tô sáng, bấm để sang bài khác; người lạ chỉ thấy bài **Public**.
5. Dấu ✓ cho bài đã học tới bước cuối, tiến độ "đã học/tổng" ở mỗi thư mục, nút **Bài tiếp theo** ở bước cuối (chủ sản phẩm đồng ý cả ba).
6. Tài khoản `admin@claudecode.ai` có sẵn cây từ `curriculum.json` — **trên production** (chủ sản phẩm yêu cầu) và trên emulator.

### Ngoài phạm vi
- Một khoá học chung do administrator quản lý; chia sẻ cây; nhiều cây cho một người.
- Một bài nằm ở nhiều thư mục (mỗi bài nằm ở **tối đa một** thư mục).
- Đồng bộ tiến độ học theo tài khoản (✓ chỉ lưu trong trình duyệt).
- Tìm kiếm trong cây; cây trong Preview của editor bài học.
- Kéo-thả là tuỳ chọn (xem §7) — mọi thao tác phải làm được không cần kéo-thả.

### Phản mục tiêu (làm vậy là hỏng, dù chạy được)
- **Xoá thư mục làm mất hoặc "rơi" bài học.** Thư mục còn bài thì không xoá được — không có ngoại lệ, không có "xoá kèm bài".
- **Bản công khai của cây để lộ tiêu đề bài chưa Public**, hoặc tên một thư mục chỉ chứa bài riêng tư.
- **Lỗi đọc cây làm hỏng trang xem bài.** Cây là phần thêm: đọc lỗi hoặc không có cây → trang xem bài chạy như hôm nay, không có thanh bên.
- **Cây và danh sách bài lệch nhau vĩnh viễn** (bài có trong cây nhưng đã xoá, bài mới không hiện ở đâu).

## 3. Ràng buộc

- Stack hiện có: Next.js 16 App Router (đọc `node_modules/next/dist/docs/` trước khi viết code), React 19, zustand, Tailwind 4, shadcn/ui trên Base UI (không phải Radix), Firebase Auth + Firestore, Vitest. Không thêm thư viện mới nếu không cần [quyết định của người viết: cây tự vẽ bằng component, không thêm thư viện tree].
- Không Cloud Functions (gói miễn phí): mọi đồng bộ do client làm, rules là lớp bảo vệ.
- Kiểm thử tay chỉ trên emulator (`npm run emulators` + `npm run dev:emulator`). Production chỉ bị ghi ở bước dựng cây cho admin mà chủ sản phẩm đã yêu cầu, và bước deploy rules.
- Mật khẩu tài khoản thử không bao giờ ghi vào file trong repo.
- Thuật ngữ giao diện theo GLOSSARY: "Lesson", "Lesson step" (không "Step" trần); thuật ngữ mới ở §9.

## 4. Các cách đã cân nhắc

**Cây thuộc ai** (chủ sản phẩm chọn **A**):
- **A. Mỗi người soạn một cây** — nằm cạnh bài của chính họ; người học thấy cây của tác giả bài đang xem. Khớp mô hình "bài của tôi", rules đơn giản, admin vẫn có đúng một khoá như tutorials.
- B. Một cây chung do administrator quản lý, gom bài nhiều tác giả — cần rules mới cho phép tham chiếu bài người khác và một cây công khai toàn trang; nặng hơn và không ai yêu cầu nhiều tác giả.

**Cách lưu** (chủ sản phẩm chọn **1**):
- **1. Một tài liệu cây cho mỗi người + một bản công khai.** `users/{uid}/lesson-trees/main` giữ thư mục và chỉ mục bài (thư mục, thứ tự, tiêu đề, Public); `public-lesson-trees/{uid}` chỉ giữ phần Public. Người học 1 lần đọc; "thư mục còn bài?" luôn chính xác vì mọi thứ trong một tài liệu; mỗi thao tác là một lần ghi.
- 2. Mỗi thư mục một tài liệu, mỗi bài mang `folderId` — ít trùng lặp, nhưng xoá/chuyển nhánh ghi nhiều tài liệu, kiểm tra "còn bài" phải truy vấn, và thanh bên phải liệt kê `public-lessons` của tác giả — mỗi tài liệu đó chứa **toàn bộ** nội dung bài (vài MB cho 80 bài mỗi lần mở trang); tránh được chỉ bằng cách thêm một chỉ mục, tức là quay về cách 1.

## 5. Trải nghiệm người dùng (đã thống nhất)

### 5.1 Cấu trúc
- Thư mục **lồng nhau không giới hạn cấp**; bài học là lá. Một bài nằm ở tối đa một thư mục; bài chưa xếp nằm ở mục ảo **"Unfiled"** (chỉ người soạn thấy).
- Thư mục có **tên** (1–80 ký tự sau trim) và **màu** — 9 màu thư mục của tutorials: `sand #d5b07a`, `green #3fa456`, `violet #7c63d0`, `orange #e8834d`, `blue #2f86ce`, `teal #2a9d8f`, `rose #d9577a`, `olive #8c9a3c`, `slate #64728a` (viền là các tông đậm tương ứng: `#a4824e`, `#2a7a3d`, `#5a43a6`, `#b8602f`, `#1f63a0`, `#1d7066`, `#a83a58`, `#626d26`, `#434e61`). Mặc định `slate`.
- **Số thứ tự tự đánh** theo vị trí trong cùng cha: "01.", "02." … (hai chữ số, như tutorials). Không lưu số — đổi thứ tự là số đổi theo.
- Thứ tự là thứ tự người soạn sắp (thư mục và bài riêng từng nhóm; trong một thư mục, thư mục con hiện trước, rồi đến bài) [quyết định của người viết: giống trình quản lý file, khỏi phải trộn thứ tự hai loại].

### 5.2 Người soạn — `/lessons`
```
┌ Lessons ─────────────────────┐ ┌ 02. Scaling ───────────────────────────────┐
│ All lessons (81)             │ │ Lesson               Public  Updated   ⋯   │
│ ▾ 01. System Design (EN)  ⋯  │ │ Vertical vs Horiz.   ●       21/11     ⋯   │
│   ▸ 01. Foundations          │ │ Load Balancing       ●       21/11     ⋯   │
│   ▾ 02. Scaling   ← chọn  ⋯  │ │ …                                          │
│   ▸ 03. Data & Storage       │ │                                            │
│ ▸ 02. System Design (VI)     │ │ [+ New lesson]  (tạo trong thư mục đang chọn)│
│ Unfiled (1)                  │ │                                            │
│ [+ New folder]               │ │                                            │
└──────────────────────────────┘ └────────────────────────────────────────────┘
```
- Cột trái là cây; cột phải là bảng bài (giữ bảng hiện tại: tên, Public, cập nhật, xoá) của **mục đang chọn**: một thư mục → các bài nằm **trực tiếp** trong nó; "All lessons" → mọi bài (bảng như hôm nay, thêm cột "Folder"); "Unfiled" → bài chưa xếp. Mặc định chọn "All lessons".
- Menu ⋯ của thư mục: **New subfolder**, **Rename** (sửa tại chỗ), **Color** (9 ô màu), **Move up / Move down**, **Move to…** (hộp chọn thư mục đích hoặc "Top level"; không cho chọn chính nó hay con cháu của nó), **Delete**.
- **Delete**: nếu nhánh còn N bài → mục Delete vẫn bấm được nhưng mở hộp báo "This folder still holds N lessons. Move or delete them first." và không xoá gì [quyết định của người viết: báo rõ lý do tốt hơn một nút xám không giải thích]. Nhánh không còn bài nào → hộp xác nhận (nêu số thư mục con sẽ bị xoá cùng) rồi xoá cả nhánh.
- Menu ⋯ của bài trong bảng: **Move to folder…** (cùng hộp chọn, có "Unfiled"), **Move up / Move down** (chỉ khi đang xem một thư mục), cùng các hành động sẵn có (mở, Public, xoá).
- **New lesson** tạo bài trong thư mục đang chọn ("All lessons"/"Unfiled" → chưa xếp), rồi mở editor như hôm nay.
- Cây nhớ nhánh nào đang mở trong trình duyệt [quyết định của người viết: `localStorage` `xflow:lesson-tree-open:{uid}`].
- Trên màn hình hẹp, cây nằm trên bảng (xếp dọc).

### 5.3 Người học — `/lessons/{id}/view`
```
┌ Course ──────────────────────┐┌ (LessonPlayer như hôm nay) ────────────┐
│ ▾ 01. Foundations      1/3   ││                                        │
│     ✓ How a Request Travels  ││                                        │
│     ● Latency & Throughput   ││                                        │
│       Napkin Math            ││                                        │
│ ▸ 02. Scaling          0/5   ││      … bước cuối:  [Next lesson →]     │
└──────────────────────────────┘└────────────────────────────────────────┘
```
- Thanh bên bên trái, thu gọn được; trên màn hình hẹp là một ngăn kéo mở bằng nút ở header.
- **Cây của ai**: của **chủ bài** đang xem. Người lạ (hoặc người đăng nhập không phải chủ) đọc **bản công khai** — chỉ bài Public, thư mục không có bài Public nào trong nhánh thì ẩn. Chủ bài xem bài của mình → đọc **cây riêng** (thấy cả bài chưa Public, có nhãn "Private") [quyết định của người viết: chủ bài cần thấy cây thật khi kiểm tra].
- Bài đang xem được tô sáng; các thư mục trên đường dẫn tới nó tự mở. Bấm một bài → sang `/lessons/{id}/view` của bài đó (điều hướng client, không tải lại trang).
- **✓ đã học**: một bài được đánh dấu khi người học tới **bước cuối** của nó. Lưu trong `localStorage` `xflow:lessons-done` (tập id) — theo trình duyệt, không theo tài khoản. Mỗi thư mục hiện "đã học/tổng" tính trên **cả nhánh** (chỉ bài người đó thấy).
- **Next lesson →**: ở bước cuối, nút này dẫn tới bài kế tiếp theo thứ tự đọc của cây (duyệt sâu trước: thư mục con trước, rồi bài, đúng thứ tự hiển thị). Không có bài kế → không hiện nút.
- Bài không nằm trong cây (chưa xếp, hoặc chủ chưa có cây) → **không có thanh bên**, trang như hôm nay.

### 5.4 Cây có sẵn của admin
- Hai thư mục gốc: **"System Design (EN)"** và **"System Design (VI)"**; dưới mỗi gốc là 9 chương của `curriculum.json` theo đúng thứ tự, màu của chương; tên chương bản VI lấy từ `i18n/vi.json` (ví dụ "Nền tảng", "Mở rộng", "Dữ liệu & lưu trữ"). Bài trong chương theo thứ tự curriculum, id `tutorial-en-<id>` / `tutorial-vi-<id>`.
- Bài khác của admin (ví dụ bài REST soạn tay trên emulator) → Unfiled.
- Dựng trên **production** cho uid của `admin@claudecode.ai` (dùng quyền chủ project như lần nạp 80 bài, vì mật khẩu đã cho không đăng nhập được tài khoản production) và trên **emulator** cho tài khoản emulator.

## 6. Thiết kế kỹ thuật (phần đã quyết)

### 6.1 Dữ liệu
`users/{uid}/lesson-trees/main`:
```ts
interface LessonTree {
  format: 'x-flow-lesson-tree';
  version: 1;
  folders: Record<string, { parentId: string | null; name: string; color: FolderColor; order: number }>;
  lessons: Record<string, { folderId: string | null; order: number; title: string; public: boolean }>;
}
```
- `lessons` là **chỉ mục** mọi bài của người dùng (kể cả chưa xếp: `folderId: null`) — tiêu đề và cờ Public là bản sao để dựng bản công khai và thanh bên mà không phải đọc tài liệu bài.
- `order` là số thực tuỳ ý; chỉ thứ tự tương đối có nghĩa (sắp lại thì đánh lại 0,1,2… trong nhóm).

`public-lesson-trees/{uid}` = `{ ownerUid, folders: [...], lessons: [...], updatedAt }` — chỉ bài `public: true` và chỉ thư mục có ít nhất một bài Public trong nhánh (kèm tổ tiên của chúng). Dạng mảng `{ id, parentId, name, color, order }` / `{ id, folderId, order, title }`.

Cây không có id riêng ngoài `main`: một người một cây (ngoài phạm vi: nhiều cây).

Kích thước: mỗi mục bài ~150 byte, nên một tài liệu (giới hạn 1 MB của Firestore) chứa thoải mái vài nghìn bài — 80 bài là ~12 KB. Khi gần giới hạn, ghi sẽ lỗi rõ ràng; chia cây ra nhiều tài liệu là việc của sau này [quyết định của người viết].

### 6.2 Module thuần `src/lib/lesson/lesson-tree.ts` (Vitest)
- `normalizeLessonTree(input)` — cổng "không bao giờ crash" như `normalizeLessonDocument`: thiếu/hỏng → cây rỗng; bỏ thư mục có `parentId` trỏ tới thư mục không tồn tại hoặc tạo vòng (đưa lên gốc), màu lạ → `slate`, tên rỗng → "Untitled folder", bài trỏ tới thư mục không tồn tại → Unfiled, id `__proto__`/`constructor`/`prototype` bị bỏ; trả về `fixes`.
- Thao tác thuần, mỗi cái trả về cây mới (hoặc lỗi có lý do): `addFolder`, `renameFolder`, `recolorFolder`, `moveFolder` (từ chối đích là chính nó hay con cháu), `reorderFolder`, `deleteFolder` (**từ chối** khi `lessonCountInSubtree > 0`; ngược lại xoá cả nhánh thư mục rỗng), `moveLesson`, `reorderLesson`, `upsertLessonEntry`, `removeLessonEntry`.
- Truy vấn: `childrenOf`, `lessonCountInSubtree`, `folderNumber` ("01."), `readingOrder(tree)` (thứ tự đọc để tính "Next lesson"), `pathTo(lessonId)` (để mở sẵn nhánh).
- `reconcileLessonTree(tree, storedLessons)` — thêm bài thiếu vào Unfiled, bỏ mục của bài đã xoá, cập nhật tiêu đề/Public; trả về `{ tree, changed }`.
- `publicTreeOf(tree, ownerUid)` — dựng bản công khai (§6.1).

### 6.3 Ghi Firestore — `src/lib/firebase/lesson-tree.ts`
- `loadLessonTree(uid)`, `loadPublicLessonTree(ownerUid)`.
- `updateLessonTree(uid, edit: (tree) => LessonTree | Error)` — **transaction**: đọc cây mới nhất trên server, áp `edit`, ghi cây **và** bản công khai cùng lúc. Hai tab sửa cùng lúc không đè mất thao tác của nhau; bản công khai không bao giờ lệch cây.
- Các thao tác bài hiện có cập nhật chỉ mục **trong cùng transaction/batch** với thao tác chính:
  - `createLesson(uid, document, folderId?)` → thêm mục (thư mục được chọn, cuối nhóm).
  - `saveLesson` → nếu tiêu đề đổi, cập nhật mục (và bản công khai nếu bài Public).
  - `setLessonPublic` → cập nhật cờ trong mục và bản công khai.
  - `deleteLesson` → bỏ mục và cập nhật bản công khai.
  - Nếu người dùng chưa có cây, các thao tác trên **không** tạo cây [quyết định của người viết: người không dùng cây không phải trả thêm lần ghi]; cây được tạo lần đầu khi họ tạo thư mục, hoặc khi `/lessons` đối chiếu (dưới).
- `/lessons` khi mở: đã có `listLessons` → `reconcileLessonTree`; chỉ ghi khi `changed` và khi người dùng đã có cây. Đây là lưới an toàn cho mọi đường ghi ngoài app (script nạp bài, tab chạy code cũ).

### 6.4 Rules (`firestore.rules`, test trong `tests/rules/`)
```
match /users/{userId}/lesson-trees/{treeId} {
  allow get: if hasAccess() && (request.auth.uid == userId || isAdministrator());
  allow create, update, delete: if hasAccess() && request.auth.uid == userId && treeId == 'main';
}
match /public-lesson-trees/{ownerUid} {
  allow get: if true;
  allow list: if false;
  allow create, update: if hasAccess() && request.auth.uid == ownerUid
    && request.resource.data.ownerUid == ownerUid;
  allow delete: if hasAccess() && request.auth.uid == ownerUid;
}
```
- Khoá theo uid nên **không chiếm chỗ được** (khác `public-lessons/{id}`).
- Rules không kiểm nội dung cây sâu (danh sách bài trong bản công khai do chủ tự khai). Một chủ có thể liệt kê id bài Public của người khác trong cây của mình — trang xem chỉ mở được bài đó nếu nó vốn Public, nên không lộ gì thêm. Ghi vào Known gaps.
- Test rules: chủ đọc/ghi cây riêng; người khác và người chưa đăng nhập bị từ chối; admin chỉ đọc; bản công khai ai cũng `get`, không ai `list`; chỉ chủ ghi/xoá bản công khai của mình; `ownerUid` sai bị từ chối; người ngoài Access list bị từ chối ghi.

### 6.5 Giao diện
- `components/lessons/LessonTreePanel.tsx` (cột trái `/lessons`), `LessonFolderMenu`, hộp `MoveToFolderDialog`, `DeleteFolderDialog`; `LessonsHome` chuyển sang bố cục hai cột và lọc bảng theo mục chọn.
- `components/lessons/CourseSidebar.tsx` (thanh bên trang xem) dùng `readingOrder`/`pathTo`; `LessonViewer` xác định chủ bài (bài của mình → uid mình + cây riêng; bản công khai → `ownerUid` + `public-lesson-trees`) rồi truyền cây và `nextLessonId` cho `LessonPlayer` (thêm prop tuỳ chọn `onFinished`/`nextLessonHref`; Preview trong editor không truyền nên không đổi).
- Biểu tượng thư mục vẽ bằng SVG như tutorials (thân + nắp, tô màu thư mục).

### 6.6 Dựng cây cho admin
- `scripts/convert-tutorials.ts` ghi thêm `seed/lessons/tree.json` (cây hoàn chỉnh theo §5.4, sinh từ `curriculum.json` + `i18n/vi.json`), commit cùng các bài — để việc dựng cây không cần repo tutorials bên cạnh.
- `scripts/seed-emulator-lessons.ts` ghi thêm cây (và bản công khai) cho tài khoản emulator; `scripts/import-lessons.ts` làm tương tự cho project thật (cả hai chế độ: đăng nhập, hoặc `FIREBASE_ACCESS_TOKEN` + `--uid`). Nếu tài khoản đã có cây → **gộp**: thêm/cập nhật hai nhánh "System Design (EN/VI)" theo id thư mục cố định, giữ nguyên thư mục khác người dùng tự tạo [quyết định của người viết: chạy lại không xoá công sức của người dùng].
- Test: mọi id bài trong `tree.json` có file seed tương ứng và ngược lại; cây qua `normalizeLessonTree` không có fix.

## 7. Phần để builder quyết
- Kéo-thả trong cây (thư mục và bài) — có thì tốt, nhưng phải đi qua cùng các thao tác thuần ở §6.2 và mọi việc vẫn làm được bằng menu.
- Chi tiết bố cục hai cột trên màn hình hẹp, hiệu ứng mở/đóng nhánh, kiểu chữ.
- Cách hiện bảng "All lessons" (thêm cột Folder hay hiện đường dẫn).
- Cách lưu trạng thái thu gọn của thanh bên người học.

## 8. Kiểm chứng
- Vitest: `lesson-tree.ts` (mọi thao tác, xoá bị chặn khi nhánh còn bài kể cả ở thư mục cháu, chuyển thư mục vào con cháu bị từ chối, `readingOrder`, `publicTreeOf` không lộ bài/thư mục riêng tư, `reconcile`, normalizer với đầu vào hỏng), `tree.json` của seed.
- Rules: các ca ở §6.4 trong `tests/rules/lesson-trees.test.ts`.
- Kiểm tay trên emulator (trình duyệt): CRUD cây, chặn xoá, tạo bài trong thư mục, thanh bên người học (đăng nhập là chủ / chưa đăng nhập), ✓ và tiến độ, Next lesson, màn hình hẹp.
- Production: deploy rules (`firebase deploy --only firestore`), dựng cây admin, kiểm tra bằng cách đọc lại tài liệu cây và mở trang xem một bài trên Vercel khi chưa đăng nhập.
- Cổng cuối: `tsc`, lint, `npm test`, `npm run test:rules`, build.

## 9. Thuật ngữ mới (bổ sung GLOSSARY)
- **Lesson tree** (Cây bài học): cách một người dùng sắp xếp bài học của mình — các Lesson folder lồng nhau, mỗi Lesson nằm trong tối đa một folder.
- **Lesson folder** (Thư mục bài học): một nhánh của Lesson tree, có tên và màu; không xoá được khi nhánh còn Lesson.
- **Course sidebar** (Thanh khoá học): Lesson tree hiện bên cạnh trang xem bài cho người học — chỉ các Lesson Public, trừ khi người xem là chủ.
