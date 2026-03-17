# 🍕 CPP Free Food — Cal Poly Pomona Event Calendar

A website that automatically scrapes and displays campus events with free food at Cal Poly Pomona.

---

## How it works

1. **Scraper** hits CPP Campus Groups, CPP's official calendar, Student Affairs pages, and Eventbrite daily
2. Events with "free food" keywords are saved to **Supabase** (your database)
3. The **Next.js website** (hosted on Vercel) fetches and displays them in a clean calendar view
4. A **Vercel Cron Job** runs the scraper automatically every morning at 8 AM

---

## Setup Guide (Read This First!)

### Step 1 — Set Up Supabase (your database)

1. Go to [supabase.com](https://supabase.com) and log in
2. Click **"New Project"**
   - Name it: `cpp-free-food`
   - Set a database password (save this somewhere!)
   - Choose the **US West** region
   - Click **"Create new project"** (takes ~2 minutes)
3. Once created, go to the left sidebar → **"SQL Editor"**
4. Click **"+ New query"**
5. Copy the entire contents of `supabase-schema.sql` (in this folder) and paste it in
6. Click **"Run"** — you should see "Success. No rows returned"
7. Now go to **Project Settings** (gear icon, bottom left) → **API**
8. Copy these two values — you'll need them soon:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public key** (long string starting with `eyJ...`)

---

### Step 2 — Get the code on GitHub

1. Go to [github.com](https://github.com) and create a **new repository**
   - Name: `cpp-free-food`
   - Set to **Public** (required for free Vercel deploys)
   - Don't initialize with README
2. On your computer, open a terminal in this project folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/cpp-free-food.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

---

### Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **"Add New Project"**
3. Click **"Import"** next to your `cpp-free-food` repo
4. In the **"Environment Variables"** section, add these three variables:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 1 |
   | `CRON_SECRET` | Any random string you make up, e.g. `broncos2025abc` |

5. Click **"Deploy"** — Vercel builds and deploys your site (takes ~2 minutes)
6. Once deployed, you'll get a URL like `https://cpp-free-food.vercel.app`

---

### Step 4 — Seed the database with initial events

After deploying, you need to run the scraper once manually to populate events:

1. In your browser, go to:
   ```
   https://your-vercel-url.vercel.app/api/scrape
   ```
   But add your secret as a header — easiest way is to use this terminal command:
   ```bash
   curl -H "Authorization: Bearer broncos2025abc" https://your-vercel-url.vercel.app/api/scrape
   ```
   Replace `broncos2025abc` with whatever you set as `CRON_SECRET`.

2. You should see a JSON response like `{"success":true,"inserted":8,"total_scraped":8}`
3. Visit your site — events should now appear! 🎉

---

### Step 5 — Verify the cron job is set up

The `vercel.json` file configures a cron job to scrape every day at 8 AM automatically.

To verify it's active:
1. In Vercel dashboard, go to your project
2. Click **Settings** → **Cron Jobs**
3. You should see `/api/scrape` scheduled for `0 8 * * *`

> **Note**: Vercel's free plan supports cron jobs. The first invocation each day is free.

---

## Local Development

Want to run it on your own computer to make changes?

1. Copy the environment file:
   ```bash
   cp .env.local.example .env.local
   ```
2. Fill in `.env.local` with your Supabase URL and key
3. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000)

---

## Adding More Event Sources

Open `src/lib/scraper.ts` and add a new scraper function following the same pattern as the existing ones. Then add it to the `Promise.allSettled([...])` array in `scrapeAllSources()`.

Good sources to add:
- **CPP Discord servers** (manual additions via the sample events)
- **Bronco Athletics** events page
- **University Library** events
- **The Poly Post** (student newspaper) events listings
- **r/CalPolyPomona** subreddit (check for event posts)

---

## Tech Stack

- **Next.js 14** — React framework, handles frontend + API routes
- **Supabase** — PostgreSQL database (free tier: 500MB, plenty for events)
- **Vercel** — Hosting + serverless functions + cron jobs (free tier)
- **Cheerio** — HTML scraping library
- **date-fns** — Date formatting

---

## Troubleshooting

**Events not showing?**
- Make sure you ran the Supabase SQL schema (Step 1)
- Check that env vars are set correctly in Vercel
- Manually trigger `/api/scrape` (Step 4)

**Supabase "relation does not exist" error?**
- You forgot to run the SQL schema. Go back to Supabase → SQL Editor and run `supabase-schema.sql`

**Scraper returns 0 events?**
- This is normal! Many sites block scrapers. The app falls back to sample events automatically.
- The scraper improves over time as CPP's site structure is learned

**Build fails on Vercel?**
- Make sure all 3 environment variables are set
- Check the Vercel build logs for the specific error
