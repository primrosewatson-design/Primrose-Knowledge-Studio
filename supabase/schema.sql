-- Videos table
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail text,
  duration text,
  category text,
  video_url text,
  price numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

-- Purchases table
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  email text not null,
  amount_paid numeric(10,2) not null,
  created_at timestamptz default now(),
  unique(user_id, video_id)
);

-- Video views table (analytics only — no cap; purchasers get unlimited replays).
create table if not exists video_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  view_count int not null default 0,
  last_viewed_at timestamptz default now(),
  unique(user_id, video_id)
);

-- Video gifts table: one single-use gift link per purchase. The edge functions
-- `create-gift` and `redeem-gift` are the only things that mutate this table
-- in production — they run as service_role and bypass RLS. The RLS policy
-- below is defence-in-depth for the giver's own visibility.
create table if not exists video_gifts (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references purchases(id) on delete cascade,
  giver_user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references videos(id) on delete cascade,
  token text not null unique,
  recipient_email text,
  recipient_name text,
  message text,
  redeemed_at timestamptz,
  redeemed_views integer not null default 0,
  created_at timestamptz not null default now()
);

-- Access codes table: admin-issued reusable codes for free viewing. Redeemed
-- anonymously via the `redeem-code` edge function (service_role, bypasses
-- RLS). The `code` column is `citext` so lookups are case-insensitive while
-- `%` and `_` stay literal — an earlier `.ilike(code, input)` version was
-- LIKE-wildcard injectable. `note` is user-visible — it renders under the
-- video title on the redemption page, so it's written as friendly viewer
-- copy, not as an admin memo.
create extension if not exists citext;
create table if not exists access_codes (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  video_id uuid not null references videos(id) on delete cascade,
  note text,
  redeemed_at timestamptz,
  redeemed_views integer not null default 0,
  created_at timestamptz not null default now()
);

-- Atomic counter bump for access_codes. The edge function used to do a
-- read-then-write on `redeemed_views`, which lost updates under concurrent
-- redemptions. This RPC folds the increment into a single UPDATE. Locked
-- down to service_role so the public anon key can never call it directly.
create or replace function public.bump_access_code_usage(p_code_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.access_codes
     set redeemed_views = redeemed_views + 1,
         redeemed_at    = now()
   where id = p_code_id;
$$;
revoke all on function public.bump_access_code_usage(uuid) from public;
revoke all on function public.bump_access_code_usage(uuid) from anon, authenticated;
grant execute on function public.bump_access_code_usage(uuid) to service_role;

-- Row level security
alter table videos enable row level security;
alter table purchases enable row level security;
alter table video_views enable row level security;
alter table video_gifts enable row level security;
alter table access_codes enable row level security;
-- No public policies on access_codes — all reads/writes go through the
-- `redeem-code` edge function which runs as service_role.

-- Videos: anyone can read
create policy "Videos are public" on videos for select using (true);

-- Purchases: users can only see their own
create policy "Users see own purchases" on purchases for select
  using (auth.uid() = user_id);

create policy "Users create own purchases" on purchases for insert
  with check (auth.uid() = user_id);

-- Video views: users can only see/update their own
create policy "Users see own views" on video_views for select
  using (auth.uid() = user_id);

create policy "Users upsert own views" on video_views for insert
  with check (auth.uid() = user_id);

create policy "Users update own views" on video_views for update
  using (auth.uid() = user_id);

-- Video gifts: giver can see their own rows. Redeem path goes through the
-- service_role edge function and doesn't rely on RLS.
create policy "Giver sees own gifts" on video_gifts for select
  to authenticated
  using (giver_user_id = (select auth.uid()));

-- Seed some videos
insert into videos (title, description, thumbnail, duration, category, video_url, price) values
  ('React Fundamentals', 'Master the core concepts of React including components, props, and state management.', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400', '45:30', 'React', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 29.99),
  ('TypeScript Deep Dive', 'Advanced TypeScript patterns for building robust applications.', 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400', '1:02:15', 'TypeScript', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 34.99),
  ('CSS Grid Mastery', 'Build complex layouts with CSS Grid from beginner to advanced.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', '38:45', 'CSS', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 24.99),
  ('Node.js API Design', 'Design and build scalable REST APIs with Node.js and Express.', 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400', '55:20', 'Node.js', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 39.99),
  ('Database Design Fundamentals', 'Learn best practices for designing scalable and efficient databases.', 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400', '31:20', 'Database', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 29.99),
  ('JavaScript Performance', 'Optimize your JavaScript code for maximum performance.', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400', '42:10', 'JavaScript', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 27.99)
on conflict do nothing;
