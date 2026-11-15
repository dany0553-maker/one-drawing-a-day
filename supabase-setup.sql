-- ציור ביום: הגדרת מאגר הנתונים ב-Supabase.
-- מדביקים את כל הקובץ ב-SQL Editor ולוחצים Run. אפשר להריץ אותו פעם אחת בלבד.

-- 1. פרופילים: השם שמוצג ליד כל ציור
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2. ציורים: ציור אחד לכל אדם בכל יום
create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  image_path text not null,
  thumb_path text,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- 3. תגובות באימוג'י
create table public.reactions (
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  emoji text not null,
  primary key (drawing_id, user_id)
);

-- 4. הרשאות: כל משתמש מחובר רואה הכול, וכותב ומוחק רק את שלו
alter table public.profiles  enable row level security;
alter table public.drawings  enable row level security;
alter table public.reactions enable row level security;

create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "drawings read"   on public.drawings for select to authenticated using (true);
create policy "drawings insert" on public.drawings for insert to authenticated with check (user_id = auth.uid());
create policy "drawings update" on public.drawings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "drawings delete" on public.drawings for delete to authenticated using (user_id = auth.uid());

create policy "reactions read"   on public.reactions for select to authenticated using (true);
create policy "reactions insert" on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "reactions update" on public.reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reactions delete" on public.reactions for delete to authenticated using (user_id = auth.uid());

-- 5. אחסון התמונות. הקבצים נשמרים בתיקייה על שם המשתמש.
-- הדלי ציבורי: מי שיש לו את הכתובת המדויקת של תמונה יכול לראות אותה. הכתובות ארוכות ולא ניתנות לניחוש.
insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', true)
on conflict (id) do nothing;

create policy "drawings files read" on storage.objects for select
  using (bucket_id = 'drawings');
create policy "drawings files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'drawings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "drawings files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'drawings' and (storage.foldername(name))[1] = auth.uid()::text);

-- 6. עדכון חי: ציור חדש של החבר מופיע אצלך בלי לרענן
alter publication supabase_realtime add table public.drawings, public.reactions;
