-- ============================================================
--  CyberPulse AI — Database Schema
--  Run this once in Supabase: SQL Editor → New Query → paste → Run
-- ============================================================

create table if not exists raw_sources (
  id            bigint generated always as identity primary key,
  source_name   text not null,
  source_url    text not null,
  title         text not null,
  raw_content   text,
  content_hash  text not null unique,
  published_at  text,
  ingested_at   timestamptz not null default now(),
  processed     integer not null default 0
);

create index if not exists idx_raw_sources_hash on raw_sources(content_hash);
create index if not exists idx_raw_sources_processed on raw_sources(processed);

create table if not exists articles (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  title         text not null,
  summary       text not null,
  content       text not null,
  tags          jsonb not null default '[]',
  source_urls   jsonb not null default '[]',
  category      text not null default 'general',
  severity      text,
  cve_ids       jsonb not null default '[]',
  published_at  timestamptz not null default now(),
  view_count    integer not null default 0
);

create index if not exists idx_articles_published on articles(published_at desc);
create index if not exists idx_articles_category on articles(category);
create index if not exists idx_articles_slug on articles(slug);

-- Row Level Security: public can read articles, nothing else is exposed publicly.
-- All writes happen via the service role key from cron jobs only.

alter table articles enable row level security;
alter table raw_sources enable row level security;

create policy "Public can read articles"
  on articles for select
  using (true);

-- No public policies on raw_sources — it's internal pipeline data only,
-- accessed exclusively via the service role key from cron jobs.
