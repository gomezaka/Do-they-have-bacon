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

alter table public.hotel_location_corrections enable row level security;

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

create index if not exists hotel_location_corrections_hotel_id_idx on public.hotel_location_corrections(hotel_id);
create index if not exists hotel_location_corrections_status_idx on public.hotel_location_corrections(status, created_at desc);
