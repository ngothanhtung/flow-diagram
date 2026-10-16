# PRD — X Flow Tool

| | |
| --- | --- |
| **Loại tài liệu** | PRD hiện trạng (as-built) + roadmap đề xuất |
| **Trạng thái sản phẩm** | MVP, dùng nội bộ; có thể tự host (`v0.1.0`) |
| **Cập nhật** | 2026-10-15 |
| **Thuật ngữ** | Dùng theo [GLOSSARY.md](../GLOSSARY.md) |

Tài liệu này mô tả X Flow Tool **như nó đang tồn tại trong code**, rồi chỉ ra khoảng trống và hướng phát triển. Chi tiết cài đặt nằm ở `CLAUDE.md`; ở đây chỉ trả lời "sản phẩm làm gì, cho ai, vì sao".

---

## 1. Tổng quan

X Flow Tool là trình soạn Diagram chạy trên trình duyệt, chuyên cho sơ đồ kiến trúc hệ thống (SaaS), quy trình nghiệp vụ (CRM/HRM, CI/CD) và sơ đồ cơ sở dữ liệu (ERD). Khác biệt so với công cụ vẽ sơ đồ thông thường: các **Line có Effect động** cho thấy dữ liệu chạy theo hướng nào, và **Replay** đi qua Diagram theo từng Step để trình bày. Diagram được lưu trên cloud theo tài khoản, có thể mở công khai ở chế độ chỉ đọc qua Public link, và có thư viện Template dùng chung do Administrator quản lý.

Mô hình triển khai: công cụ nội bộ của công ty, đồng thời đủ hướng dẫn (README) để bất kỳ ai tự dựng trên Firebase + Vercel của riêng mình.

## 2. Vấn đề và mục tiêu

### Vấn đề

Sơ đồ kiến trúc và quy trình vẽ bằng công cụ tĩnh không cho thấy **luồng dữ liệu chạy thế nào và theo thứ tự nào** — người trình bày phải giải thích bằng lời, và mỗi sơ đồ phải vẽ tay từ đầu.

### Mục tiêu

1. **Cho thấy chuyển động**: một Line thể hiện được hướng, nhịp và loại luồng (đồng bộ / bất đồng bộ / chính sách) chỉ bằng hình ảnh.
2. **Trình bày theo trình tự**: người xem thấy hệ thống "chạy" từng Step, không cần người thuyết trình chỉ tay.
3. **Rút ngắn từ ý tưởng đến Diagram hoàn chỉnh**: bắt đầu từ Template, Starter, văn bản Mermaid, hoặc Diagram JSON do AI soạn — không phải vẽ từ con số không.
4. **Chia sẻ không ma sát**: người nhận mở link là xem được, không cần tài khoản.

## 3. Persona

| Persona | Là ai | Cần gì |
| --- | --- | --- |
| **Người soạn Diagram** | Dev, BA, solution architect | Vẽ kiến trúc / quy trình / ERD nhanh; thuyết trình bằng Replay; xuất SQL DDL từ ERD; dùng AI để sinh bản nháp. |
| **Người xem** | Khách hàng, stakeholder, đồng nghiệp | Mở link, xem Diagram chạy Replay; không đăng nhập, không cài đặt. |
| **Administrator** | Người phụ trách công cụ trong công ty | Quản lý thư viện Template; xem tổng quan Diagram của mọi người dùng. |

AI agent không phải persona riêng mà là **kênh tạo nội dung** cho Người soạn Diagram (xem trụ cột 3).

## 4. Ba trụ cột giá trị

1. **Line và Effect động** — 18 Effect cho Line (travelling marks như comet, dots, laser, convoy; pattern như flow, heartbeat, ants, morse), Effect mark có thể là icon tuỳ chọn, glow, tốc độ, màu; Effect cho Block (float, breathe, glow, ripple…). Line style giúp cả Diagram dùng một "bộ từ vựng" Line thống nhất.
2. **Replay để trình bày** — Element được xếp theo Step; Run mode `sequential` / `concurrent` / `manual` / `static` phục vụ từ thuyết trình tự chạy đến chụp ảnh tĩnh.
3. **Tạo Diagram từ text / AI** — toàn bộ Diagram là một file Diagram JSON có tài liệu đặc tả riêng (`/guide`) viết cho AI và dev; dán JSON vào JSON Playground để hiển thị ngay; nhập Mermaid (`flowchart`, `erDiagram`) có tự xếp vị trí.

## 5. Yêu cầu chức năng (hiện trạng)

