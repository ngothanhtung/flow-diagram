# Flowgram Tools

**English** | [Tiếng Việt](#flowgram-tools-tiếng-việt)

A browser-based flowchart/diagram editor (SaaS architecture diagrams, CRM/HRM flows, etc.) with animated connectors, built on [Next.js 16](https://nextjs.org) (App Router) + React 19. Diagrams are saved to Cloud Firestore per authenticated user (Firebase Authentication).

## Requirements

- Node.js 20+ and `npm`
- A [Firebase](https://console.firebase.google.com) account (the free Spark plan is enough)
- A [Vercel](https://vercel.com) account (for production deployment)
- Firebase CLI (to deploy Firestore rules/indexes): `npm install -g firebase-tools`

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

   These rules ensure each user can only read/write their own diagrams (`users/{uid}/diagrams/{id}`), support public diagrams via the `public-diagrams` collection, and gate administrator access via the `users-roles` collection.

### 1.4. (Optional) Grant administrator access

The admin page requires the `administrators` role. To grant it, create a Firestore document:

- Collection: `users-roles`
- Document ID: the user's `uid` (see **Authentication → Users**)
- Content: `{ "roles": ["administrators"] }`

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

Other useful commands:

```bash
npm run build           # production build
npm run start           # serve the production build
npm run lint            # eslint
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

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| App crashes on load, complaining about missing env vars | One of the `NEXT_PUBLIC_FIREBASE_*` variables is missing — check `.env.local` (local) or Environment Variables (Vercel), then redeploy. |
| `auth/unauthorized-domain` on Google sign-in | Domain not added to **Authentication → Authorized domains** (step 3.3). |
| `Missing or insufficient permissions` when saving/loading diagrams | Firestore rules not deployed — run `firebase deploy --only firestore` (step 1.3). |
| Changed an env var on Vercel but nothing happens | `NEXT_PUBLIC_*` variables are inlined at build time — **Redeploy**. |

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Vercel — Deploying Next.js](https://vercel.com/docs/frameworks/nextjs)

---

# Flowgram Tools (Tiếng Việt)

[English](#flowgram-tools) | **Tiếng Việt**

Trình soạn thảo sơ đồ / flowchart chạy trên trình duyệt (sơ đồ kiến trúc SaaS, luồng CRM/HRM, v.v.) với hiệu ứng kết nối động, xây dựng trên [Next.js 16](https://nextjs.org) (App Router) + React 19. Sơ đồ được lưu vào Cloud Firestore theo từng người dùng đã đăng nhập (Firebase Authentication).

## Yêu cầu

- Node.js 20 trở lên và `npm`
- Một tài khoản [Firebase](https://console.firebase.google.com) (gói Spark miễn phí là đủ)
- Một tài khoản [Vercel](https://vercel.com) (để triển khai production)
- Firebase CLI (để deploy Firestore rules/indexes): `npm install -g firebase-tools`

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

   Rules này đảm bảo mỗi người dùng chỉ đọc/ghi được sơ đồ của chính mình (`users/{uid}/diagrams/{id}`), hỗ trợ sơ đồ public qua collection `public-diagrams`, và phân quyền administrator qua collection `users-roles`.

### 1.4. (Tuỳ chọn) Cấp quyền administrator

Trang quản trị yêu cầu người dùng có role `administrators`. Để cấp quyền, tạo document trong Firestore:

- Collection: `users-roles`
- Document ID: chính là `uid` của người dùng (xem trong **Authentication → Users**)
- Nội dung: `{ "roles": ["administrators"] }`

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

Các lệnh hữu ích khác:

```bash
npm run build           # build production
npm run start           # chạy bản build production
npm run lint            # eslint
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

## Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
| --- | --- |
| App crash ngay khi mở, báo thiếu biến môi trường | Thiếu một trong các biến `NEXT_PUBLIC_FIREBASE_*` — kiểm tra `.env.local` (local) hoặc Environment Variables (Vercel) rồi redeploy. |
| `auth/unauthorized-domain` khi đăng nhập Google | Chưa thêm domain vào **Authentication → Authorized domains** (bước 3.3). |
| `Missing or insufficient permissions` khi lưu/đọc sơ đồ | Chưa deploy Firestore rules — chạy `firebase deploy --only firestore` (bước 1.3). |
| Đổi biến môi trường trên Vercel nhưng không thấy thay đổi | Biến `NEXT_PUBLIC_*` được nhúng lúc build — cần **Redeploy**. |

## Tìm hiểu thêm

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
- [Vercel — Deploying Next.js](https://vercel.com/docs/frameworks/nextjs)
