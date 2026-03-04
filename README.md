# Cadeau Store

Full-stack online store app with:
- Backend: Node.js + Express + Supabase
- Frontend: Vanilla JS + HTML + Tailwind CSS

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

## 3) Build CSS and run app

Terminal 1:
```bash
npm run css:watch
```

Terminal 2:
```bash
npm run dev
```

Open: `http://localhost:4000`

Auth and admin:
- Users can sign up/sign in with email+password or Google from `http://localhost:4000`.
- Admin page: `http://localhost:4000/admin.html`
- Edit page is available from Admin page only.
- Admin access is based on `public.profiles.role = 'admin'`.
- New users are created with role `user` by default.

## Deploy on Render (Auto update on every push)

1. Push this repository to GitHub (already done).
2. In Render dashboard, click `New` -> `Blueprint`.
3. Connect your GitHub account and select this repo: `mhmadallan/cadeau`.
4. Render will detect [`render.yaml`](./render.yaml) and create the web service.
5. In Render service environment variables, set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
6. Deploy.

After this one-time setup, every push to `main` on GitHub auto-deploys to Render (`autoDeploy: true`).

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
