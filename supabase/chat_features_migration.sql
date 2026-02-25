-- Chat feature tables for Natural (group chat, requests, blocks, hidden messages)
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

-- Direct chats (core)
create table if not exists public.direct_chats (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint direct_chats_not_self check (user_a <> user_b)
);

-- Canonical uniqueness for (user_a, user_b) regardless of order.
create unique index if not exists idx_direct_chats_unique_pair
on public.direct_chats (least(user_a::text, user_b::text), greatest(user_a::text, user_b::text));

create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.direct_chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  edited_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_message_reactions (
  message_id bigint not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.direct_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.direct_messages(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'direct-attachments',
  path text null,
  file_name text not null,
  mime_type text null,
  size_bytes bigint not null default 0,
  external_url text null,
  created_at timestamptz not null default now()
);

-- Group chats
create table if not exists public.group_chats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  avatar text null,
  created_at timestamptz not null default now()
);

alter table public.group_chats
  alter column created_by set default auth.uid();
alter table public.group_chats
  add column if not exists avatar text null;

create table if not exists public.group_chat_members (
  group_chat_id uuid not null references public.group_chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_chat_id, user_id)
);

create table if not exists public.group_messages (
  id bigint generated always as identity primary key,
  group_chat_id uuid not null references public.group_chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  edited_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_message_reactions (
  message_id bigint not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- User-level chat controls
create table if not exists public.chat_blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  constraint chat_blocks_not_self check (user_id <> blocked_user_id)
);

create table if not exists public.chat_hidden_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_kind text not null check (chat_kind in ('direct', 'group')),
  chat_id text not null,
  message_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, chat_kind, chat_id, message_id)
);

create table if not exists public.starred_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_kind text not null check (chat_kind in ('direct', 'group')),
  chat_id text not null,
  message_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, chat_kind, chat_id, message_id)
);

create table if not exists public.direct_chat_reads (
  chat_id uuid not null references public.direct_chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.chat_archives (
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_kind text not null check (chat_kind in ('direct', 'group', 'channel')),
  chat_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, chat_kind, chat_id)
);

create table if not exists public.chat_user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_kind text not null check (chat_kind in ('direct', 'group', 'channel')),
  chat_id text not null,
  muted_until timestamptz null,
  notifications_enabled boolean not null default true,
  sounds_enabled boolean not null default true,
  mention_notifications boolean not null default true,
  show_embeds boolean not null default true,
  compact_mode boolean not null default false,
  enter_to_send boolean not null default true,
  read_receipts boolean not null default true,
  pinned boolean not null default false,
  nickname text not null default '',
  theme text not null default 'default' check (theme in ('default', 'midnight', 'forest', 'sunset')),
  extras jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, chat_kind, chat_id)
);

alter table public.chat_user_settings
  add column if not exists extras jsonb not null default '{}'::jsonb;

create table if not exists public.chat_message_blocks (
  id uuid primary key default gen_random_uuid(),
  chat_kind text not null check (chat_kind in ('direct', 'group')),
  chat_id text not null,
  message_id text not null,
  block_kind text not null check (block_kind in ('poll', 'timer', 'checklist', 'progress', 'decision', 'note', 'link')),
  state jsonb not null default '{}'::jsonb,
  expires_at timestamptz null,
  is_saved boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chat_kind, chat_id, message_id)
);

create table if not exists public.chat_typing_presence (
  chat_kind text not null check (chat_kind in ('direct', 'group')),
  chat_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null default 'U',
  is_avatar_image boolean not null default false,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (chat_kind, chat_id, user_id)
);

create table if not exists public.chat_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('direct', 'group')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  group_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_requests_not_self check (from_user_id <> to_user_id)
);

