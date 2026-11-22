# Thiết kế ngắn — Editor Markdown cho lời giảng (Narration)

| | |
| --- | --- |
| **Cập nhật** | 2026-11-22 |
| **Tham khảo** | DocsHub `apps/web/src/components/studio/markdown-editor.tsx`, `editor-toolbar.tsx`, `editor-commands.ts` (CodeMirror 6) |
| **Đã duyệt** | Chủ sản phẩm: "editor markdown text thôi, bỏ các nâng cao" → "Duyệt" |

## Ý định
Soạn lời giảng (ô **Body** và ô **Callout** của mỗi Lesson step) bằng một editor Markdown dạng chữ như Studio của DocsHub, thay cho textarea thường; lời giảng có thêm vài cấu trúc Markdown cơ bản.

## Các cách đã cân nhắc
- **A.** Chỉ thay editor, giữ cú pháp cũ.
- **B.** Editor + Markdown cơ bản (danh sách, tiêu đề nhỏ, code block). ← **đã chọn** (chủ sản phẩm: "editor markdown text", bỏ phần nâng cao).
- **C.** Mang nguyên pipeline DocsHub (remark, Shiki, mermaid, bảng, ảnh, tabs) — bị loại: nặng, cần Storage, bề mặt bảo mật rộng.

## Phạm vi
- Editor CodeMirror 6: tô màu Markdown, tự xuống dòng, sáng/tối theo app; thanh công cụ **B**, *I*, `code`, `[[term]]`, danh sách •, danh sách 1., `###`, code block; phím tắt ⌘B, ⌘I, ⌘E; tab **Write | Preview** (Preview = đúng renderer của trang xem bài).
- Cú pháp lời giảng: cũ (`**đậm**`, `*nghiêng*`, `` `code` ``, `[[term]]`, dòng trống = đoạn mới) **cộng** dòng `- `/`* ` (danh sách), `1. ` (danh sách số), `#`–`###` (tiêu đề nhỏ), khối ```` ``` ```` (code nhiều dòng, chữ đơn cách, không tô màu).
- Vẫn không HTML, không link; dữ liệu ra là cấu trúc, renderer chỉ dựng React node.
- Undo: một lượt gõ trong editor = một bước Undo (như textarea); bấm toolbar = một bước.
- Ô **Changes** giữ là textarea (mỗi dòng một thay đổi).

## Ngoài phạm vi
Lệnh `/`, ảnh, bảng, link, mermaid, tabs, tô màu code theo ngôn ngữ, admonition trong Body (Callout đã đảm nhận).

## Ràng buộc
- Bài cũ hiển thị y như trước — đã kiểm: 80 bài seed không có dòng nào bắt đầu bằng `- `, `1. `, `#`, ```` ``` ````.
- Thư viện: `@uiw/react-codemirror` + `@codemirror/*` (bộ DocsHub dùng).

## Phần để builder quyết
Tên khối dữ liệu của parser, kiểu chữ tiêu đề/danh sách trong cột lời giảng, giao diện toolbar.
