# CartChat Admin Guide — Daily Workflow

The admin panel at `/admin` now runs on live Supabase data. It auto-refreshes every 60 seconds. This guide covers the full lifecycle: lead → payment → account → broadcast.

## Logging in
Go to `/admin/login.html` and sign in with an admin account. Admins are normal accounts with an admin role — to make one, sign up on the site, then run in Supabase SQL Editor:

```sql
update public.profiles set role = 'super_admin' where email = 'you@cartchat.ai';
```

## The customer lifecycle

**1. A lead comes in.** When someone fills the demo-request form, they appear in **Customers & Leads** with a yellow `lead` badge. You can contact them on WhatsApp/phone and pitch.

**2. They pay.** Customers pay via OMT / Whish / bank transfer and submit their reference number (and later, receipt) through the site. The payment lands in the **Payments** tab as `pending` with a badge count in the sidebar.

**3. You verify the payment.** Open the payment, check the reference against your OMT/bank statement, and click **✓ Verify Payment**. Verified payments count toward the revenue stat, and any linked order is automatically marked paid.

**4. You open their account.** Right after verifying, the panel automatically opens the **Open Customer Account** form pre-filled with the customer's email. (You can also click **Open Account** on any lead row, or **＋ Add Customer** at any time.) Fill in name, store, phone, choose the plan they paid for, and click **Create Account**.

**5. You send them their credentials.** A strong temporary password is shown **once** — copy it immediately. Send the customer a WhatsApp message like:

> Welcome to CartChat! 🎉 Your account is ready.
> Login: yourstore@email.com
> Temporary password: CC-xxxxxxxxxxxx
> Log in here: https://yourdomain.com/pages/login.html
> You'll land on your dashboard where you can set up your WhatsApp assistant.

The account is created pre-confirmed (no email verification needed) so they can log in immediately.

**6. Ongoing management.** Use the **Plan** button on any customer row to upgrade/downgrade them (trial → starter → growth → scale). Broadcast requests they submit appear in **Broadcast Orders**: review the message and audience, **Approve** (or **Reject**), send it via the Channels tab / Twilio, then **Mark Sent**.

## Tab reference

| Tab | Data source | What you do there |
|---|---|---|
| Overview | Live | Stats: customers, verified revenue, pending payments/orders + activity feed |
| Customers & Leads | Live | See accounts and leads, open accounts, change plans |
| Payments | Live | Verify or reject OMT/bank payments, open accounts for payers |
| Broadcast Orders | Live | Approve/reject/mark-sent broadcast requests |
| Contact Lists | Local (browser) | Segment taxonomy & pasted lists — still prototype, per-browser |
| Channel Setup | Live env check | Twilio/WhatsApp env status + send test messages |

## Notes
- If the panel shows "Could not load data", the Supabase env vars aren't set in Vercel or your account isn't an admin.
- Sessions are Supabase JWTs and expire (default 1 hour) — the panel redirects you to login when that happens. To keep admins logged in longer, raise the JWT expiry in Supabase → Authentication → Sessions.
- The temporary password cannot be recovered. If it's lost, the customer can use "forgot password" (if you enable Supabase email), or you can delete the user in Supabase → Authentication and recreate the account.