create table if not exists public.chat_call_signals (
  id uuid primary key default gen_random_uuid(),
  chat_kind text not null check (chat_kind in ('direct', 'group')),
  chat_id uuid not null,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice', 'end', 'reject', 'busy')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_chat_members_user_id on public.group_chat_members(user_id);
create index if not exists idx_group_messages_group_chat_id on public.group_messages(group_chat_id, created_at);
create index if not exists idx_direct_messages_chat_id on public.direct_messages(chat_id, created_at);
create index if not exists idx_direct_message_attachments_message_id on public.direct_message_attachments(message_id);
create index if not exists idx_chat_requests_to_user on public.chat_requests(to_user_id, status, created_at);
create index if not exists idx_chat_hidden_messages_lookup on public.chat_hidden_messages(user_id, chat_kind, chat_id);
create index if not exists idx_starred_messages_lookup on public.starred_messages(user_id, chat_kind, chat_id);
create index if not exists idx_direct_chat_reads_chat on public.direct_chat_reads(chat_id, user_id);
create index if not exists idx_chat_archives_lookup on public.chat_archives(user_id, chat_kind, chat_id);
create index if not exists idx_chat_user_settings_lookup on public.chat_user_settings(user_id, chat_kind, chat_id);
create index if not exists idx_chat_message_blocks_lookup on public.chat_message_blocks(chat_kind, chat_id, message_id);
create index if not exists idx_chat_message_blocks_expiry on public.chat_message_blocks(chat_kind, chat_id, expires_at) where is_saved = false;
create index if not exists idx_chat_typing_presence_lookup on public.chat_typing_presence(chat_kind, chat_id, expires_at);
create index if not exists idx_chat_call_signals_lookup on public.chat_call_signals(to_user_id, created_at);

do $$
declare
  t text;
  targets text[] := array[
    'direct_chats',
    'direct_messages',
    'direct_message_reactions',
    'direct_message_attachments',
    'group_chats',
    'group_chat_members',
    'group_messages',
    'group_message_reactions',
    'chat_requests',
    'chat_call_signals',
    'chat_blocks',
    'chat_message_blocks',
    'chat_typing_presence',
    'direct_chat_reads',
    'chat_archives'
  ];
begin
  foreach t in array targets loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_group_chat_member(p_group_chat_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_chat_members gm
    where gm.group_chat_id = p_group_chat_id
      and gm.user_id = p_user_id
  );
$$;

create or replace function public.is_direct_chat_member(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.direct_chats d
    where d.id = p_chat_id
      and (d.user_a = p_user_id or d.user_b = p_user_id)
  );
$$;

create or replace function public.cleanup_expired_chat_message_blocks()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint := 0;
begin
  delete from public.chat_message_blocks
  where is_saved = false
    and expires_at is not null
    and expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

drop trigger if exists trg_chat_requests_updated_at on public.chat_requests;
create trigger trg_chat_requests_updated_at
before update on public.chat_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_chat_user_settings_updated_at on public.chat_user_settings;
create trigger trg_chat_user_settings_updated_at
before update on public.chat_user_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_chat_message_blocks_updated_at on public.chat_message_blocks;
create trigger trg_chat_message_blocks_updated_at
before update on public.chat_message_blocks
for each row execute function public.set_updated_at();

alter table public.group_chats enable row level security;
alter table public.direct_chats enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_reactions enable row level security;
alter table public.direct_message_attachments enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_message_reactions enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_hidden_messages enable row level security;
alter table public.starred_messages enable row level security;
alter table public.direct_chat_reads enable row level security;
alter table public.chat_archives enable row level security;
alter table public.chat_user_settings enable row level security;
alter table public.chat_message_blocks enable row level security;
alter table public.chat_typing_presence enable row level security;
alter table public.chat_requests enable row level security;
alter table public.chat_call_signals enable row level security;

-- group_chats policies
drop policy if exists "group_chats_select_member" on public.group_chats;
create policy "group_chats_select_member"
on public.group_chats for select
to authenticated
using (
  exists (
    select 1
    from public.group_chat_members m
    where m.group_chat_id = id and m.user_id = auth.uid()
  )
);

drop policy if exists "group_chats_insert_creator" on public.group_chats;
create policy "group_chats_insert_creator"
on public.group_chats for insert
to authenticated
with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "group_chats_update_owner" on public.group_chats;
create policy "group_chats_update_owner"
on public.group_chats for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "group_chats_delete_owner" on public.group_chats;
create policy "group_chats_delete_owner"
on public.group_chats for delete
to authenticated
using (created_by = auth.uid());

-- direct_chats policies
drop policy if exists "direct_chats_select_member" on public.direct_chats;
create policy "direct_chats_select_member"
on public.direct_chats for select
to authenticated
using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "direct_chats_insert_member" on public.direct_chats;
create policy "direct_chats_insert_member"
on public.direct_chats for insert
to authenticated
with check (
  auth.uid() is not null
  and (user_a = auth.uid() or user_b = auth.uid())
  and user_a <> user_b
);

drop policy if exists "direct_chats_delete_member" on public.direct_chats;
create policy "direct_chats_delete_member"
on public.direct_chats for delete
to authenticated
using (user_a = auth.uid() or user_b = auth.uid());

-- direct_messages policies
drop policy if exists "direct_messages_select_member" on public.direct_messages;
create policy "direct_messages_select_member"
on public.direct_messages for select
to authenticated
using (public.is_direct_chat_member(chat_id, auth.uid()));

drop policy if exists "direct_messages_insert_sender_member" on public.direct_messages;
create policy "direct_messages_insert_sender_member"
on public.direct_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_direct_chat_member(chat_id, auth.uid())
  and not exists (
    select 1
    from public.direct_chats d
    join public.chat_blocks b
      on (
        (b.user_id = auth.uid() and (b.blocked_user_id = d.user_a or b.blocked_user_id = d.user_b))
        or
        (b.blocked_user_id = auth.uid() and (b.user_id = d.user_a or b.user_id = d.user_b))
      )
    where d.id = chat_id
      and (d.user_a = auth.uid() or d.user_b = auth.uid())
  )
);

