# Cadeau Store

## Admin-approved phone access (no OTP)

The default sign-in page accepts a WhatsApp phone number. First-time visitors
request access with their name; admins approve, reject or revoke customers from
the Customer access requests section of `admin.html`. Email login remains at
`email-signin.html`, and the original signup page/code is retained.

Run `supabase/customer-access.sql` after `orders.sql`. This creates private
customer/session tables and a separate transaction for customer orders. Existing
email users and orders remain intact. New phone orders use `customer_id`; email
orders retain `user_id`. Both transactions check stock and deduplicate requests.

Create two text-only WhatsApp templates (no image header), each with positional
body variables `{{1}}` = name and `{{2}}` = international phone number:

- `cadeau_access_request`: "New Cadeau access request. Name: {{1}}. WhatsApp: {{2}}. Please review this request in the admin dashboard."
- `cadeau_access_approved`: "Hello {{1}}, your Cadeau shop access for {{2}} has been approved. You can now visit the shop and enter your phone number." Add your shop's actual public URL as fixed text in this template before submission.

After approval, set `WHATSAPP_ACCESS_REQUEST_TEMPLATE`,
`WHATSAPP_ACCESS_APPROVED_TEMPLATE`, and `WHATSAPP_ACCESS_TEMPLATE_LANGUAGE` in
`.env`/Render. These notices always use WhatsApp independently of the order
notification provider. Requests go to `WHATSAPP_RECIPIENT_NUMBER`; approval notices
go to the submitted customer phone. Valid WhatsApp sender credentials are required.
Missing templates or delivery failures do not prevent saving requests/decisions;
the dashboard displays `not_configured`, `accepted`, or `unknown`. Accepted is not
a delivery receipt. No automatic resend or OTP is used.

Phone sessions last 30 days, are stored as hashes server-side, and are checked
against the current approval status on every protected API request. A customer
may log in again with an approved number, without verifying ownership, as requested.
This is a shop access gate, not identity verification: knowing an approved number
is sufficient to enter. It must never grant admin rights, saved addresses, private
order history, or access to Supabase Auth accounts. Names/phones in the approval
database are returned only to email-authenticated admins. Customers enter delivery
details anew for each order. Request/login endpoints have a per-process IP limit
of 10 attempts/minute; duplicate numbers do not trigger repeat admin notifications.
Use a shared rate limiter before scaling to multiple backend processes.

## Product images in WhatsApp order notifications

If you edited the existing template to have an Image header, use:

```env
WHATSAPP_TEMPLATE_NAME=cadeau_order_notification
WHATSAPP_TEMPLATE_HEADER=image
```

This sends the actual product image with the existing nine body parameters using
that template name. The product image is read from the database before saving the
order; missing or invalid HTTPS URLs block WhatsApp orders before stock changes.
There is no text-only fallback in this mode, and the optional image-template name
is ignored. Meta must be able to download the public image. Telegram is unaffected.
Keep Telegram selected while the template is in review. After approval, test the
image notification before selecting WhatsApp and restarting the backend.

The alternative below applies only when `WHATSAPP_TEMPLATE_HEADER=none`:

Create a separate template named `cadeau_order_notification_image` in WhatsApp
Manager. Select an **Image** header, upload a sample product image, and copy the
existing order template's body with the same nine positional parameters and
sample values. Use the same language as `WHATSAPP_TEMPLATE_LANGUAGE`.
After Meta approves it, set `WHATSAPP_IMAGE_TEMPLATE_NAME=cadeau_order_notification_image`
in `.env` (and Render when deploying the order sender), then restart the backend.
Keep `WHATSAPP_TEMPLATE_NAME` pointing to the existing text-only template.

For WhatsApp orders, the backend looks up the product's current image URL and sends
it as the image header. Use a publicly accessible HTTPS JPEG or PNG image that
meets Meta's media requirements. The review sample is not the image used for every
order: the product URL is supplied dynamically. No image or an invalid URL falls
back to the text-only template. Meta download failures are recorded as notification
failures; the app does not automatically resend and risk a duplicate. Telegram
behavior and the selected notification channel are unchanged. No database migration
is needed. Saved orders do not snapshot images, so retries use the current product
image when the calling code supplies it.

