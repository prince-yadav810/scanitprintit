# PrintDesk — Deployment Checklist

**Domain:** `scanitprintit.in`  
**Stack:** Next.js 16 · Neon (PostgreSQL) · Cloudinary · Cashfree · Vercel Cron

---

## 1. Before You Push

### 1a. Generate secrets locally (never commit them)
```bash
# JWT secret
openssl rand -hex 32

# Cron secret
openssl rand -hex 24
```

Keep the outputs — you'll paste them into Vercel.

### 1b. Confirm `.env` is in `.gitignore`
```bash
grep ".env" .gitignore
# Should show: .env*
```

---

## 2. Neon Database Setup

1. Go to [neon.tech](https://neon.tech) → your existing project  
2. In **Settings → Connection string**, copy the **Pooled connection** URL  
   (it looks like `postgresql://...neon.tech/neondb?sslmode=require`)
3. After Vercel is configured, run the schema sync from your local machine:
   ```bash
   DATABASE_URL="<your-neon-url>" npx prisma db push
   ```
4. Seed the admin user:
   ```bash
   DEFAULT_ADMIN_PASSWORD="choose-a-strong-password" \
   DATABASE_URL="<your-neon-url>" \
   npx tsx scripts/seedAdmin.ts
   ```

---

## 3. Cloudinary Setup

1. Log in to [cloudinary.com](https://cloudinary.com)  
2. Dashboard → **API Keys** → copy **Cloud Name**, **API Key**, **API Secret**  
3. Enable **Aspose** add-on (if not already): Extensions → Aspose Document Conversion → Subscribe  

---

## 4. Cashfree Setup (Sandbox / Test)

1. Log in to [merchant.cashfree.com](https://merchant.cashfree.com)  
2. Switch to **Sandbox** environment (toggle top-right)  
3. Go to **Developers → API Keys** → copy **App ID** and **Secret Key**  
4. Go to **Developers → Webhooks** → Add a new webhook:
   - URL: `https://scanitprintit.in/api/webhooks/cashfree`
   - Events to subscribe: `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`
   - Version: **2023-08-01**

---

## 5. Vercel Environment Variables

Go to Vercel Dashboard → Your Project → **Settings → Environment Variables**  
Add **all** the following. Set **Environment = Production, Preview, Development** for each.

| Variable | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | `postgresql://...neon.tech/neondb?sslmode=require` | Neon dashboard |
| `JWT_SECRET` | 64-char hex string | `openssl rand -hex 32` |
| `DEFAULT_ADMIN_PASSWORD` | strong password | Your choice |
| `CLOUDINARY_CLOUD_NAME` | e.g. `bxndi86z` | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | numeric string | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | string | Cloudinary dashboard |
| `CASHFREE_APP_ID` | your sandbox App ID | Cashfree dashboard |
| `CASHFREE_SECRET_KEY` | your sandbox Secret | Cashfree dashboard |
| `CASHFREE_ENV` | `SANDBOX` | Set manually |
| `NEXT_PUBLIC_APP_URL` | `https://scanitprintit.in` | Set manually |
| `NEXT_PUBLIC_CASHFREE_ENV` | `sandbox` | Set manually |
| `CRON_SECRET` | 48-char hex string | `openssl rand -hex 24` |

> [!CAUTION]
> Never set real production Cashfree keys until you have tested the complete sandbox flow end-to-end.

---

## 6. Connect GitHub Repository

```bash
# In the project directory
git remote add origin https://github.com/prince-yadav810/scanitprintit.git
git add .
git commit -m "feat: Cashfree payment, Vercel deployment config, UI redesign"
git push -u origin main
```

Then in Vercel:
1. **Import Git Repository** → `prince-yadav810/scanitprintit`
2. Framework Preset: **Next.js** (auto-detected)
3. Build Command: `next build` (default)
4. Output Directory: `.next` (default)
5. Node Version: **20.x** (set in Settings → General)

---

## 7. Domain Setup (`scanitprintit.in`)

After Vercel deploys:

1. Go to Vercel → Project → **Settings → Domains**
2. Add `scanitprintit.in` and `www.scanitprintit.in`
3. Vercel will show you DNS records to add:

### DNS Records at your domain registrar

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

> These values are standard Vercel DNS. Confirm them in your Vercel dashboard as they may differ.

4. Wait for DNS propagation (5 min – 48 hours)
5. Vercel auto-provisions an SSL certificate via Let's Encrypt

---

## 8. Vercel Cron — File Cleanup

The `vercel.json` at the project root configures a cron that runs every 2 hours:
```json
{
  "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 */2 * * *" }]
}
```

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to this endpoint.  
No additional setup is needed — just ensure `CRON_SECRET` is set in environment variables.

---

## 9. Cashfree Webhook URL

Register this exact URL in Cashfree's webhook settings:
```
https://scanitprintit.in/api/webhooks/cashfree
```

---

## 10. Post-Deployment Test Flow

1. Open `https://scanitprintit.in/login` → sign in with admin credentials
2. Create a shop → visit `https://scanitprintit.in/s/<shop-slug>`
3. Upload a PDF → set copies/layout → click Continue
4. On the checkout page, click **Pay via UPI / Card**
5. Cashfree sandbox opens → use test UPI ID `success@upi` (or any Cashfree test credential)
6. After payment, the order status on the checkout page should update automatically to `Queued for Print` or `Awaiting Approval` within 5 seconds
7. If Auto-Print is on, the Windows Print Agent should pick up the job and mark it `Printed`

### Cashfree Sandbox Test Credentials
| Method | Detail |
|---|---|
| UPI | `success@upi` (always succeeds) |
| Card | `4111 1111 1111 1111` / any future expiry / CVV `123` |
| UPI (fail) | `failure@upi` |

---

## 11. Checklist Summary

- [ ] Neon `DATABASE_URL` obtained
- [ ] `JWT_SECRET` generated and saved
- [ ] `CRON_SECRET` generated and saved
- [ ] Cloudinary credentials obtained
- [ ] Cashfree **Sandbox** App ID + Secret obtained
- [ ] Cashfree webhook URL registered: `https://scanitprintit.in/api/webhooks/cashfree`
- [ ] All 13 environment variables added to Vercel
- [ ] Repository pushed to `prince-yadav810/scanitprintit`
- [ ] Vercel project created and linked to repo
- [ ] `prisma db push` run against production Neon DB
- [ ] `seedAdmin.ts` run once against production DB
- [ ] Domain DNS records added at registrar
- [ ] End-to-end payment test completed with `success@upi`