drop policy if exists "direct_messages_update_sender" on public.direct_messages;
create policy "direct_messages_update_sender"
on public.direct_messages for update
to authenticated
using (
  sender_id = auth.uid()
  and public.is_direct_chat_member(chat_id, auth.uid())
)
with check (
  sender_id = auth.uid()
  and public.is_direct_chat_member(chat_id, auth.uid())
);

drop policy if exists "direct_messages_delete_sender" on public.direct_messages;
create policy "direct_messages_delete_sender"
on public.direct_messages for delete
to authenticated
using (
  sender_id = auth.uid()
  and public.is_direct_chat_member(chat_id, auth.uid())
);

-- direct_message_reactions policies
drop policy if exists "direct_message_reactions_select_member" on public.direct_message_reactions;
create policy "direct_message_reactions_select_member"
on public.direct_message_reactions for select
to authenticated
using (
  exists (
    select 1
    from public.direct_messages dm
    where dm.id = message_id
      and public.is_direct_chat_member(dm.chat_id, auth.uid())
  )
);

drop policy if exists "direct_message_reactions_insert_self" on public.direct_message_reactions;
create policy "direct_message_reactions_insert_self"
on public.direct_message_reactions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.direct_messages dm
    where dm.id = message_id
      and public.is_direct_chat_member(dm.chat_id, auth.uid())
  )
);

drop policy if exists "direct_message_reactions_delete_self" on public.direct_message_reactions;
create policy "direct_message_reactions_delete_self"
on public.direct_message_reactions for delete
to authenticated
using (user_id = auth.uid());

-- direct_message_attachments policies
drop policy if exists "direct_message_attachments_select_member" on public.direct_message_attachments;
create policy "direct_message_attachments_select_member"
on public.direct_message_attachments for select
to authenticated
using (
  exists (
    select 1
    from public.direct_messages dm
    where dm.id = message_id
      and public.is_direct_chat_member(dm.chat_id, auth.uid())
  )
);

