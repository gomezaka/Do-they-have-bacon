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
