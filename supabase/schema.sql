-- Do They Have Bacon? MVP schema
-- Run this in Supabase SQL editor when moving from localStorage to real database.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  trust_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text not null,
  country text not null,
  latitude double precision not null,
  longitude double precision not null,
  location geography(point, 4326) generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  source text not null default 'manual' check (source in ('manual', 'osm')),
  external_id text,
  created_by_user_id uuid references auth.users(id),
  created_by_anonymous_scout_id text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'duplicate', 'hidden')),
  merged_into_hotel_id uuid references public.hotels(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotels_location_idx on public.hotels using gist(location);
create index if not exists hotels_name_city_country_idx on public.hotels (lower(name), lower(city), lower(country));

create table if not exists public.bacon_reports (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_scout_id text,
  status text not null check (status in ('yes', 'no', 'unsure')),
  observed_date date not null,
  breakfast_context text not null default 'buffet' check (breakfast_context in ('buffet', 'other')),
  note text check (char_length(note) <= 280),
  photo_url text,
  photo_status text not null default 'none' check (photo_status in ('none', 'attached', 'hidden')),
  flagged_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotels_anonymous_scout_idx on public.hotels(created_by_anonymous_scout_id);
create index if not exists bacon_reports_hotel_idx on public.bacon_reports(hotel_id);
create index if not exists bacon_reports_observed_date_idx on public.bacon_reports(observed_date desc);
create index if not exists bacon_reports_anonymous_scout_idx on public.bacon_reports(anonymous_scout_id);

create table if not exists public.report_flags (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bacon_reports(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique(report_id, user_id)
);

create table if not exists public.hotel_status_cache (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  current_status text not null default 'unscouted',
  confidence_level text not null default 'unknown',
  yes_count integer not null default 0,
  no_count integer not null default 0,
  unsure_count integer not null default 0,
  last_reported_at timestamptz,
  updated_at timestamptz not null default now()
);
