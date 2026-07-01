-- Draft Row Level Security policies.
-- API routes use the server-side service role key. Public users read data; anonymous writes go through API routes with rate limits and optional Turnstile.

alter table public.profiles enable row level security;
alter table public.hotels enable row level security;
alter table public.bacon_reports enable row level security;
alter table public.report_flags enable row level security;
alter table public.hotel_status_cache enable row level security;

create policy "Profiles are readable" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Visible hotels are readable" on public.hotels
  for select using (verification_status <> 'hidden');

create policy "Authenticated users can create hotels" on public.hotels
  for insert with check (auth.uid() is not null and created_by_user_id = auth.uid());

-- Anonymous creation is intentionally handled by Next.js API routes using the service role key,
-- not direct browser inserts. This keeps rate limits and Turnstile checks in one place.

create policy "Reports are readable" on public.bacon_reports
  for select using (true);

create policy "Authenticated users can create reports" on public.bacon_reports
  for insert with check (auth.uid() is not null and user_id = auth.uid());

-- Anonymous reports are also handled only through the API routes.

create policy "Users can flag reports once" on public.report_flags
  for insert with check (auth.uid() is not null and user_id = auth.uid());

create policy "Status cache is readable" on public.hotel_status_cache
  for select using (true);