drop policy if exists "direct_message_attachments_insert_self_member" on public.direct_message_attachments;
create policy "direct_message_attachments_insert_self_member"
on public.direct_message_attachments for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1
    from public.direct_messages dm
    where dm.id = message_id
      and public.is_direct_chat_member(dm.chat_id, auth.uid())
  )
);

drop policy if exists "direct_message_attachments_delete_self" on public.direct_message_attachments;
create policy "direct_message_attachments_delete_self"
on public.direct_message_attachments for delete
to authenticated
using (uploader_id = auth.uid());

-- group_chat_members policies
drop policy if exists "group_members_select_group_member" on public.group_chat_members;
create policy "group_members_select_group_member"
on public.group_chat_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_group_chat_member(group_chat_id, auth.uid())
);

drop policy if exists "group_members_insert_owner_or_self" on public.group_chat_members;
create policy "group_members_insert_owner_or_self"
on public.group_chat_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.group_chats g
    where g.id = group_chat_id and g.created_by = auth.uid()
  )
);

drop policy if exists "group_members_delete_owner_or_self" on public.group_chat_members;
create policy "group_members_delete_owner_or_self"
on public.group_chat_members for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.group_chats g
    where g.id = group_chat_id and g.created_by = auth.uid()
  )
);

-- group_messages policies
drop policy if exists "group_messages_select_member" on public.group_messages;
create policy "group_messages_select_member"
on public.group_messages for select
to authenticated
using (
  exists (
    select 1 from public.group_chat_members m
    where m.group_chat_id = group_chat_id and m.user_id = auth.uid()
  )
);

drop policy if exists "group_messages_insert_sender_member" on public.group_messages;
create policy "group_messages_insert_sender_member"
on public.group_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.group_chat_members m
    where m.group_chat_id = group_chat_id and m.user_id = auth.uid()
  )
);

drop policy if exists "group_messages_update_sender" on public.group_messages;
create policy "group_messages_update_sender"
on public.group_messages for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

drop policy if exists "group_messages_delete_sender" on public.group_messages;
create policy "group_messages_delete_sender"
on public.group_messages for delete
to authenticated
using (sender_id = auth.uid());

-- group_message_reactions policies
drop policy if exists "group_message_reactions_select_member" on public.group_message_reactions;
create policy "group_message_reactions_select_member"
on public.group_message_reactions for select
to authenticated
using (
  exists (
    select 1
    from public.group_messages gm
    join public.group_chat_members m on m.group_chat_id = gm.group_chat_id
    where gm.id = message_id and m.user_id = auth.uid()
  )
);

drop policy if exists "group_message_reactions_insert_self" on public.group_message_reactions;
create policy "group_message_reactions_insert_self"
on public.group_message_reactions for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.group_messages gm
    join public.group_chat_members m on m.group_chat_id = gm.group_chat_id
    where gm.id = message_id and m.user_id = auth.uid()
  )
);

drop policy if exists "group_message_reactions_delete_self" on public.group_message_reactions;
create policy "group_message_reactions_delete_self"
on public.group_message_reactions for delete
to authenticated
using (user_id = auth.uid());

-- chat_blocks policies
drop policy if exists "chat_blocks_select_own" on public.chat_blocks;
create policy "chat_blocks_select_own"
on public.chat_blocks for select
to authenticated
using (user_id = auth.uid() or blocked_user_id = auth.uid());

drop policy if exists "chat_blocks_insert_own" on public.chat_blocks;
create policy "chat_blocks_insert_own"
on public.chat_blocks for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "chat_blocks_delete_own" on public.chat_blocks;
create policy "chat_blocks_delete_own"
on public.chat_blocks for delete
to authenticated
using (user_id = auth.uid());

-- chat_message_blocks policies
drop policy if exists "chat_message_blocks_select_member" on public.chat_message_blocks;
create policy "chat_message_blocks_select_member"
on public.chat_message_blocks for select
to authenticated
using (
  (
    chat_kind = 'direct'
    and public.is_direct_chat_member(chat_id::uuid, auth.uid())
  )
  or (
    chat_kind = 'group'
    and public.is_group_chat_member(chat_id::uuid, auth.uid())
  )
);

