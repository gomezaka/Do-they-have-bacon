create extension if not exists pgcrypto;

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text not null,
  country text not null,
  latitude double precision not null,
  longitude double precision not null,
  source text not null default 'manual',
  external_id text,
  verification_status text not null default 'unverified',
  anonymous_scout_id text,
  merged_into_hotel_id uuid references public.hotels(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bacon_reports (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'unsure')),
  observed_date date not null,
  breakfast_context text not null default 'buffet',
  note text,
  photo_url text,
  photo_status text not null default 'none',
  anonymous_scout_id text,
  flagged_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bacon_reports(id) on delete cascade,
  reason text not null,
  anonymous_scout_id text,
  created_at timestamptz not null default now()
);

alter table public.hotels enable row level security;
alter table public.bacon_reports enable row level security;
alter table public.report_flags enable row level security;

drop policy if exists "Public can read hotels" on public.hotels;
create policy "Public can read hotels"
on public.hotels for select
using (verification_status <> 'hidden' and merged_into_hotel_id is null);

drop policy if exists "Anyone can add hotels" on public.hotels;
create policy "Anyone can add hotels"
on public.hotels for insert
with check (
  name is not null
  and city is not null
  and country is not null
  and verification_status in ('unverified', 'verified')
);

drop policy if exists "Public can read reports" on public.bacon_reports;
create policy "Public can read reports"
on public.bacon_reports for select
using (true);

drop policy if exists "Anyone can add reports" on public.bacon_reports;
create policy "Anyone can add reports"
on public.bacon_reports for insert
with check (
  status in ('yes', 'no', 'unsure')
  and observed_date is not null
);

drop policy if exists "Anyone can flag reports" on public.report_flags;
create policy "Anyone can flag reports"
on public.report_flags for insert
with check (reason is not null);

create index if not exists hotels_city_country_idx on public.hotels(city, country);
create index if not exists bacon_reports_hotel_id_idx on public.bacon_reports(hotel_id);
create index if not exists bacon_reports_observed_date_idx on public.bacon_reports(observed_date desc);
