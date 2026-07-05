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

create table if not exists public.hotel_location_corrections (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  current_latitude double precision not null,
  current_longitude double precision not null,
  suggested_latitude double precision not null,
  suggested_longitude double precision not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  anonymous_scout_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing databases may already have these tables. `create table if not
-- exists` will not add new columns, so keep this section idempotent.
alter table public.hotels add column if not exists address text;
alter table public.hotels add column if not exists source text not null default 'manual';
alter table public.hotels add column if not exists external_id text;
alter table public.hotels add column if not exists verification_status text not null default 'unverified';
alter table public.hotels add column if not exists anonymous_scout_id text;
alter table public.hotels add column if not exists merged_into_hotel_id uuid references public.hotels(id);
alter table public.hotels add column if not exists updated_at timestamptz not null default now();

alter table public.bacon_reports add column if not exists breakfast_context text not null default 'buffet';
alter table public.bacon_reports add column if not exists note text;
alter table public.bacon_reports add column if not exists photo_url text;
alter table public.bacon_reports add column if not exists photo_status text not null default 'none';
alter table public.bacon_reports add column if not exists anonymous_scout_id text;
alter table public.bacon_reports add column if not exists flagged_count integer not null default 0;
alter table public.bacon_reports add column if not exists updated_at timestamptz not null default now();

alter table public.report_flags add column if not exists anonymous_scout_id text;

alter table public.hotel_location_corrections add column if not exists current_latitude double precision;
alter table public.hotel_location_corrections add column if not exists current_longitude double precision;
alter table public.hotel_location_corrections add column if not exists suggested_latitude double precision;
alter table public.hotel_location_corrections add column if not exists suggested_longitude double precision;
alter table public.hotel_location_corrections add column if not exists note text;
alter table public.hotel_location_corrections add column if not exists status text not null default 'pending';
alter table public.hotel_location_corrections add column if not exists anonymous_scout_id text;
alter table public.hotel_location_corrections add column if not exists updated_at timestamptz not null default now();

alter table public.hotels enable row level security;
alter table public.bacon_reports enable row level security;
alter table public.report_flags enable row level security;
alter table public.hotel_location_corrections enable row level security;

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
  and observed_date <= (current_date + 1)
  and breakfast_context in ('buffet', 'other')
  and photo_status in ('none', 'uploaded')
  and char_length(coalesce(note, '')) <= 500
  and (
    (photo_url is null and photo_status = 'none')
    or (
      photo_url is not null
      and photo_status = 'uploaded'
      and photo_url ~* '^https://[a-z0-9.-]+/reports/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]+\.(jpg|jpeg|png|webp)$'
    )
  )
);

drop policy if exists "Anyone can flag reports" on public.report_flags;
create policy "Anyone can flag reports"
on public.report_flags for insert
with check (
  reason is not null
  and char_length(reason) <= 80
);

drop policy if exists "Anyone can suggest hotel location corrections" on public.hotel_location_corrections;
create policy "Anyone can suggest hotel location corrections"
on public.hotel_location_corrections for insert
with check (
  hotel_id is not null
  and status = 'pending'
  and current_latitude between -90 and 90
  and suggested_latitude between -90 and 90
  and current_longitude between -180 and 180
  and suggested_longitude between -180 and 180
  and char_length(coalesce(note, '')) <= 280
);

create or replace function public.increment_report_flag_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bacon_reports
  set flagged_count = flagged_count + 1,
      updated_at = now()
  where id = new.report_id;

  return new;
end;
$$;

drop trigger if exists report_flags_increment_count on public.report_flags;
create trigger report_flags_increment_count
after insert on public.report_flags
for each row
execute function public.increment_report_flag_count();

create index if not exists hotels_city_country_idx on public.hotels(city, country);
create index if not exists bacon_reports_hotel_id_idx on public.bacon_reports(hotel_id);
create index if not exists bacon_reports_observed_date_idx on public.bacon_reports(observed_date desc);
create index if not exists hotel_location_corrections_hotel_id_idx on public.hotel_location_corrections(hotel_id);
create index if not exists hotel_location_corrections_status_idx on public.hotel_location_corrections(status, created_at desc);
