-- v0.8 migration: anonymous-first reporting.
-- Run this if you already created the v0.7 schema in Supabase.

alter table public.hotels
  add column if not exists created_by_anonymous_scout_id text;

alter table public.bacon_reports
  add column if not exists anonymous_scout_id text;

create index if not exists hotels_anonymous_scout_idx on public.hotels(created_by_anonymous_scout_id);
create index if not exists bacon_reports_anonymous_scout_idx on public.bacon_reports(anonymous_scout_id);