drop policy if exists "chat_message_blocks_insert_member" on public.chat_message_blocks;
create policy "chat_message_blocks_insert_member"
on public.chat_message_blocks for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    (chat_kind = 'direct' and public.is_direct_chat_member(chat_id::uuid, auth.uid()))
    or
    (chat_kind = 'group' and public.is_group_chat_member(chat_id::uuid, auth.uid()))
  )
);

drop policy if exists "chat_message_blocks_update_member" on public.chat_message_blocks;
create policy "chat_message_blocks_update_member"
on public.chat_message_blocks for update
to authenticated
using (
  (
    chat_kind = 'direct'
    and public.is_direct_chat_member(chat_id::uuid, auth.uid())
  )
  or (
    chat_kind = 'group'
    and public.is_group_chat_member(chat_id::uuid, auth.uid())
  )
)
with check (
  (
    chat_kind = 'direct'
    and public.is_direct_chat_member(chat_id::uuid, auth.uid())
  )
  or (
    chat_kind = 'group'
    and public.is_group_chat_member(chat_id::uuid, auth.uid())
  )
);

drop policy if exists "chat_message_blocks_delete_member" on public.chat_message_blocks;
create policy "chat_message_blocks_delete_member"
on public.chat_message_blocks for delete
to authenticated
using (
  (
    chat_kind = 'direct'
    and public.is_direct_chat_member(chat_id::uuid, auth.uid())
  )
  or (
    chat_kind = 'group'
    and public.is_group_chat_member(chat_id::uuid, auth.uid())
  )
);

-- chat_hidden_messages policies
drop policy if exists "chat_hidden_messages_select_own" on public.chat_hidden_messages;
create policy "chat_hidden_messages_select_own"
on public.chat_hidden_messages for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "chat_hidden_messages_insert_own" on public.chat_hidden_messages;
create policy "chat_hidden_messages_insert_own"
on public.chat_hidden_messages for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "chat_hidden_messages_delete_own" on public.chat_hidden_messages;
create policy "chat_hidden_messages_delete_own"
on public.chat_hidden_messages for delete
to authenticated
using (user_id = auth.uid());

-- starred_messages policies
drop policy if exists "starred_messages_select_own" on public.starred_messages;
create policy "starred_messages_select_own"
on public.starred_messages for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "starred_messages_insert_own" on public.starred_messages;
create policy "starred_messages_insert_own"
on public.starred_messages for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "starred_messages_delete_own" on public.starred_messages;
create policy "starred_messages_delete_own"
on public.starred_messages for delete
to authenticated
using (user_id = auth.uid());

-- direct_chat_reads policies
drop policy if exists "direct_chat_reads_select_member" on public.direct_chat_reads;
create policy "direct_chat_reads_select_member"
on public.direct_chat_reads for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.direct_chats d
    where d.id = chat_id and (d.user_a = auth.uid() or d.user_b = auth.uid())
  )
);

drop policy if exists "direct_chat_reads_insert_own_member" on public.direct_chat_reads;
create policy "direct_chat_reads_insert_own_member"
on public.direct_chat_reads for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.direct_chats d
    where d.id = chat_id and (d.user_a = auth.uid() or d.user_b = auth.uid())
  )
);

drop policy if exists "direct_chat_reads_update_own_member" on public.direct_chat_reads;
create policy "direct_chat_reads_update_own_member"
on public.direct_chat_reads for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.direct_chats d
    where d.id = chat_id and (d.user_a = auth.uid() or d.user_b = auth.uid())
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.direct_chats d
    where d.id = chat_id and (d.user_a = auth.uid() or d.user_b = auth.uid())
  )
);

