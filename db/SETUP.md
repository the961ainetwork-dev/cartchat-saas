# CartChat — Supabase Setup

The backend now persists everything to Supabase and uses Supabase Auth (real hashed passwords, real JWTs). Setup takes about 10 minutes.

## 1. Create the project
Go to [supabase.com](https://supabase.com), create a new project (free tier is fine), and pick a region close to your users (eu-central works well for Lebanon).

## 2. Run the schema
Open **SQL Editor → New query**, paste the contents of `db/schema.sql`, and run it. This creates the `profiles`, `demo_leads`, `orders`, `payments`, `broadcast_orders`, and `handover_briefs` tables, enables row-level security, sets up the signup trigger, and creates a private `receipts` storage bucket.

## 3. Set environment variables in Vercel
In **Vercel → Project → Settings → Environment Variables**, add these three (values are under **Supabase → Settings → API**):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret key — server-only, never expose |

Redeploy after saving.

## 4. Auth settings (recommended)
In **Supabase → Authentication → Providers → Email**: decide whether to require email confirmation. If ON, new signups get `{ confirmationRequired: true }` from `/api/auth/signup` and must confirm before logging in. If OFF, signup returns a session token immediately (simplest to start).

## 5. Create your first admin
Sign up normally through the site (or Supabase dashboard → Authentication → Add user), find the user's UUID in **Authentication → Users**, then run:

```sql
update public.profiles set role = 'super_admin' where id = '<that-uuid>';
```

That account can now log in at `/admin` via `/api/admin/login`. The old hardcoded `admin@cartchat.ai / admin1234` no longer exists.

## What changed in the API

| Endpoint | Before | Now |
|---|---|---|
| `POST /api/auth/signup` | Fake token, nothing saved | Supabase Auth user + `profiles` row |
| `POST /api/auth/login` | Hardcoded demo user | Real JWT session |
| `GET /api/auth/me` | — (new) | Validates token, returns user |
| `POST /api/admin/login` | Plaintext password in code | Supabase Auth + role check |
| `POST /api/demo/create` | console.log | Insert into `demo_leads` (accepts `business`) |
| `POST /api/checkout/session` | console.log | Insert into `orders` |
| `POST /api/payments/submit` | console.log | Insert into `payments` (`pending_review`) |
| `POST /api/broadcast/submit` | console.log | Insert into `broadcast_orders` |
| `POST /api/handover/submit` | console.log | Insert into `handover_briefs` |

Response shapes are unchanged (`{ token, user }`, `{ ok, orderId }`, etc.), so no frontend changes are required to go live. The demo login button in `login.html` still works — it never hits the API.

## Still on the roadmap (not in this pass)
- Receipt file upload to the `receipts` bucket from `payment-pending.html`
- Admin panel reading live data from Supabase instead of `admin/data.js` mock data
- Email/Slack notifications on new leads and payments
- Stripe for card payments
