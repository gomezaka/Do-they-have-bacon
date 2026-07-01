-- Tribunesliter v0.2.2 Supabase-schema
-- Kjør hele filen i Supabase SQL Editor.
-- Trygt å kjøre flere ganger. Oppgraderer også v0.2/v0.2.1-tabeller.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  municipality text not null,
  address text,
  venue_type text not null default 'Flerbrukshall',
  sport_tags text[] not null default '{}',
  cover_emoji text not null default '🏟️',
  is_outdoor boolean not null default false,
  latitude numeric,
  longitude numeric,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facility_reports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  seating_type text,
  seat_comfort int check (seat_comfort between 1 and 5),
  has_backrest boolean not null default false,
  heating_level int check (heating_level between 1 and 5),
  toilet_quality int check (toilet_quality between 1 and 5),
  kiosk_status text,
  parking text,
  accessibility int check (accessibility between 1 and 5),
  roof_cover boolean not null default false,
  garderobe_quality int check (garderobe_quality between 1 and 5),
  shower_quality int check (shower_quality between 1 and 5),
  view_quality int check (view_quality between 1 and 5),
  noise_level int check (noise_level between 1 and 5),
  notes text,
  approved boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tribunesliter_minutes int not null check (tribunesliter_minutes between 1 and 180),
  comfort_score int not null check (comfort_score between 1 and 5),
  view_score int not null check (view_score between 1 and 5),
  temperature_score int not null check (temperature_score between 1 and 5),
  accessibility_score int not null check (accessibility_score between 1 and 5),
  event_type text not null default 'Kamp',
  visit_date date not null default current_date,
  comment text,
  approved boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.venue_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  municipality text not null,
  address text,
  venue_type text not null,
  is_outdoor boolean not null default false,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  venue_id uuid references public.venues(id) on delete set null,
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Migrering for databaser som allerede kjører v0.2/v0.2.1.
alter table public.facility_reports add column if not exists status text;
alter table public.reviews add column if not exists status text;
alter table public.venue_requests add column if not exists venue_id uuid references public.venues(id) on delete set null;
alter table public.venue_requests add column if not exists processed_by uuid references auth.users(id) on delete set null;
alter table public.venue_requests add column if not exists processed_at timestamptz;

update public.reviews set status = 'approved' where approved = true and coalesce(status, '') <> 'approved';
update public.reviews set status = 'pending' where status is null;
update public.reviews set approved = (status = 'approved') where status in ('pending', 'approved', 'rejected', 'hidden');
alter table public.reviews alter column status set default 'pending';
alter table public.reviews alter column status set not null;

