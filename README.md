# CyberPulse AI

A fully autonomous, AI-powered cybersecurity news platform. Once deployed,
it runs forever with zero manual involvement: fetches news every hour,
writes original articles with Claude, and publishes them automatically.

**👉 Start here: [DEPLOY.md](./DEPLOY.md)** — step-by-step instructions to
get this live on the internet for free, in about 15 minutes.

---

## What this is

- `app/` — the Next.js website (homepage, article pages, the two cron API routes that run the automation)
- `lib/` — shared logic (RSS parsing, Claude API calls, the Supabase database client)
- `supabase-schema.sql` — run this once in Supabase to create your database tables
- `vercel.json` — tells Vercel to run the automation every hour, automatically, forever

No servers to manage. No phone or laptop needs to stay on. Once deployed
to Vercel and connected to Supabase, this runs entirely in the cloud.

See `DEPLOY.md` for the full walkthrough.
