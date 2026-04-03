create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  excerpt text not null,
  content text not null,
  image_url text not null default '',
  video_url text not null default '',
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  author_name text not null,
  is_anonymous boolean not null default true,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_published_at_idx on public.posts (published_at desc);
create index if not exists topics_published_at_idx on public.topics (published_at desc);
create index if not exists comments_topic_id_created_at_idx on public.comments (topic_id, created_at asc);

alter table public.posts enable row level security;
alter table public.topics enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Posts are publicly readable" on public.posts;
create policy "Posts are publicly readable"
on public.posts for select
using (true);

drop policy if exists "Topics are publicly readable" on public.topics;
create policy "Topics are publicly readable"
on public.topics for select
using (true);

drop policy if exists "Comments are publicly readable" on public.comments;
create policy "Comments are publicly readable"
on public.comments for select
using (true);

drop policy if exists "Comments can be inserted publicly" on public.comments;
create policy "Comments can be inserted publicly"
on public.comments for insert
with check (true);

insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;
