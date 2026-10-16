# X Flow Tool

**English** | [Tiếng Việt](#x-flow-tool-tiếng-việt) · [Product page](docs/index.html)

**Diagrams that move.** X Flow Tool is a browser-based editor for animated diagrams — SaaS architectures, business processes (CRM/HRM, CI/CD) and database schemas. Lines show *how* data flows, the Replay walks the audience through it step by step, and a whole diagram can start from a Template, a Starter, a Mermaid snippet or JSON written by an AI.

Static diagramming tools don't show which way data moves or in what order, so the presenter has to narrate it — and every diagram starts from a blank canvas. X Flow Tool fixes both: animated Lines, a step-by-step Replay, and diagrams generated from text.

## Who it's for

- **Diagram authors** — developers, BAs, solution architects drawing architectures, flows and ERDs, presenting them with Replay and exporting SQL.
- **Viewers** — customers and stakeholders who open a Public link: read-only, no account, no install.
- **Administrators** — curate the shared Template library and decide who may sign in.

## Features

**Draw**
- **35 Block shapes**, Frames that group and nest other Elements, free Text, Icons/brand logos and Free lines — one canvas, pan/zoom, snap to grid.
- **Lines** port to port with four routings (straight, smooth-step, orthogonal, curved), 16 end markers including crow's foot, labels, and solid/dashed/dotted Stroke patterns that also hold in screenshots.
- **Multi-select** (shift-click or shift-drag), then align, distribute or match size; **Auto-layout** top-to-bottom or left-to-right, on the selection or the whole Diagram.
- **~15,000 brand logos** plus the full Lucide and Tabler icon sets.

**Animate and present**
- **18 Line Effects** — comet, dots, laser, meteor, convoy, chase, flow, heartbeat, rail, ants, morse… — with glow, speed, colour, direction and any icon riding the line.
- **Line styles**: a named vocabulary (primary, async, policy…) defined once per Diagram; change the style and every Line following it changes.
- **Block Effects** (float, breathe, glow, ripple, trace, sheen…), off by default.
- **Replay**: Elements light up Step by Step in four Run modes — sequential, concurrent, manual (click Next) or static.

**Start from text or AI**
- **Diagram JSON** — the whole Diagram is one JSON document with an authoring reference at `/guide` written for AI and developers. Paste it into the JSON Playground, or paste a fragment straight onto the canvas.
- **Import from Mermaid** (`flowchart`/`graph`, `erDiagram`), laid out automatically; lines it doesn't understand become warnings, never errors.
- **Starters** shipped with the app and a **Template library** curated by administrators.

**Database diagrams (ERD)**
- A Table is a Block with columns (type, PK/FK, unique, index, nullable, default); relationships use crow's foot cardinality.
- **Export SQL**: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ADD FOREIGN KEY`.

**Edit comfortably**
- **Undo / redo** for every change (100 steps), including picking a Template over unsaved work.
- **Keyboard shortcuts** (Delete, ⌘C/⌘X/⌘V, ⌘D, ⌘A, ⌘Z, ⌘S, arrow-key nudge, `?` for the cheat sheet) and **copy/paste between Diagrams and tabs**.
- **Export image**: PNG (2×) or self-contained SVG, whole Diagram or selection, theme or transparent background.

**Save, share and collaborate**
- Local autosave plus cloud save to Firestore; **Version history** on every Save — preview, restore, name a Version, or save it as a new Diagram.
- **Share** with Collaborators by email as *Can edit* or *Can view*; "Shared with me" on the Diagrams list; **Save conflict** detection when two people save the same Diagram.
- **Public link**: a read-only Viewer anyone can open without signing in, with Replay and image download.

**Accounts and access**
- Google and Email/Password sign-in, **password reset**, administrator role.
- Optional **Access list** (allowed email domains and addresses) with email verification, enforced by Firestore security rules.
- Light and dark theme; bilingual user guide (EN/VI).

### Documentation

| Where | For |
| --- | --- |
| [`docs/index.html`](docs/index.html) | Product page (EN/VI) — open it in a browser |
| `/help` · `/help/vi` | In-app user guide, bilingual EN/VI |
| `/guide` | Diagram JSON authoring reference, aimed at AI/developers |
| [`docs/PRD.md`](docs/PRD.md), [`docs/prd/`](docs/prd) | Product requirements (as-built, v0.2, v0.3) |
| [`GLOSSARY.md`](GLOSSARY.md) | Product vocabulary |

### Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui on Base UI · zustand · Firebase Authentication + Cloud Firestore · Vitest + Firebase emulators · deployed on Vercel.

## Requirements

- Node.js 20.12+ and `npm`
- A [Firebase](https://console.firebase.google.com) account (the free Spark plan is enough)
- A [Vercel](https://vercel.com) account (for production deployment)
- Firebase CLI (to deploy Firestore rules/indexes): `npm install -g firebase-tools`
- Java 21+ (only for the local Firebase emulators and `npm run test:rules`)

> The repo ships the logo library as committed static assets (`public/logos/`, ~106 MB across ~15K SVGs, plus a 2 MB `public/logos.json` index). Nothing generates them at build time, so expect a slow first clone and a large deployment upload.

## 1. Firebase setup

### 1.1. Create a project and Web App

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add project** and create a new project.
2. In the project, open **Project settings → General → Your apps → Add app → Web** (the `</>` icon).
3. Name and register the app. Firebase shows a `firebaseConfig` snippet — keep those values, they are the environment variables used in step 1.4.

### 1.2. Enable Authentication

The app supports **Google** and **Email/Password** sign-in:

1. Go to **Build → Authentication → Sign-in method**.
2. Enable the **Google** provider (pick a support email).
3. Enable the **Email/Password** provider.
4. Under **Authentication → Settings → User actions**, keep **Email enumeration protection** on (the default for projects created since September 2023). The *Forgot password?* form always shows the same message, but without this setting Firebase's own reply to a reset request still tells anyone watching the network whether an email is registered. Password reset emails use Firebase's default template and reset page.

> Note: after deploying to Vercel, you must add the Vercel domain to **Authentication → Settings → Authorized domains** (see step 3.3), otherwise Google sign-in will be blocked.

### 1.3. Enable Cloud Firestore and deploy rules

1. Go to **Build → Firestore Database → Create database**, pick a location and create it in **production mode** (the rules in this repo will replace the defaults).
2. Log in to the Firebase CLI and point it at your project:

   ```bash
   firebase login
   firebase use --add   # select the project you just created
   ```

3. Deploy the security rules and indexes shipped in this repo (`firestore.rules`, `firestore.indexes.json`):

   ```bash
   firebase deploy --only firestore
   ```

   These rules ensure each user can only read/write their own diagrams (`users/{uid}/diagrams/{id}`), support public diagrams via the `public-diagrams` collection, gate administrator access via the `users-roles` collection, and enforce the optional Access list in `config/access` (step 1.5).

### 1.4. (Optional) Grant administrator access

The admin page requires the `administrators` role. To grant it, create a Firestore document:

- Collection: `users-roles`
- Document ID: the user's `uid` (see **Authentication → Users**)
- Content: `{ "roles": ["administrators"] }`

Administrators also get the cross-user diagram overview (`/admin/diagrams`) and write access to the shared template library (`/admin/templates`).

### 1.5. (Optional) Restricting who can sign in (Access list)

By default anyone who can sign in with Google or Email/Password can use your deployment. To limit it to your company (plus a few named outsiders), create an **Access list** — a single Firestore document, edited by hand like the administrator role above:

- Collection: `config`
- Document ID: `access`
- Content: two arrays of strings, `domains` and `emails`:

  ```json
  {
    "domains": ["company.com", "company.vn"],
    "emails": ["partner@gmail.com", "auditor@another.org"]
  }
  ```

How it behaves:

- **Missing document or both lists empty → open to everyone**, exactly as without it. Delete the document (or empty both lists) to switch the restriction off.
- A user is allowed when their email's **domain** is in `domains` or the **whole address** is in `emails`. Matching ignores letter case and surrounding spaces; a leading `@` (`"@company.com"`) is fine. Domains match **exactly** — `company.com` does **not** admit `eu.company.com`; list each subdomain you want.
- It applies to Google and Email/Password alike, and to **existing** accounts too — someone already signed up who isn't on the list is refused the same way as a new account. Changes take effect on their next page load; nobody needs to sign out.
- **Email verification**: while the list is non-empty, an Email/Password account only counts once its email is verified (otherwise anyone could sign up as `anyone@company.com` without owning that mailbox). Signing up sends Firebase's default verification email and shows a *Check your inbox* screen with **Resend verification email** and **I've verified**. Google accounts are already verified. With an empty list nothing is asked.
- Users who aren't allowed see *"This email isn't allowed to use X Flow Tool. Contact your administrator."* and a Sign out button — never a raw permission error. **Sign up** stays visible.
- **Administrators** (`users-roles`, step 1.4) are **always allowed**, even with an email outside the list and unverified — so you can't lock yourself out of the admin pages.
- **Public links keep working**: a Public diagram opens in the Viewer for anyone, even if its owner is outside the list.
- If a field isn't a list (e.g. `"domains": "company.com"`), the list **fails closed**: everyone except administrators is refused until you fix it.

The restriction is enforced by `firestore.rules`, not just hidden in the UI, so the rules in this repo must be deployed (`firebase deploy --only firestore:rules`) for it to take effect. Each request that touches user data reads `config/access` once, which Firebase bills as one extra document read.

## 2. Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the template and fill in the `firebaseConfig` values from step 1.1:

   ```bash
   cp .env.example .env.local
   ```

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
   ```

   > All variables are required — the app throws on startup if any is missing (there is no degraded mode). These `NEXT_PUBLIC_*` values are Firebase Web SDK config and are safe to expose in the browser bundle; data security is enforced by Firestore rules.

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), sign in with Google or Email/Password, and start drawing.

