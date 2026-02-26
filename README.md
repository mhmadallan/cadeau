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
ADMIN_KEY=change-this-admin-key
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

Admin pages:
- Add/manage products: `http://localhost:4000/admin.html`
- Edit product: available from Admin page only (requires admin key)

## API Endpoints

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/admin/verify`

Note:
- `POST`, `PUT`, and `DELETE` product routes require `x-admin-key` header matching `ADMIN_KEY`.

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