## WhatsApp delivery webhooks on Render

Callback URL: `https://cadeau-hbmt.onrender.com/api/webhooks/whatsapp`

1. Run `supabase/whatsapp-delivery-events.sql` in Supabase's SQL Editor.
2. Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` on Render to the random value generated
   in local `.env`. Set `META_APP_SECRET` to the app secret from your Meta app's
   **Settings > Basic**. This is different from the WhatsApp access token.
   Set `WHATSAPP_PHONE_NUMBER_ID` to the sender whose statuses should be recorded.
3. Deploy this code to Render. Local files alone do not update the hosted service.
4. In Meta's WhatsApp webhook configuration, enter the callback URL and the same
   verification token, then choose **Verify and save**. Subscribe to the **messages**
   webhook field for this app/account. GET verification alone does not subscribe
   the app to delivery events.
5. Send one new test after setup. The previously accepted requests may not produce
   historical events after subscription. Inspect Render logs or the private
   `whatsapp_delivery_events` table for `sent`, `delivered`, `read`, or `failed`.
   Match `message_id` to the order's `whatsapp_message_id`. Error codes on failed
   events identify Meta's delivery failure reason.

POST requests require a valid `X-Hub-Signature-256` HMAC of the exact raw body
using `META_APP_SECRET`. The endpoint stores only status metadata and numeric error
codes. Duplicates are ignored; all event timestamps remain available, so events
arriving out of order do not overwrite newer states. Database failures return 503
so Meta can retry. This tracking works while Telegram remains the selected order
notification provider and does not resend orders or change stock.

## Telegram order notifications (alternative to WhatsApp)

1. In Telegram, open [@BotFather](https://t.me/BotFather), send `/newbot`, and
   follow the prompts. Save its token as `TELEGRAM_BOT_TOKEN` in `.env`.
2. Open your new bot in Telegram and press **Start**. Bots cannot initiate a
   private chat with a user who has not started the bot.
3. Run `npm run telegram:chat`. Copy your receiving chat's numeric ID into
   `TELEGRAM_CHAT_ID`. This helper reads recent bot updates, does not send messages,
   and never prints the token. If several chats appear, choose yours explicitly.
4. Run `supabase/telegram-notifications.sql` in the Supabase SQL Editor.
5. Set `ORDER_NOTIFICATION_PROVIDER=telegram` and restart the backend.

```env
ORDER_NOTIFICATION_PROVIDER=telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-numeric-chat-id
```

Keep these settings server-side. Existing `WHATSAPP_*` values stay unchanged.
To switch back, set `ORDER_NOTIFICATION_PROVIDER=whatsapp` and restart; if omitted,
the provider defaults to WhatsApp for compatibility. No automatic fallback is used.
Telegram mode needs only Telegram credentials, not valid Meta credentials or templates.
Set the same three variables on Render for a deployed backend.

Telegram notifications contain the saved order ID, product, quantity, unit price,
total, customer name, phone, address and notes. The database retains notification
status and Telegram message ID in `notification_message_id`, with
`notification_provider=telegram`. The old `whatsapp_message_id` is preserved for
WhatsApp notifications. Existing orders are never resent simply by switching providers.
`accepted` means the service accepted the message; it does not mean the recipient read it.
Missing configuration or database columns blocks new orders before stock is reserved.

See [Telegram's bot setup guide](https://core.telegram.org/bots/tutorial) and
[sendMessage API](https://core.telegram.org/bots/api#sendmessage).

## Sign-in required

The storefront redirects guests to sign-in and hides its content while checking
the session. Product list and product detail API routes require a valid bearer
token. Sign-in, sign-up, and the public auth configuration remain accessible.
Run `supabase/private-catalog.sql` in the Supabase SQL Editor as well to block
direct access to products through Supabase's anonymous/public database API.
The backend uses its service-role key for authorized product operations.

## Orders and WhatsApp Business notifications

Signed-in customers can select **Order product**, enter quantity, name, phone,
delivery address and optional notes, then place an order. No online payment is
collected. Prices use the store's existing dollar display.

### Setup

1. Run `supabase/orders.sql` in the Supabase SQL Editor, after the original
   `schema.sql`. It creates a private orders table and a service-role-only
   transaction that checks stock, saves the order and reduces stock atomically.
2. Configure a Meta app with WhatsApp Cloud API, a registered sender number and
   an access token with `whatsapp_business_messaging` permission. For production,
   use a suitable system-user token rather than the temporary dashboard token.
3. Create and obtain approval for a **text-only, positional-parameter template**
   named `cadeau_order_notification` in language `en_US`, with no header, footer
   parameters or buttons. Use this body (the order of the nine variables matters):

   ```text
   New Cadeau order: {{1}}
   Product: {{2}}
   Quantity: {{3}}
   Unit price: {{4}}
   Product total: {{5}}
   Customer: {{6}}
   Phone: {{7}}
   Delivery address: {{8}}
   Notes: {{9}}
   Please contact the customer to arrange payment and delivery.
   ```

   Supply realistic sample values when submitting the template. Meta determines
   template approval and category. Use the exact approved name and language below.
4. Add these values to your local `.env` and your Render service environment:

   ```env
   WHATSAPP_ACCESS_TOKEN=your-server-only-token
   WHATSAPP_PHONE_NUMBER_ID=your-meta-sender-phone-number-id
   WHATSAPP_RECIPIENT_NUMBER=your-receiving-number-with-country-code-digits-only
   WHATSAPP_API_VERSION=your-supported-version-from-meta-dashboard
   WHATSAPP_TEMPLATE_NAME=cadeau_order_notification
   WHATSAPP_TEMPLATE_LANGUAGE=en_US
   ```

   API version format is `vNN.0`. The phone number **ID** identifies the API sender;
   the recipient is your destination WhatsApp number, with country code and no `+`,
   spaces or punctuation. Use a separate receiving number. For Meta's test sender,
   add and verify your destination as a test recipient. Do not put the token in
   `public/config.js` or commit `.env`.
5. Run `npm run css:build`, restart the backend with `npm start`, and serve `public/`.
   Sign in and submit an order to test the configured integration. This reserves
   real stock and sends a real message.

Reference: [Meta's WhatsApp Cloud API documentation and template examples](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).

### Behavior and operational limits

- `POST /api/orders` requires a signed-in user. The recipient and message template
  come only from server configuration. Customer input cannot change them.
- The server ignores client prices and snapshots the database price and product
  name. Quantity must be 1–99, within available stock. Each account can place at
  most one new order per minute; retries of the same request are allowed.
- Each form submission has a request UUID. Repeating it returns the existing
  order instead of reserving stock or notifying twice. Pending submissions survive
  reload in the same browser tab. A network error asks the customer to retry the
  same submission. Closing the tab discards the browser's pending submission.
- Orders remain saved if WhatsApp fails. Inspect `public.orders` in Supabase for
  order details and `notification_status`: `pending` (not yet confirmed),
  `accepted` (Meta returned a message ID), or `unknown` (request failed or timed out).
  API acceptance does **not** prove delivery. Delivery webhooks, an admin orders
  screen, and automatic retries are not implemented. Review pending/unknown orders
  manually; resending an uncertain request could duplicate a notification.
- A process crash after the database commit may leave a pending notification.
  The database remains the order record even if no WhatsApp message arrives.
- Stock is reserved on submission, with no automatic cancellation or restocking.
  If an order is cancelled, adjust stock through the existing admin product editor.
- Ordering returns an unavailable response until both SQL and environment setup
  are complete. Existing products and authentication keep working.

Run `npm test` for mocked order validation, deduplication and notification tests.
These tests do not contact Meta or modify your live Supabase database.

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