### Run against the local Firebase emulators (no Firebase project needed)

```bash
npm run emulators       # terminal 1: Auth + Firestore emulators, UI at http://localhost:4100
npm run dev:emulator    # terminal 2: dev server at http://localhost:3000, wired to the emulators
```

`dev:emulator` uses the placeholder config in `.env.emulator` (project `demo-x-flow-tool`) and ignores `.env.local`, so nothing reaches a real Firebase project — `demo-*` projects are emulator-only. Create accounts by signing up in the app or in the Emulator UI's **Authentication** tab; to make one an administrator, add `users-roles/{uid}` with `{ "roles": ["administrators"] }` in the **Firestore** tab. Data is saved to `.emulator-data/` when you stop the emulators with Ctrl+C and loaded again on the next start. The Auth emulator sends no real email: a *Forgot password?* request prints the reset link in the emulators' terminal — replace `NEW_PASSWORD_HERE` at its end and open it. The emulator has no enumeration protection, so an unknown email gets an `EMAIL_NOT_FOUND` reply in the network tab (the form still shows the same message). Verification emails (Access list, step 1.5) work the same way: the link is printed in that terminal — open it, then press **I've verified**. To try the Access list, add `config/access` in the **Firestore** tab.

Other useful commands:

```bash
npm run build           # production build
npm run start           # serve the production build
npm run lint            # eslint
npm test                # unit tests (Vitest)
npm run test:rules      # Firestore rules tests (starts a throwaway emulator; needs Java)
npx tsc --noEmit -p .   # TypeScript check
```

