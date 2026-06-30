# CyberPulse AI — Deploy Guide

This turns CyberPulse AI into a real, public website that runs forever on
its own — no phone, no Pydroid, nothing left open. Once deployed, it fetches
news and writes articles automatically, every hour, whether you're asleep,
at work, or your phone is off.

**Total cost: $0** (both Vercel and Supabase free tiers easily cover this).
**Time needed: about 15 minutes.**

You'll create two free accounts (Vercel and Supabase), connect them, and
deploy. No coding required — just copy/paste into a few boxes.

---

## What you're about to set up

| Piece | What it does | Cost |
|---|---|---|
| **Supabase** | Stores your articles (the database) | Free |
| **Vercel** | Hosts the website and runs the automation | Free |
| **Anthropic** | Writes the articles (you already have this) | Pay-as-you-go, ~$0.01/article |

---

## Step 1 — Create a Supabase account (the database)

1. Go to **https://supabase.com** and click **Start your project**
2. Sign up with GitHub or email (free, no card required)
3. Click **New Project**
   - Name: `cyberpulse` (or anything)
   - Database password: click "Generate a password" and **save it somewhere** (you won't need to remember it after this, but keep it safe)
   - Region: pick whichever is closest to you
   - Plan: Free
4. Click **Create new project** and wait about 2 minutes for it to spin up

### Set up the database tables

5. Once the project is ready, click **SQL Editor** in the left sidebar
6. Click **New query**
7. Open the file `supabase-schema.sql` (included in this download), copy **all** of it
8. Paste it into the SQL editor box
9. Click **Run** (bottom right)
10. You should see "Success. No rows returned" — that means it worked

### Get your Supabase keys

11. Click **Project Settings** (gear icon, bottom of left sidebar) → **API**
12. You'll see three values you need. Keep this tab open, you'll copy these in Step 3:
    - **Project URL** (starts with `https://`)
    - **anon public** key (long string)
    - **service_role** key (long string, click "reveal" to see it — keep this one secret, never share it publicly)

---

## Step 2 — Create a Vercel account (the hosting)

1. Go to **https://vercel.com** and click **Sign Up**
2. Sign up with GitHub (recommended — makes deployment one click) or email
3. That's it for now — you'll deploy in Step 4

---

## Step 3 — Get your Anthropic API key ready

You already have this from before, but if not:

1. Go to **https://console.anthropic.com**
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-`)
4. Make sure you have credit loaded: **Plans & Billing** → add at least $5

---

## Step 4 — Deploy to Vercel

### Option A: Deploy via GitHub (recommended)

1. Create a free GitHub account at **https://github.com** if you don't have one
2. Create a new repository (e.g. `cyberpulse-ai`), and upload all the files from this download into it
   - Easiest way: on the new repo page, click "uploading an existing file" and drag all the files in
3. Go back to **https://vercel.com/new**
4. Click **Import** next to your `cyberpulse-ai` repository
5. Before clicking Deploy, expand **Environment Variables** and add these four (paste the values you copied from Supabase and Anthropic):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |

6. Click **Deploy**
7. Wait about 2 minutes — Vercel will build and launch the site
8. You'll get a live URL like `cyberpulse-ai-yourname.vercel.app` — that's your real, public website

### Option B: Deploy via Vercel CLI (if you're comfortable with a terminal)

```bash
npm install -g vercel
cd cyberpulse-ai
vercel
```

Follow the prompts, then add the same 4 environment variables when asked,
or afterwards in the Vercel dashboard under **Settings → Environment Variables**.

---

## Step 5 — Turn on the automation

The cron jobs are already configured in `vercel.json` and will activate
automatically once deployed — **but only on Vercel's side if cron is enabled
for your project**.

1. In your Vercel project, go to the **Cron Jobs** tab in the sidebar
2. You should see two jobs listed:
   - `/api/cron/ingest` — runs once every hour, fetches news
   - `/api/cron/generate` — runs once every hour (offset by 30 min), writes articles
3. If they're not listed yet, redeploy once (Vercel sometimes needs a redeploy to pick up `vercel.json` on the very first deploy)

That's it. From this point on, the site runs completely on its own.

---

## Step 6 — Check it's working

It can take up to an hour for the first articles to appear (cron runs on
the hour). To check sooner, manually trigger the pipeline:

1. Visit `https://your-site.vercel.app/api/cron/ingest` directly in your browser — you should see a JSON response showing new items found
2. Then visit `https://your-site.vercel.app/api/cron/generate` — this writes 1-2 articles using Claude
3. Now visit `https://your-site.vercel.app` — your articles should appear

If you see `{"error":"ANTHROPIC_API_KEY not configured"}`, double check you
added that environment variable correctly in Vercel (Settings → Environment
Variables) and redeploy.

---

## What happens now, forever, with zero effort from you

```
Every hour, automatically, in the cloud:
  1. Vercel wakes up the ingest job
  2. It checks 6 cybersecurity news sources for anything new
  3. 30 minutes later, the generate job wakes up
  4. It takes up to 2 unprocessed news items and writes original articles with Claude
  5. Articles appear on your live site within 5 minutes (automatic refresh)
```

Your phone, Pydroid, and laptop can all be off. This runs on Vercel and
Supabase's servers, not yours.

---

## Costs going forward

- **Vercel free tier**: covers this comfortably — hosting, the website, and
  the cron jobs all stay within the free Hobby plan's limits at this scale
- **Supabase free tier**: 500MB of database storage — at roughly 5KB per
  article, that's around 100,000 articles before you'd need to upgrade
- **Anthropic API**: the only ongoing real cost, roughly $0.01 per article.
  At 2 articles/hour × 24 hours, that's about $0.50/day, or **~$15/month**
  if it ran at absolute maximum capacity every hour of every day. In
  practice it'll often find fewer than 2 new stories per hour, so real
  cost will usually be lower.

**Note on Vercel's free tier terms:** Vercel's Hobby plan is intended for
personal, non-commercial projects. Once you're ready to add ads or paid
subscriptions (Milestone 2), you'll want to upgrade to Vercel Pro
($20/month) to stay within their terms of service for a revenue-generating
site.

---

## If something goes wrong

**Site shows "No articles yet" after an hour**
→ Manually visit `/api/cron/ingest` then `/api/cron/generate` in your
browser to trigger it directly and see any error messages.

**`/api/cron/generate` returns a NO_CREDIT error**
→ Add credit at console.anthropic.com → Plans & Billing.

**Cron jobs don't appear in the Vercel dashboard**
→ Redeploy the project once (Deployments tab → click the three dots on the
latest deployment → Redeploy). Vercel needs a deploy to register the cron
schedule from `vercel.json`.

**Articles aren't appearing even though ingest/generate show success**
→ The homepage caches for 5 minutes (`revalidate = 300` in the code) —
wait a few minutes and refresh, or visit an article page directly which
always shows fresh data.