### 5.1 Đăng nhập và tài khoản

- Đăng nhập bằng **Google** hoặc **Email/Password**; đăng ký Email/Password đang **mở cho mọi người**.
- Mọi trang soạn thảo yêu cầu đăng nhập; Viewer thì không.
- Chưa có: quên mật khẩu, giới hạn đăng ký (xem Roadmap).

### 5.2 Danh sách Diagram (`/`)

- Bảng Diagram của chính người dùng: tìm theo tên hoặc id, sắp xếp, phân trang, số Element/Line, ngày tạo/cập nhật, cờ Public.
- Tạo mới, mở, xoá (có xác nhận), copy Public link (chỉ khi Diagram là Public).

### 5.3 Editor (`/diagrams/{id}/edit`)

**Canvas**
- Pan/zoom tự do; snap-to-grid (snap theo cạnh/góc Element, không theo tâm).
- Chọn một hoặc nhiều Element (shift-click, shift-kéo để quét vùng); kéo một Element kéo cả vùng chọn.
- Với ≥2 Element: căn lề, giãn đều khoảng cách (≥3), đồng bộ kích thước.
- Diagram lớn (>20 Element hoặc >28 Line) tự chuyển chế độ hiệu năng: chỉ vẽ phần trong khung nhìn, giảm trang trí mặc định — nhưng không bao giờ bỏ thứ người dùng đã cấu hình.

**Element**
- **Block**: 35 hình (chữ nhật, bo góc, pill, hexagon, diamond…); tiêu đề + phụ đề, icon (Lucide, Tabler, ~15.000 logo thương hiệu), màu chữ/nền/viền, đổ bóng, kiểu nền phẳng hoặc sheen, căn chỉnh, 4 cổng nối.
- **Table**: Block mang danh sách cột (kiểu dữ liệu, PK/FK, unique, index, nullable, default) — xem 5.6.
- **Frame**: nhóm Element; di chuyển/nhân bản/xoá kéo theo nội dung; "Fit to contents", "Ungroup"; Frame lồng nhau được.
- **Text**: chữ tự do, giữ xuống dòng.
- **Icon**: một icon hoặc logo đứng riêng, đổi qua lại giữa icon và logo trên cùng Element.
- **Free line**: nét thẳng, kéo từng đầu độc lập; đầu mút có marker; "Swap ends".
- "Fit to content" cho Block, Text, Icon.
- Mọi Element có kích thước tối thiểu/tối đa theo loại.

**Line**
- Nối cổng–cổng giữa hai Element; 4 kiểu định tuyến: straight, smooth-step, orthogonal, curved.
- 16 marker đầu/cuối, gồm 5 marker crow's-foot cho ERD.
- Stroke pattern solid/dashed/dotted — giữ nguyên trong mọi Run mode, kể cả khi chụp ảnh tĩnh.
- Effect (18 loại + `none`), hướng chạy (xuôi/ngược/hai chiều), số lượng mark hoặc mật độ pattern, Effect mark dạng icon, glow, màu, tốc độ.
- Nhãn Line.

**Line style**
- Bảng Line style theo từng Diagram (gợi ý sẵn: primary / secondary / async / policy).
- Gán Line style cho Line; sửa Line style thì mọi Line theo nó đổi theo.
- Line vẫn có thể ghi đè từng thuộc tính; inspector cảnh báo rõ "Line này đang ghi đè …" kèm nút Reset. Gỡ hoặc xoá Line style không làm Line đổi hình dạng.

**Inspector**
- Ngăn kéo nổi trên canvas, nội dung tuỳ theo loại Element/Line đang chọn — chỉ hiện điều khiển có tác dụng với loại đó.
- Mỗi ô màu là bộ chọn đầy đủ: 10 màu gợi ý (đổi theo theme sáng/tối), color picker, ô nhập hex.
- Không mất chữ đang gõ khi click ra ngoài.

**Tiện ích File menu**
- New, Start from a diagram (Starter), New from template, Import from mermaid, Open, Save as.
- Export to JSON, Export SQL, Share (hiện tại: lấy Public link).
- Convert dark ↔ light: đảo toàn bộ màu của Diagram giữa bảng màu nền tối và nền sáng.
- Reset: bỏ thay đổi chưa lưu (có xác nhận).

### 5.4 Replay