## 3. Deploy to Vercel

### 3.1. Import the project

1. Push the code to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** this repository.
3. Vercel auto-detects **Next.js** — keep the default build settings (`npm run build`), no extra configuration needed.

### 3.2. Set environment variables

In the import screen (or later under **Project → Settings → Environment Variables**), add the same variables as `.env.local`:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From `firebaseConfig` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your_project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your_project.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From `firebaseConfig` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From `firebaseConfig` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | From `firebaseConfig` |

Apply them to all three environments — **Production / Preview / Development** — then click **Deploy**.

> Because `NEXT_PUBLIC_*` variables are inlined into the bundle at build time, you must **Redeploy** after changing any of them.

### 3.3. Add the Vercel domain to Firebase Auth

After the deploy finishes, take your app's domain (e.g. `your-app.vercel.app`, plus any custom domain) and:

1. Go to Firebase Console → **Authentication → Settings → Authorized domains**.
2. **Add domain** → add `your-app.vercel.app` (and your custom domain).

Skipping this step makes Google sign-in fail with `auth/unauthorized-domain` on the deployed app.

> Vercel Preview URLs (`*-git-*.vercel.app`) change per branch — if you need sign-in on Previews, add each domain to Authorized domains, or only test sign-in on Production.

### 3.4. Post-deploy checks

- Open the production URL, sign in with Google and Email/Password.
- Create a diagram, click **Save**, reload the page and confirm the diagram loads back from Firestore.
- In Firebase Console → Firestore, verify a document exists at `users/{uid}/diagrams/{id}`.
- Open **Share**, turn **Public** on for a diagram, open its `/diagrams/{id}/view` link in a private window and confirm it renders without signing in (it is served from the `public-diagrams` mirror).

