# 🌸 petal — setup guide

Your personal task app, now with multi-user support. Deploy in ~20 minutes for free.

---

## what you need
- A [Vercel](https://vercel.com) account ✅
- A [GitHub](https://github.com) account (free)
- An [Upstash](https://upstash.com) account (free)
- A [Clerk](https://clerk.com) account (free)

---

## step 1 — Upstash (your database)

1. Go to [upstash.com](https://upstash.com) and sign up
2. Click **Create Database** → name it `petal` → pick closest region
3. On the database page, scroll to **REST API** and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN` (the read-write one, not readonly!)

---

## step 2 — Clerk (Google login)

1. Go to [clerk.com](https://clerk.com) and sign up
2. Click **Create application**
3. Name it `petal`, enable **Google** as a sign-in option, click Create
4. In the Clerk dashboard go to **API Keys** and copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

---

## step 3 — GitHub repo

1. Go to [github.com/new](https://github.com/new), create a private repo named `petal`
2. Upload all files from this zip into the repo

---

## step 4 — Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your `petal` repo
2. Before deploying, add ALL of these environment variables:

   | Name | Value |
   |------|-------|
   | `UPSTASH_REDIS_REST_URL` | from Upstash |
   | `UPSTASH_REDIS_REST_TOKEN` | from Upstash (read-write!) |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from Clerk |
   | `CLERK_SECRET_KEY` | from Clerk |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/` |
   | `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/` |

3. Click **Deploy** 🎉

---

## step 5 — add your Vercel URL to Clerk

After deploying, Clerk needs to know your app's URL:

1. Go to your Clerk dashboard → **Domains**
2. Add your Vercel URL (e.g. `petal-xyz.vercel.app`)

---

## sharing with others (e.g. your mom!)

Just send them the URL. They'll be prompted to sign in with Google.
Each person gets their own completely separate tasks, projects, and categories.

Your existing data will automatically migrate to your account on first login. 🌸

---

## local development

```bash
cp .env.local.example .env.local
# fill in all 8 env vars
npm install
npm run dev
```