- Mỗi Block có thứ tự; các Block cùng thứ tự tạo thành một Step, sáng cùng lúc. Frame, Text, Icon, Free line không tham gia Replay.
- Run mode:
  - `sequential` — tự chạy theo nhịp: Line vẽ dần, Block sáng lên; tuỳ chọn lặp lại.
  - `concurrent` — mọi thứ chạy cùng lúc.
  - `manual` — người trình bày bấm Next.
  - `static` — đóng băng mọi chuyển động; Line hiển thị như nét thường. Ẩn Next/Repeat/Replay.
- Thanh điều khiển giống hệt nhau trong Editor và Viewer.

### 5.5 Lưu

- **Tự lưu cục bộ**: mọi thay đổi được ghi vào trình duyệt; tải lại trang không mất việc đang dở.
- **Lưu lên cloud**: bấm Save; trạng thái "chưa lưu" hiển thị khi Diagram khác bản đã lưu.
- Mỗi Diagram chỉ chủ sở hữu được sửa.

### 5.6 Database diagram (ERD)

- Table và Block thường dùng chung một Diagram.
- Line giữa hai Table là quan hệ: chọn cột nguồn/đích, cardinality bằng crow's-foot; nhãn tự sinh ngắn gọn (`id → user_id`).
- **Export SQL**: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ADD FOREIGN KEY`. Phía khoá ngoại được suy ra từ cờ cột, không phụ thuộc chiều vẽ Line. Kiểu dữ liệu là text tự do — hợp với mọi dialect.
- Chỉ xuất, không nhập SQL.

### 5.7 Public link và Viewer

- Bật cờ **Public** cho Diagram → nhận link `/diagrams/{id}/view`.
- Viewer: chỉ đọc, không cần đăng nhập, có đầy đủ Replay.
- Tắt Public thì link ngừng hoạt động ngay.

### 5.8 Template và Starter

- **Template**: thư viện dùng chung, lưu trên cloud, do Administrator tạo/sửa/xoá (tên, category, mô tả, nội dung). Mọi người dùng đã đăng nhập đều duyệt và dùng được. Thư viện rỗng thì hiện rỗng — không có Template dự phòng đóng gói sẵn.
- **Starter**: Diagram mẫu đi kèm app (hiện có "Request flow" và "Database schema"), luôn có sẵn kể cả khi thư viện Template rỗng.
- Chọn Template/Starter thay toàn bộ Diagram đang mở.

### 5.9 Nhập / xuất văn bản

| Chiều | Định dạng | Ghi chú |
| --- | --- | --- |
| Xuất | Diagram JSON | Tải file `.json` |
| Nhập | Diagram JSON | Dán vào JSON Playground, hiển thị ngay |
| Nhập | Mermaid `flowchart` / `graph`, `erDiagram` | Tự xếp vị trí; dòng không hiểu thành cảnh báo, hiển thị trước khi thay canvas |
| Xuất | SQL DDL | Từ các Table (5.6) |

### 5.10 Khu Administrator (`/admin/*`)

- Chỉ người có vai trò `administrators` (cấp thủ công trong Firestore).
- **Diagrams**: xem mọi Diagram của mọi người dùng, tìm theo tên/id/chủ sở hữu.
- **Templates**: quản lý thư viện Template; soạn Template bằng chính Editor.

### 5.11 Tài liệu trong app

- `/help`, `/help/vi` — hướng dẫn người dùng, song ngữ Anh/Việt.
- `/guide` — đặc tả Diagram JSON cho AI và dev soạn tay.

## 6. Yêu cầu phi chức năng

| Mảng | Yêu cầu hiện trạng |
| --- | --- |
| **Hiệu năng** | Tự giảm tải trên Diagram lớn (chỉ vẽ phần nhìn thấy, giảm hiệu ứng mặc định) mà không bỏ cấu hình của người dùng. |
| **Theme** | Sáng / tối / theo hệ thống ở mọi màn hình. Màu nội dung Diagram **không** đổi theo theme — một Diagram hiển thị giống nhau với mọi người xem. |
| **Responsive** | Header xuống dòng thay vì tràn; nút điều khiển thu thành icon trên màn hẹp; thanh công cụ hình cuộn ngang. Mục tiêu: **xem** tốt trên điện thoại; soạn thảo nhắm tới desktop. |
| **Bảo mật** | Quy tắc Firestore: người dùng chỉ đọc/ghi Diagram của mình; Public diagram ai cũng đọc được; Administrator đọc được mọi Diagram và ghi Template; mọi thứ khác bị chặn. |
| **Tương thích ngược** | Diagram lưu từ phiên bản cũ phải hiển thị y như cũ; thuộc tính mới có giá trị mặc định giữ nguyên hình dạng cũ. |
| **Tự host** | Chạy được trên Firebase gói miễn phí (Spark) + Vercel, theo README. |

## 7. Success metrics (đề xuất)

Sản phẩm chưa có analytics, nên chưa có số liệu thực. Đề xuất đo khi bổ sung:

- **Kích hoạt**: % người dùng mới lưu được Diagram đầu tiên trong phiên đầu.
- **Điểm bắt đầu**: tỉ lệ Diagram tạo từ trắng / Template / Starter / Mermaid / JSON — kiểm chứng trụ cột 3.
- **Trình bày**: % Diagram có ≥2 Step và dùng Replay; số lượt mở Viewer mỗi Public diagram — kiểm chứng trụ cột 1–2.
- **Tái sử dụng**: số Diagram tạo từ mỗi Template.

## 8. Non-goals (giai đoạn này)

- Cộng tác thời gian thực (nhiều người sửa cùng lúc).
- Soạn thảo trên điện thoại (chỉ đảm bảo xem).
- Nhập SQL.
- Loại biểu đồ Mermaid ngoài `flowchart`/`graph` và `erDiagram`.
- Billing / gói trả phí.

## 9. Roadmap đề xuất

P0 + P1 được đặc tả chi tiết trong [PRD v0.2](prd/v0.2.md); P2 trong [PRD v0.3](prd/v0.3.md).

| Ưu tiên | Hạng mục | Lý do |
| --- | --- | --- |
| **P0** | Undo / redo | Hiện không có; mọi thao tác sai chỉ sửa được bằng tay hoặc Reset toàn bộ. |
| **P0** | Xuất Diagram ra ảnh (PNG / SVG) | Hiện chỉ xuất JSON/SQL; người dùng không đưa được Diagram vào slide hay tài liệu. |
| **P1** | Phím tắt canvas: Delete, copy/paste, Ctrl+S, mũi tên để nhích | Hiện chỉ có Esc. |
| **P1** | Quên mật khẩu | Người dùng Email/Password mất mật khẩu là mất tài khoản. |
| **P1** | Giới hạn đăng ký (theo domain hoặc allowlist) | Đăng ký đang mở, mâu thuẫn với định vị công cụ nội bộ. |
| **P2** | Lịch sử phiên bản | Save ghi đè; không quay lại được bản trước. |
| **P2** | Share cho Collaborator (quyền sửa) | Hiện chỉ có Public link chỉ đọc; một Diagram chỉ có một người sửa. |
| **P2** | Tự xếp bố cục (auto-layout) | Đã có rồi bị gỡ vì kết quả trông lộn xộn; chỉ đưa lại khi thuật toán sắp xếp được cải thiện. Hiện chỉ dùng nội bộ khi nhập Mermaid. |

## Phụ lục A — Known issues

| Vấn đề | Ghi chú |
| --- | --- |
| Test tự động mới phủ logic và rules | Từ v0.2 có Vitest (logic thuần) và rules test trên emulator; UI vẫn kiểm bằng trình duyệt. |
| README lỗi thời | Vẫn liệt kê Effect đã xoá (`wave`, marching ants) và "real object silhouettes" (đã thay bằng icon). |
| Tên sản phẩm không nhất quán | `flowgram-tools` (package, README, key lưu cục bộ) vs **X Flow Tool** (UI) vs `x-flow-tool` (repo). |
| ~106 MB logo nằm trong repo | ~15.000 SVG; clone chậm, deploy nặng. |
| Nhãn UI lệch thuật ngữ | "Execution mode" / "Execution order" nên là **Run mode** / **Step**; nhãn "Line style" đang dùng cho cả Line style và Stroke pattern; "Objects on line" nên là **Effect mark**; "Group" nên là **Frame**. |
| Đổi Run mode làm Diagram "chưa lưu" | Run mode lưu trong Diagram nhưng không undo được, nên chấm "chưa lưu" không tự tắt khi đổi lại. |
| Diagram mới tự căn khung nhìn | Cho tới lần bấm canvas đầu tiên, khung nhìn tự căn lại sau mỗi lần sửa, làm hình vừa vẽ nhảy chỗ. |
| Collaborator Can edit xoá được Version chưa đặt tên | Cách Save của họ dọn Version cũ (rules không đếm tới 50). Named version luôn an toàn. |
| Không mời được Administrator ngoài Access list | Client không đọc được vai trò của người khác nên kiểm Access list chặn trước. |
| `/help` mất dấu cách sau chữ in đậm | ~10 chỗ, khi phần chữ sau có HTML entity. |