### 3.5. Seed the template library

A fresh Firestore has no templates, so **New from template** starts out empty — this is expected, not a bug. Ready-made documents ship in [`seed/templates/`](seed/templates) and are imported through the admin UI (sign in as an administrator, **Admin → Templates → New template**, paste the JSON into the **JSON Playground** panel, **Save**). See [`seed/templates/README.md`](seed/templates/README.md) for the step-by-step.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| App crashes on load, complaining about missing env vars | One of the `NEXT_PUBLIC_FIREBASE_*` variables is missing — check `.env.local` (local) or Environment Variables (Vercel), then redeploy. |
| `auth/unauthorized-domain` on Google sign-in | Domain not added to **Authentication → Authorized domains** (step 3.3). |
| `Missing or insufficient permissions` when saving/loading diagrams | Firestore rules not deployed — run `firebase deploy --only firestore` (step 1.3). |
| Changed an env var on Vercel but nothing happens | `NEXT_PUBLIC_*` variables are inlined at build time — **Redeploy**. |
| **New from template** is empty | The `templates` collection has no documents yet — import one from `seed/templates/` (step 3.5). |
| A shared `/view` link says "Diagram not found" | The diagram is private (or was deleted). Open **Share** and turn **Public** on — it takes effect immediately and publishes the last saved version. |
| The admin pages redirect away | No `users-roles/{uid}` document with `{ "roles": ["administrators"] }` (step 1.4). |
| "This email isn't allowed to use X Flow Tool" | The email isn't on the Access list — add its domain or the address to `config/access` (step 1.5), then reload. Fix a field that isn't a list, which refuses everyone. |
| Stuck on "Check your inbox" after clicking the link | Press **I've verified** (or reload). Check the link was for the address shown; **Resend** sends a fresh one. |

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Vercel — Deploying Next.js](https://vercel.com/docs/frameworks/nextjs)

---

# X Flow Tool (Tiếng Việt)

[English](#x-flow-tool) | **Tiếng Việt** · [Trang giới thiệu](docs/index.html)

**Sơ đồ biết chuyển động.** X Flow Tool là trình soạn sơ đồ động chạy trên trình duyệt — sơ đồ kiến trúc SaaS, quy trình nghiệp vụ (CRM/HRM, CI/CD) và sơ đồ cơ sở dữ liệu. Line cho thấy dữ liệu chạy *thế nào*, Replay dẫn người xem đi qua từng bước, và cả Diagram có thể bắt đầu từ Template, Starter, một đoạn Mermaid hay JSON do AI viết.

Công cụ vẽ sơ đồ tĩnh không cho thấy dữ liệu chạy theo hướng nào, theo thứ tự nào — người trình bày phải giải thích bằng lời, và sơ đồ nào cũng phải vẽ từ trang trắng. X Flow Tool giải quyết cả hai: Line động, Replay theo từng bước, và tạo sơ đồ từ văn bản.

## Dành cho ai

- **Người soạn Diagram** — dev, BA, solution architect vẽ kiến trúc, quy trình, ERD; thuyết trình bằng Replay; xuất SQL.
- **Người xem** — khách hàng, stakeholder mở Public link: chỉ đọc, không cần tài khoản, không cần cài đặt.
- **Administrator** — quản lý thư viện Template dùng chung và quyết định ai được đăng nhập.

## Tính năng

**Vẽ**
- **35 hình Block**, Frame để nhóm và lồng Element, Text tự do, Icon/logo thương hiệu và Free line — trên một canvas, pan/zoom, snap theo lưới.
- **Line** nối cổng–cổng với 4 kiểu đi dây (straight, smooth-step, orthogonal, curved), 16 kiểu đầu mút gồm crow's foot, nhãn, và Stroke pattern liền/đứt/chấm giữ nguyên cả khi chụp ảnh.
- **Chọn nhiều** (shift-click hoặc shift-kéo) rồi căn lề, giãn đều, đồng bộ kích thước; **Auto-layout** trên xuống hoặc trái sang phải, cho vùng chọn hoặc cả Diagram.
- **~15.000 logo thương hiệu** cùng toàn bộ bộ icon Lucide và Tabler.

**Hoạt ảnh và trình bày**
- **18 Effect cho Line** — comet, dots, laser, meteor, convoy, chase, flow, heartbeat, rail, ants, morse… — kèm glow, tốc độ, màu, chiều chạy và icon bất kỳ chạy dọc Line.
- **Line style**: bộ "từ vựng" Line có tên (primary, async, policy…) định nghĩa một lần cho mỗi Diagram; sửa style là mọi Line theo nó đổi theo.
- **Effect cho Block** (float, breathe, glow, ripple, trace, sheen…), mặc định tắt.
- **Replay**: Element sáng lên theo từng Step với 4 Run mode — sequential, concurrent, manual (bấm Next) hoặc static.

**Bắt đầu từ văn bản hoặc AI**
- **Diagram JSON** — cả Diagram là một tài liệu JSON, có tài liệu đặc tả `/guide` viết cho AI và lập trình viên. Dán vào JSON Playground, hoặc dán một mảnh thẳng lên canvas.
- **Import from Mermaid** (`flowchart`/`graph`, `erDiagram`), tự xếp bố cục; dòng không hiểu được thành cảnh báo, không bao giờ thành lỗi.
- **Starter** đi kèm app và **thư viện Template** do administrator quản lý.

**Sơ đồ cơ sở dữ liệu (ERD)**
- Table là Block mang danh sách cột (kiểu dữ liệu, PK/FK, unique, index, nullable, default); quan hệ dùng ký hiệu crow's foot.
- **Export SQL**: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ADD FOREIGN KEY`.

**Soạn thảo thoải mái**
- **Undo / redo** cho mọi thay đổi (100 bước), kể cả khi lỡ chọn Template đè lên bài chưa lưu.
- **Phím tắt** (Delete, ⌘C/⌘X/⌘V, ⌘D, ⌘A, ⌘Z, ⌘S, mũi tên để nhích, `?` mở bảng phím tắt) và **copy/paste giữa các Diagram, các tab**.
- **Xuất ảnh**: PNG (2×) hoặc SVG tự chứa, cả Diagram hoặc vùng chọn, nền theo theme hoặc trong suốt.

**Lưu, chia sẻ và làm việc nhóm**
- Tự lưu cục bộ và lưu lên Firestore; **lịch sử Version** sau mỗi lần Save — xem trước, khôi phục, đặt tên, hoặc lưu thành Diagram mới.
- **Share** cho Collaborator theo email với quyền *Can edit* hoặc *Can view*; mục "Shared with me" trên danh sách; **phát hiện Save conflict** khi hai người cùng lưu một Diagram.
- **Public link**: Viewer chỉ đọc, ai cũng mở được mà không cần đăng nhập, có Replay và tải ảnh.

**Tài khoản và quyền truy cập**
- Đăng nhập Google và Email/Password, **quên mật khẩu**, vai trò administrator.
- **Access list** tuỳ chọn (domain và địa chỉ email được phép) kèm xác minh email, thực thi bằng Firestore security rules.
- Theme sáng/tối; hướng dẫn sử dụng song ngữ Anh/Việt.

### Tài liệu

| Ở đâu | Dành cho |
| --- | --- |
| [`docs/index.html`](docs/index.html) | Trang giới thiệu sản phẩm (EN/VI) — mở bằng trình duyệt |
| `/help` · `/help/vi` | Hướng dẫn sử dụng trong app, song ngữ Anh/Việt |
| `/guide` | Đặc tả Diagram JSON, dành cho AI/lập trình viên |
| [`docs/PRD.md`](docs/PRD.md), [`docs/prd/`](docs/prd) | Tài liệu yêu cầu sản phẩm (hiện trạng, v0.2, v0.3) |
| [`GLOSSARY.md`](GLOSSARY.md) | Thuật ngữ sản phẩm |

### Công nghệ

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui trên Base UI · zustand · Firebase Authentication + Cloud Firestore · Vitest + Firebase emulator · triển khai trên Vercel.

## Yêu cầu

- Node.js 20.12 trở lên và `npm`
- Một tài khoản [Firebase](https://console.firebase.google.com) (gói Spark miễn phí là đủ)
- Một tài khoản [Vercel](https://vercel.com) (để triển khai production)
- Firebase CLI (để deploy Firestore rules/indexes): `npm install -g firebase-tools`
- Java 21 trở lên (chỉ cần cho Firebase emulator chạy local và `npm run test:rules`)

> Repo commit sẵn thư viện logo dưới dạng file tĩnh (`public/logos/`, khoảng 106 MB cho ~15K file SVG, cộng file index `public/logos.json` 2 MB). Không có bước build nào sinh lại chúng, nên lần clone đầu sẽ lâu và dung lượng upload khi deploy khá lớn.

## 1. Thiết lập Firebase

### 1.1. Tạo project và Web App

1. Vào [Firebase Console](https://console.firebase.google.com) → **Add project** và tạo project mới.
2. Trong project, chọn **Project settings → General → Your apps → Add app → Web** (biểu tượng `</>`).
3. Đặt tên app và đăng ký. Firebase sẽ hiển thị đoạn cấu hình `firebaseConfig` — giữ lại các giá trị này, chúng chính là các biến môi trường ở bước 1.4.

### 1.2. Bật Authentication

Ứng dụng hỗ trợ đăng nhập bằng **Google** và **Email/Password**:

1. Vào **Build → Authentication → Sign-in method**.
2. Bật provider **Google** (chọn support email).
3. Bật provider **Email/Password**.

> Lưu ý: sau khi deploy lên Vercel, phải thêm domain Vercel vào **Authentication → Settings → Authorized domains** (xem bước 3.3), nếu không đăng nhập Google sẽ bị chặn.

### 1.3. Bật Cloud Firestore và deploy rules

1. Vào **Build → Firestore Database → Create database**, chọn location và tạo ở chế độ **production mode** (rules trong repo sẽ thay thế rules mặc định).
2. Đăng nhập Firebase CLI và trỏ về project của bạn:

   ```bash
   firebase login
   firebase use --add   # chọn project vừa tạo
   ```

3. Deploy security rules và indexes có sẵn trong repo (`firestore.rules`, `firestore.indexes.json`):

   ```bash
   firebase deploy --only firestore
   ```

   Rules này đảm bảo mỗi người dùng chỉ đọc/ghi được sơ đồ của chính mình (`users/{uid}/diagrams/{id}`), hỗ trợ sơ đồ public qua collection `public-diagrams`, phân quyền administrator qua collection `users-roles`, và thực thi Access list tuỳ chọn trong `config/access` (bước 1.5).

### 1.4. (Tuỳ chọn) Cấp quyền administrator

Trang quản trị yêu cầu người dùng có role `administrators`. Để cấp quyền, tạo document trong Firestore:

- Collection: `users-roles`
- Document ID: chính là `uid` của người dùng (xem trong **Authentication → Users**)
- Nội dung: `{ "roles": ["administrators"] }`

Administrator cũng được xem toàn bộ sơ đồ của mọi người (`/admin/diagrams`) và có quyền quản lý thư viện template dùng chung (`/admin/templates`).

### 1.5. (Tuỳ chọn) Giới hạn người được đăng nhập (Access list)

Mặc định, ai đăng nhập được bằng Google hoặc Email/Password đều dùng được deployment của bạn. Để chỉ cho người trong công ty (và vài người ngoài được chỉ định) dùng, hãy tạo **Access list** — một document Firestore, sửa tay giống cách cấp role administrator ở trên:

- Collection: `config`
- Document ID: `access`
- Nội dung: hai mảng chuỗi `domains` và `emails`:

  ```json
  {
    "domains": ["company.com", "company.vn"],
    "emails": ["partner@gmail.com", "auditor@another.org"]
  }
  ```

Cách hoạt động:

- **Chưa có document hoặc cả hai danh sách rỗng → mở cho mọi người**, y như khi không cấu hình. Xoá document (hoặc làm rỗng cả hai danh sách) để tắt giới hạn.
- Người dùng được phép khi **domain** email của họ nằm trong `domains` hoặc **nguyên địa chỉ** nằm trong `emails`. Không phân biệt chữ hoa/thường, bỏ qua khoảng trắng hai đầu; viết kèm `@` ở đầu (`"@company.com"`) cũng được. Domain so khớp **chính xác** — `company.com` **không** cho phép `eu.company.com`; cần subdomain nào thì liệt kê subdomain đó.
- Áp dụng cho cả Google lẫn Email/Password, và cho cả **tài khoản đã có** — người đã đăng ký nhưng không thuộc danh sách bị chặn giống tài khoản mới. Thay đổi có hiệu lực ở lần tải trang kế tiếp, không ai phải đăng xuất.
- **Xác minh email**: khi danh sách không rỗng, tài khoản Email/Password chỉ được tính khi email đã xác minh (nếu không, ai cũng đăng ký được `bat-ky@company.com` mà không sở hữu hộp thư đó). Đăng ký xong, Firebase gửi thư xác minh theo mẫu mặc định và app hiện màn hình *Check your inbox* có nút **Resend verification email** (gửi lại) và **I've verified** (tôi đã xác minh). Tài khoản Google vốn đã xác minh. Danh sách rỗng thì không đòi gì cả.
- Người không được phép thấy thông báo *"This email isn't allowed to use X Flow Tool. Contact your administrator."* (Email này không được phép dùng X Flow Tool, liên hệ quản trị viên) cùng nút Sign out — không bao giờ là lỗi quyền truy cập chung chung. Nút **Sign up** vẫn hiện.
- **Administrator** (`users-roles`, bước 1.4) **luôn được phép**, kể cả khi email nằm ngoài danh sách và chưa xác minh — nên bạn không thể tự khoá mình khỏi trang admin.
- **Public link vẫn hoạt động**: sơ đồ Public vẫn mở được trong Viewer với bất kỳ ai, kể cả khi chủ sở hữu nằm ngoài danh sách.
- Nếu một trường không phải là mảng (ví dụ `"domains": "company.com"`), danh sách **chặn hết**: mọi người trừ administrator bị từ chối cho đến khi bạn sửa lại.

Giới hạn này được thực thi trong `firestore.rules`, không chỉ ẩn trên giao diện, nên phải deploy rules trong repo (`firebase deploy --only firestore:rules`) thì mới có hiệu lực. Mỗi request chạm tới dữ liệu người dùng đọc `config/access` một lần, Firebase tính là thêm một lượt đọc document.

## 2. Chạy local

1. Cài dependencies:

   ```bash
   npm install
   ```

2. Tạo file `.env.local` từ mẫu và điền giá trị `firebaseConfig` lấy ở bước 1.1:

   ```bash
   cp .env.example .env.local
   ```

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
   ```

   > Tất cả biến đều bắt buộc — ứng dụng sẽ báo lỗi ngay khi khởi động nếu thiếu bất kỳ biến nào (không có chế độ chạy "degraded"). Các biến `NEXT_PUBLIC_*` này là cấu hình Firebase Web SDK, an toàn để lộ ra bundle phía trình duyệt; bảo mật dữ liệu nằm ở Firestore rules.

3. Chạy dev server:

   ```bash
   npm run dev
   ```

   Mở [http://localhost:3000](http://localhost:3000), đăng nhập bằng Google hoặc Email/Password và bắt đầu vẽ sơ đồ.

### Chạy với Firebase emulator local (không cần project Firebase)

```bash
npm run emulators       # terminal 1: emulator Auth + Firestore, giao diện tại http://localhost:4100
npm run dev:emulator    # terminal 2: dev server tại http://localhost:3000, kết nối tới emulator
```

`dev:emulator` dùng cấu hình giả trong `.env.emulator` (project `demo-x-flow-tool`) và bỏ qua `.env.local`, nên không có gì chạm tới project Firebase thật — project `demo-*` chỉ tồn tại trong emulator. Tạo tài khoản bằng cách đăng ký trong app hoặc ở tab **Authentication** của Emulator UI; để cấp quyền administrator, thêm document `users-roles/{uid}` với `{ "roles": ["administrators"] }` ở tab **Firestore**. Dữ liệu được lưu vào `.emulator-data/` khi dừng emulator bằng Ctrl+C và được nạp lại ở lần chạy sau. Emulator Auth không gửi email thật: link xác minh email (Access list, bước 1.5) được in ra terminal của emulator — mở link đó rồi bấm **I've verified**. Để thử Access list, thêm `config/access` ở tab **Firestore**.

Các lệnh hữu ích khác:

```bash
npm run build           # build production
npm run start           # chạy bản build production
npm run lint            # eslint
npm test                # unit test (Vitest)
npm run test:rules      # test Firestore rules (tự chạy emulator tạm; cần Java)
npx tsc --noEmit -p .   # kiểm tra TypeScript
```

## 3. Triển khai lên Vercel

### 3.1. Import project

1. Push code lên GitHub (hoặc GitLab/Bitbucket).
2. Vào [vercel.com/new](https://vercel.com/new) → **Import** repository này.
3. Vercel tự nhận diện framework **Next.js** — giữ nguyên cấu hình build mặc định (`npm run build`), không cần chỉnh gì thêm.

### 3.2. Khai báo biến môi trường

Trong màn hình import (hoặc sau đó tại **Project → Settings → Environment Variables**), thêm đầy đủ các biến giống `.env.local`:

| Biến | Ghi chú |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Từ `firebaseConfig` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your_project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID project Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your_project.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Từ `firebaseConfig` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Từ `firebaseConfig` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Từ `firebaseConfig` |

Áp dụng cho cả ba môi trường **Production / Preview / Development**, sau đó bấm **Deploy**.

> Vì các biến `NEXT_PUBLIC_*` được nhúng vào bundle lúc build, mỗi lần thay đổi giá trị bạn cần **Redeploy** để có hiệu lực.

### 3.3. Thêm domain Vercel vào Firebase Auth

Sau khi deploy xong, lấy domain của app (ví dụ `your-app.vercel.app` và domain tuỳ chỉnh nếu có) rồi:

1. Vào Firebase Console → **Authentication → Settings → Authorized domains**.
2. **Add domain** → thêm `your-app.vercel.app` (và custom domain của bạn).

Nếu bỏ qua bước này, đăng nhập Google trên bản deploy sẽ báo lỗi `auth/unauthorized-domain`.

> Các URL Preview của Vercel (`*-git-*.vercel.app`) có domain thay đổi theo từng branch — nếu cần đăng nhập trên Preview, thêm từng domain đó vào Authorized domains, hoặc chỉ test đăng nhập trên Production.

### 3.4. Kiểm tra sau khi deploy

- Mở URL production, đăng nhập bằng Google và Email/Password.
- Tạo một sơ đồ, bấm **Save**, tải lại trang và xác nhận sơ đồ được nạp lại từ Firestore.
- Kiểm tra trong Firebase Console → Firestore thấy document tại `users/{uid}/diagrams/{id}`.
- Mở **Share**, bật **Public** cho một sơ đồ, mở link `/diagrams/{id}/view` ở cửa sổ ẩn danh và xác nhận xem được mà không cần đăng nhập (nội dung lấy từ bản mirror `public-diagrams`).

### 3.5. Nạp thư viện template

Firestore mới tinh chưa có template nào, nên mục **New from template** sẽ trống — đây là điều bình thường, không phải lỗi. Các tài liệu mẫu nằm sẵn trong [`seed/templates/`](seed/templates) và được nạp qua giao diện quản trị (đăng nhập bằng tài khoản administrator, vào **Admin → Templates → New template**, dán JSON vào panel **JSON Playground**, bấm **Save**). Xem [`seed/templates/README.md`](seed/templates/README.md) để biết chi tiết từng bước.

## Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
| --- | --- |
| App crash ngay khi mở, báo thiếu biến môi trường | Thiếu một trong các biến `NEXT_PUBLIC_FIREBASE_*` — kiểm tra `.env.local` (local) hoặc Environment Variables (Vercel) rồi redeploy. |
| `auth/unauthorized-domain` khi đăng nhập Google | Chưa thêm domain vào **Authentication → Authorized domains** (bước 3.3). |
| `Missing or insufficient permissions` khi lưu/đọc sơ đồ | Chưa deploy Firestore rules — chạy `firebase deploy --only firestore` (bước 1.3). |
| Đổi biến môi trường trên Vercel nhưng không thấy thay đổi | Biến `NEXT_PUBLIC_*` được nhúng lúc build — cần **Redeploy**. |
| **New from template** trống trơn | Collection `templates` chưa có document nào — nạp một mẫu từ `seed/templates/` (bước 3.5). |
| Link `/view` chia sẻ báo "Diagram not found" | Sơ đồ đang private (hoặc đã bị xoá). Mở **Share** và bật **Public** — có hiệu lực ngay, công khai bản đã lưu gần nhất. |
| Vào trang admin bị đá ra | Chưa có document `users-roles/{uid}` với `{ "roles": ["administrators"] }` (bước 1.4). |
| "This email isn't allowed to use X Flow Tool" | Email không có trong Access list — thêm domain hoặc địa chỉ đó vào `config/access` (bước 1.5) rồi tải lại trang. Nếu có trường không phải mảng thì sửa lại, vì khi đó mọi người đều bị chặn. |
| Kẹt ở màn hình "Check your inbox" dù đã bấm link | Bấm **I've verified** (hoặc tải lại trang). Kiểm tra link có đúng cho địa chỉ đang hiện không; **Resend** gửi link mới. |

## Tìm hiểu thêm

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Vercel — Deploying Next.js](https://vercel.com/docs/frameworks/nextjs)
