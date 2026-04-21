# 🌸 petal — setup guide

Your personal task app. Deploy in ~15 minutes for free.

---

## what you need
- A [Vercel](https://vercel.com) account (you already have this ✅)
- A [GitHub](https://github.com) account (free)
- An [Upstash](https://upstash.com) account (free)

---

## step 1 — create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `petal` (or whatever you like)
3. Set it to **Private**
4. Click **Create repository**
5. Upload all the files from this zip into the repo
   - easiest: drag the unzipped folder into the GitHub web interface
   - or use the GitHub Desktop app

---

## step 2 — set up Upstash (your database)

1. Go to [upstash.com](https://upstash.com) and sign up for free
2. Click **Create Database**
3. Name it `petal`, choose the region closest to you (e.g. US East)
4. Click **Create**
5. On the database page, scroll down to **REST API**
6. Copy the two values you'll need:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Keep these handy — you'll paste them into Vercel in the next step.

---

## step 3 — deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your `petal` GitHub repo
3. Vercel will auto-detect it as a Next.js app — leave all settings as-is
4. Before clicking Deploy, click **Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `UPSTASH_REDIS_REST_URL` | paste from Upstash |
   | `UPSTASH_REDIS_REST_TOKEN` | paste from Upstash |

5. Click **Deploy** 🎉
6. Vercel will give you a URL like `petal-xyz.vercel.app`

---

## step 4 — get a cute URL (optional)

In your Vercel project settings → **Domains**, you can set a custom domain alias.
Try claiming `petal.vercel.app` — if it's taken, try `mypetal`, `petalapp`, etc.

---

## using petal

- **✨ today** — your max 3 tasks for the day. drag from planning or add directly.
- **🗓 planning** — three buckets: brain dump, this month, future. drag tasks between them freely. filter by category.
- **🌸 projects** — coming soon!

**tips:**
- drag the ⠿ handle on any task to move it between buckets
- double-click any task text to edit it
- tasks auto-save to your database — works on any device, any browser

---

## local development (optional)

If you want to run it on your computer:

```bash
# 1. install dependencies
npm install

# 2. copy the env file and fill in your Upstash values
cp .env.local.example .env.local

# 3. run the dev server
npm run dev

# 4. open http://localhost:3000
```

---

## updating petal later

Any time you want to change something — just edit the code and push to GitHub.
Vercel will automatically redeploy within ~30 seconds. ✨