-- chat_archives policies
drop policy if exists "chat_archives_select_own" on public.chat_archives;
create policy "chat_archives_select_own"
on public.chat_archives for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "chat_archives_insert_own" on public.chat_archives;
create policy "chat_archives_insert_own"
on public.chat_archives for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "chat_archives_delete_own" on public.chat_archives;
create policy "chat_archives_delete_own"
on public.chat_archives for delete
to authenticated
using (user_id = auth.uid());

-- chat_user_settings policies
drop policy if exists "chat_user_settings_select_own" on public.chat_user_settings;
create policy "chat_user_settings_select_own"
on public.chat_user_settings for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "chat_user_settings_insert_own" on public.chat_user_settings;
create policy "chat_user_settings_insert_own"
on public.chat_user_settings for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "chat_user_settings_update_own" on public.chat_user_settings;
create policy "chat_user_settings_update_own"
on public.chat_user_settings for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- chat_typing_presence policies
drop policy if exists "chat_typing_presence_select_participant" on public.chat_typing_presence;
create policy "chat_typing_presence_select_participant"
on public.chat_typing_presence for select
to authenticated
using (
  user_id = auth.uid()
  or (
    chat_kind = 'direct'
    and public.is_direct_chat_member(chat_id::uuid, auth.uid())
  )
  or (
    chat_kind = 'group'
    and public.is_group_chat_member(chat_id::uuid, auth.uid())
  )
);

drop policy if exists "chat_typing_presence_insert_self_participant" on public.chat_typing_presence;
create policy "chat_typing_presence_insert_self_participant"
on public.chat_typing_presence for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    (chat_kind = 'direct' and public.is_direct_chat_member(chat_id::uuid, auth.uid()))
    or (chat_kind = 'group' and public.is_group_chat_member(chat_id::uuid, auth.uid()))
  )
);

drop policy if exists "chat_typing_presence_update_self_participant" on public.chat_typing_presence;
create policy "chat_typing_presence_update_self_participant"
on public.chat_typing_presence for update
to authenticated
using (
  user_id = auth.uid()
  and (
    (chat_kind = 'direct' and public.is_direct_chat_member(chat_id::uuid, auth.uid()))
    or (chat_kind = 'group' and public.is_group_chat_member(chat_id::uuid, auth.uid()))
  )
)
with check (
  user_id = auth.uid()
  and (
    (chat_kind = 'direct' and public.is_direct_chat_member(chat_id::uuid, auth.uid()))
    or (chat_kind = 'group' and public.is_group_chat_member(chat_id::uuid, auth.uid()))
  )
);

drop policy if exists "chat_typing_presence_delete_self" on public.chat_typing_presence;
create policy "chat_typing_presence_delete_self"
on public.chat_typing_presence for delete
to authenticated
using (user_id = auth.uid());

-- chat_requests policies
drop policy if exists "chat_requests_select_participant" on public.chat_requests;
create policy "chat_requests_select_participant"
on public.chat_requests for select
to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid());

drop policy if exists "chat_requests_insert_sender" on public.chat_requests;
create policy "chat_requests_insert_sender"
on public.chat_requests for insert
to authenticated
with check (from_user_id = auth.uid());

drop policy if exists "chat_requests_update_recipient" on public.chat_requests;
create policy "chat_requests_update_recipient"
on public.chat_requests for update
to authenticated
using (to_user_id = auth.uid())
with check (to_user_id = auth.uid());

-- chat_call_signals policies
drop policy if exists "chat_call_signals_select_participant" on public.chat_call_signals;
create policy "chat_call_signals_select_participant"
on public.chat_call_signals for select
to authenticated
using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
);

drop policy if exists "chat_call_signals_insert_sender" on public.chat_call_signals;
create policy "chat_call_signals_insert_sender"
on public.chat_call_signals for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and (
    (chat_kind = 'direct' and public.is_direct_chat_member(chat_id, auth.uid()))
    or (chat_kind = 'group' and public.is_group_chat_member(chat_id, auth.uid()))
  )
);
