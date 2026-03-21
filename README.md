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

## 3) Deployment-first setup (Render + GitHub Pages)

This repository is configured to run in production with:
- Backend on Render (from `render.yaml`)
- Frontend on GitHub Pages (from `docs/` via workflow)

### Backend on Render

1. Push this repository to GitHub.
2. In Render dashboard, click `New` -> `Blueprint`.
3. Connect your GitHub account and select this repo: `mhmadallan/cadeau`.
4. Render detects [`render.yaml`](./render.yaml) and creates the web service.
5. In Render environment variables, set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `CORS_ORIGINS` (comma-separated), example:
     - `https://mhmadallan.github.io`
6. Deploy.

### Frontend on GitHub Pages

1. In [`docs/config.js`](./docs/config.js), set:
   - `API_BASE_URL` to your Render backend URL (for example `https://cadeau.onrender.com`)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. Commit and push to `main`.
3. In GitHub repo settings, open `Settings` -> `Pages` and set Source to `GitHub Actions`.
4. The workflow [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) deploys `docs/` automatically.

After this setup, backend and frontend run from Render and GitHub Pages (not local machine).

## 4) Runtime policy

This project is intended to run only in deployed environments:
- Backend: Render
- Frontend: GitHub Pages

The backend now requires `CORS_ORIGINS` to be explicitly configured and does not allow browser origins outside that allow-list.

Auth and admin:
- Users can sign up/sign in with email+password or Google.
- Admin page: `admin.html`
- Edit page is available from Admin page only.
- Admin access is based on `profiles.role = 'admin'`.
- New users are created with role `user` by default.

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
