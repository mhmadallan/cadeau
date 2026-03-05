# Cadeau Store

Split deployment architecture:
- Backend API: Node.js + Express + Supabase (host on Render)
- Frontend: Vanilla JS + HTML + Tailwind CSS static files (host on GitHub Pages)

## 1) Clone and install

```bash
git clone https://github.com/mhmadallan/cadeau.git
cd cadeau
npm install
```

## 2) Configure Supabase

1. Create a Supabase project.
2. In Supabase SQL Editor, run [supabase/schema.sql](./supabase/schema.sql).
3. Copy `.env.example` to `.env` and fill in values:

```env
PORT=4000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-publishable-key
```

## 3) Local development

Terminal 1:
```bash
npm run css:watch
```

Terminal 2:
```bash
npm run dev
```

Open frontend from `public/` (for example with VSCode Live Server), and keep:
- `public/config.js` -> `API_BASE_URL: 'http://localhost:4000'`

Auth and admin:
- Users can sign up/sign in with email+password or Google.
- Admin page: `admin.html`
- Edit page is available from Admin page only.
- Admin access is based on `public.profiles.role = 'admin'`.
- New users are created with role `user` by default.

## Deploy backend on Render (auto deploy from GitHub)

1. Push this repository to GitHub (already done).
2. In Render dashboard, click `New` -> `Blueprint`.
3. Connect your GitHub account and select this repo: `mhmadallan/cadeau`.
4. Render will detect [`render.yaml`](./render.yaml) and create the web service.
5. In Render service environment variables, set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `CORS_ORIGINS` (comma-separated), example:
     - `https://mhmadallan.github.io/cadeau,http://localhost:5500`
6. Deploy.

After this one-time setup, every push to `main` auto-deploys backend on Render (`autoDeploy: true`).

## Deploy frontend on GitHub Pages

1. In [`public/config.js`](./public/config.js), set:
   - `API_BASE_URL` to your Render backend URL (for example `https://cadeau.onrender.com`)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. Commit and push.
3. In GitHub repo settings:
   - `Settings` -> `Pages`
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/public`
4. Save. GitHub will publish your frontend.

Frontend pages:
- `index.html`
- `signin.html`
- `signup.html`
- `admin.html`
- `edit-product.html`

## API Endpoints

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/config`
- `GET /api/me`

Note:
- `POST`, `PUT`, and `DELETE` product routes require a logged-in user with `role = admin`.

## Promote a user to admin

Run this in Supabase SQL Editor after the user signs up:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

## Product payload

```json
{
  "name": "Wireless Mouse",
  "description": "Ergonomic Bluetooth mouse",
  "price": 24.99,
  "image_url": "https://example.com/mouse.jpg",
  "stock": 12
}
```