update public.facility_reports set status = 'approved' where approved = true and coalesce(status, '') <> 'approved';
update public.facility_reports set status = 'pending' where status is null;
update public.facility_reports set approved = (status = 'approved') where status in ('pending', 'approved', 'rejected', 'hidden');
alter table public.facility_reports alter column status set default 'pending';
alter table public.facility_reports alter column status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_status_check') then
    alter table public.reviews add constraint reviews_status_check check (status in ('pending', 'approved', 'rejected', 'hidden'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'facility_reports_status_check') then
    alter table public.facility_reports add constraint facility_reports_status_check check (status in ('pending', 'approved', 'rejected', 'hidden'));
  end if;
end $$;

create index if not exists venues_status_name_idx on public.venues(status, name);
create index if not exists reviews_venue_status_created_idx on public.reviews(venue_id, status, created_at desc);
create index if not exists facility_reports_venue_status_created_idx on public.facility_reports(venue_id, status, created_at desc);
create index if not exists venue_requests_status_created_idx on public.venue_requests(status, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user')
$$;

drop view if exists public.approved_reviews_public;
create view public.approved_reviews_public as
select
  r.id,
  r.venue_id,
  coalesce(p.display_name, 'Innlogget bruker') as user_name,
  r.tribunesliter_minutes,
  r.comfort_score,
  r.view_score,
  r.temperature_score,
  r.accessibility_score,
  r.event_type,
  r.visit_date,
  r.comment,
  r.created_at
from public.reviews r
left join public.profiles p on p.id = r.user_id
where r.status = 'approved' and r.approved = true;

drop view if exists public.venue_public_cards;
create view public.venue_public_cards as
select
  v.id,
  v.name,
  v.municipality,
  v.address,
  v.venue_type,
  v.sport_tags,
  v.cover_emoji,
  v.is_outdoor,
  v.status,
  coalesce(rs.tribunesliter_minutes, 0) as tribunesliter_minutes,
  coalesce(rs.review_count, 0) as review_count,
  case
    when coalesce(rs.review_count, 0) = 0 then 'Ingen vurderinger ennå. Bli den første som tester tribunen.'
    when rs.tribunesliter_minutes <= 15 then 'Ta med pute. Og vilje.'
    when rs.tribunesliter_minutes <= 25 then 'Kort kamp går fint. Cup blir risikosport.'
    when rs.tribunesliter_minutes <= 40 then 'Godkjent sitteplass for vanlige folk.'
    else 'Luksusnivå. Her kan besteforeldre overleve sluttspill.'
  end as summary,
  coalesce(
    jsonb_build_object(
      'seating_type', fr.seating_type,
      'seat_comfort', fr.seat_comfort,
      'has_backrest', fr.has_backrest,
      'heating_level', fr.heating_level,
      'toilet_quality', fr.toilet_quality,
      'kiosk_status', fr.kiosk_status,
      'parking', fr.parking,
      'accessibility', fr.accessibility,
      'roof_cover', fr.roof_cover,
      'garderobe_quality', fr.garderobe_quality,
      'shower_quality', fr.shower_quality,
      'view_quality', fr.view_quality,
      'noise_level', fr.noise_level,
      'notes', fr.notes
    ),
    '{}'::jsonb
  ) as facilities,
  case
    when v.is_outdoor then array['Sitteunderlag', 'Varm drikke', 'Ekstra lag', 'Regnjakke']::text[]
    else array['Sitteunderlag', 'Kaffe', 'Småpenger til kiosk']::text[]
  end as packlist,
  fr.created_at as facility_reported_at
from public.venues v
left join lateral (
  select
    round(avg(r.tribunesliter_minutes))::int as tribunesliter_minutes,
    count(r.id)::int as review_count
  from public.reviews r
  where r.venue_id = v.id and r.status = 'approved' and r.approved = true
) rs on true
left join lateral (
  select
    fr2.seating_type,
    fr2.seat_comfort,
    fr2.has_backrest,
    fr2.heating_level,
    fr2.toilet_quality,
    fr2.kiosk_status,
    fr2.parking,
    fr2.accessibility,
    fr2.roof_cover,
    fr2.garderobe_quality,
    fr2.shower_quality,
    fr2.view_quality,
    fr2.noise_level,
    fr2.notes,
    fr2.created_at
  from public.facility_reports fr2
  where fr2.venue_id = v.id and fr2.status = 'approved' and fr2.approved = true
  order by fr2.created_at desc
  limit 1
) fr on true
where v.status = 'approved';

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.facility_reports enable row level security;
alter table public.reviews enable row level security;
alter table public.venue_requests enable row level security;

-- Gjør policy-delen trygg å kjøre flere ganger.
drop policy if exists "Public can read approved venues" on public.venues;
drop policy if exists "Public can read approved reviews" on public.reviews;
drop policy if exists "Public can read approved facilities" on public.facility_reports;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Logged in users can submit reviews" on public.reviews;
drop policy if exists "Logged in users can submit facilities" on public.facility_reports;
drop policy if exists "Anyone logged in can request venue" on public.venue_requests;
drop policy if exists "Users can see own venue requests" on public.venue_requests;
drop policy if exists "Moderators can insert venues" on public.venues;
drop policy if exists "Moderators can update venues" on public.venues;
drop policy if exists "Moderators can update reviews" on public.reviews;
drop policy if exists "Moderators can update facilities" on public.facility_reports;
drop policy if exists "Moderators can update venue requests" on public.venue_requests;

-- Lesing
create policy "Public can read approved venues" on public.venues
  for select using (status = 'approved' or public.current_user_role() in ('moderator', 'admin'));

create policy "Public can read approved reviews" on public.reviews
  for select using (status = 'approved' or user_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

create policy "Public can read approved facilities" on public.facility_reports
  for select using (status = 'approved' or user_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

create policy "Users can read own profile" on public.profiles
  for select using (id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

-- Admin kan senere gi moderatorrolle videre.
create policy "Admins can update profiles" on public.profiles
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Innsending. Vanlige brukere får bare sende inn ventende innhold.
create policy "Logged in users can submit reviews" on public.reviews
  for insert with check (auth.uid() is not null and user_id = auth.uid() and status = 'pending' and approved = false);

create policy "Logged in users can submit facilities" on public.facility_reports
  for insert with check (auth.uid() is not null and user_id = auth.uid() and status = 'pending' and approved = false);

create policy "Anyone logged in can request venue" on public.venue_requests
  for insert with check (auth.uid() is not null and user_id = auth.uid() and status = 'pending');

create policy "Users can see own venue requests" on public.venue_requests
  for select using (user_id = auth.uid() or public.current_user_role() in ('moderator', 'admin'));

-- Moderator/admin kan publisere, avvise og skjule.
create policy "Moderators can insert venues" on public.venues
  for insert with check (public.current_user_role() in ('moderator', 'admin'));

create policy "Moderators can update venues" on public.venues
  for update using (public.current_user_role() in ('moderator', 'admin'))
  with check (public.current_user_role() in ('moderator', 'admin'));

create policy "Moderators can update reviews" on public.reviews
  for update using (public.current_user_role() in ('moderator', 'admin'))
  with check (public.current_user_role() in ('moderator', 'admin'));

create policy "Moderators can update facilities" on public.facility_reports
  for update using (public.current_user_role() in ('moderator', 'admin'))
  with check (public.current_user_role() in ('moderator', 'admin'));

create policy "Moderators can update venue requests" on public.venue_requests
  for update using (public.current_user_role() in ('moderator', 'admin'))
  with check (public.current_user_role() in ('moderator', 'admin'));

-- Demo-/startdata. Kan slettes etterpå.
insert into public.venues (name, municipality, address, venue_type, sport_tags, cover_emoji, is_outdoor, status)
select src.name, src.municipality, src.address, src.venue_type, src.sport_tags, src.cover_emoji, src.is_outdoor, src.status
from (
  values
    ('Tindlundhallen', 'Sarpsborg', 'Tindlundveien 34', 'Flerbrukshall', array['Håndball', 'Innebandy', 'Basket']::text[], '🏟️', false, 'approved'),
    ('Grålumhallen', 'Sarpsborg', 'Grålumveien 50', 'Idrettshall', array['Håndball', 'Volleyball']::text[], '🏐', false, 'approved'),
    ('Nesbyen kunstgress', 'Nesbyen', 'Idrettsvegen 8', 'Utendørsbane', array['Fotball']::text[], '⚽', true, 'approved')
) as src(name, municipality, address, venue_type, sport_tags, cover_emoji, is_outdoor, status)
where not exists (
  select 1
  from public.venues v
  where lower(v.name) = lower(src.name)
    and lower(v.municipality) = lower(src.municipality)
);

-- Første admin settes manuelt etter at du har logget inn én gang:
-- 1) Finn bruker: select id, email from auth.users order by created_at desc;
-- 2) Sett rolle: update public.profiles set role = 'admin' where id = '<DIN-BRUKER-UUID>';
