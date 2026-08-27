-- BetterIG shared leaderboard and server-authoritative scoring.
-- Run this once in Supabase SQL Editor, or deploy it with the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{2,18}$'),
  avatar_url text,
  score bigint not null default 0 check (score >= 0),
  lifetime_scrolls bigint not null default 0 check (lifetime_scrolls >= 0),
  last_reel_id text,
  last_scroll_at timestamptz,
  next_roulette_at bigint not null default 40,
  next_market_at bigint not null default 100,
  pending_game text check (pending_game in ('roulette', 'market') or pending_game is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_score_idx on public.profiles (score desc, created_at asc);

create table if not exists public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  reel_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);

create table if not exists public.scroll_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_reel_id text not null,
  to_reel_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists scroll_events_user_created_idx on public.scroll_events (user_id, created_at desc);

create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_type text not null check (game_type in ('roulette', 'market')),
  choice text not null,
  outcome text not null,
  stake bigint not null check (stake >= 0),
  payout bigint not null check (payout >= 0),
  won boolean not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.likes enable row level security;
alter table public.scroll_events enable row level security;
alter table public.game_rounds enable row level security;

drop policy if exists "Public leaderboard fields" on public.profiles;
create policy "Public leaderboard fields" on public.profiles for select using (true);
drop policy if exists "Users read own likes" on public.likes;
create policy "Users read own likes" on public.likes for select using (auth.uid() = user_id);

revoke all on public.profiles, public.likes, public.scroll_events, public.game_rounds from anon, authenticated;
grant select (user_id, username, avatar_url, score) on public.profiles to anon, authenticated;
grant select on public.likes to authenticated;

create or replace function public.get_my_state()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'score', p.score,
    'total_scrolls', p.lifetime_scrolls,
    'next_roulette_at', p.next_roulette_at,
    'next_market_at', p.next_market_at,
    'pending_game', p.pending_game,
    'liked_reels', coalesce((select jsonb_agg(l.reel_id order by l.created_at) from public.likes l where l.user_id = p.user_id), '[]'::jsonb)
  )
  from public.profiles p
  where p.user_id = auth.uid();
$$;

create or replace function public.claim_username(p_username text, p_avatar_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{2,18}$' then
    raise exception 'Username must be 2-18 letters, numbers, or underscores';
  end if;

  insert into public.profiles (user_id, username, avatar_url, next_roulette_at)
  values (v_user_id, p_username, nullif(p_avatar_url, ''), 40 + floor(random() * 21)::bigint)
  on conflict (user_id) do update
    set username = excluded.username,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return public.get_my_state();
exception when unique_violation then
  raise exception 'That username is already taken';
end;
$$;

create or replace function public.begin_feed(p_reel_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reel_id is null or length(p_reel_id) > 80 then raise exception 'Invalid reel'; end if;
  update public.profiles
  set last_reel_id = p_reel_id, last_scroll_at = now(), updated_at = now()
  where user_id = auth.uid();
  return public.get_my_state();
end;
$$;

create or replace function public.record_scroll(
  p_event_id uuid,
  p_from_reel_id text,
  p_to_reel_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_total bigint;
  v_pending text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_event_id is null or p_from_reel_id is null or p_to_reel_id is null
     or p_from_reel_id = p_to_reel_id or length(p_to_reel_id) > 80 then
    raise exception 'Invalid scroll';
  end if;

  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'Create a profile first'; end if;
  if v_profile.pending_game is not null then raise exception 'Complete the bonus round first'; end if;
  if v_profile.last_reel_id is distinct from p_from_reel_id then raise exception 'Scroll sequence mismatch'; end if;
  if v_profile.last_scroll_at is not null and now() - v_profile.last_scroll_at < interval '500 milliseconds' then
    raise exception 'Scroll was too fast';
  end if;

  insert into public.scroll_events (event_id, user_id, from_reel_id, to_reel_id)
  values (p_event_id, auth.uid(), p_from_reel_id, p_to_reel_id)
  on conflict (event_id) do nothing;
  if not found then return public.get_my_state(); end if;

  v_total := v_profile.lifetime_scrolls + 1;
  v_pending := null;
  if v_total >= v_profile.next_market_at then
    v_pending := 'market';
  elsif v_total >= v_profile.next_roulette_at then
    v_pending := 'roulette';
  end if;

  update public.profiles
  set score = score + 1,
      lifetime_scrolls = v_total,
      last_reel_id = p_to_reel_id,
      last_scroll_at = now(),
      pending_game = v_pending,
      updated_at = now()
  where user_id = auth.uid();

  return public.get_my_state();
end;
$$;

create or replace function public.set_reel_like(p_reel_id text, p_liked boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_reel_id is null or length(p_reel_id) > 80 then raise exception 'Invalid reel'; end if;
  if p_liked then
    insert into public.likes (user_id, reel_id) values (auth.uid(), p_reel_id) on conflict do nothing;
  else
    delete from public.likes where user_id = auth.uid() and reel_id = p_reel_id;
  end if;
  return public.get_my_state();
end;
$$;

create or replace function public.resolve_roulette(p_bet text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_segments text[] := array['green','red','black','red','black','red','black','green','red','black','red','black','red','black'];
  v_index integer;
  v_outcome text;
  v_wager bigint;
  v_multiplier integer;
  v_payout bigint;
  v_win boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_bet not in ('red', 'black', 'green') then raise exception 'Invalid roulette bet'; end if;
  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  if v_profile.pending_game is distinct from 'roulette' then raise exception 'No roulette round is due'; end if;

  v_index := floor(random() * 14)::integer;
  v_outcome := v_segments[v_index + 1];
  v_wager := v_profile.score;
  v_multiplier := case when p_bet = 'green' then 7 else 2 end;
  v_win := v_outcome = p_bet;
  v_payout := case when v_win then v_wager * v_multiplier else 0 end;

  update public.profiles
  set score = v_payout,
      pending_game = null,
      next_roulette_at = lifetime_scrolls + 40 + floor(random() * 21)::bigint,
      updated_at = now()
  where user_id = auth.uid();
  insert into public.game_rounds (user_id, game_type, choice, outcome, stake, payout, won)
  values (auth.uid(), 'roulette', p_bet, v_outcome, v_wager, v_payout, v_win);

  return jsonb_build_object(
    'bet', p_bet, 'wager', v_wager, 'outcome', v_outcome,
    'outcome_index', v_index, 'win', v_win, 'payout', v_payout,
    'state', public.get_my_state()
  );
end;
$$;

create or replace function public.resolve_market(p_prediction text, p_stake_ratio numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_outcome text;
  v_stake bigint;
  v_win boolean;
  v_winnings bigint;
  v_final bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_prediction not in ('up', 'down') or p_stake_ratio not in (0.25, 0.5, 1) then raise exception 'Invalid market bet'; end if;
  select * into v_profile from public.profiles where user_id = auth.uid() for update;
  if v_profile.pending_game is distinct from 'market' then raise exception 'No market round is due'; end if;

  v_outcome := case when random() < 0.5 then 'up' else 'down' end;
  v_stake := case when v_profile.score = 0 then 0 else greatest(1, floor(v_profile.score * p_stake_ratio)::bigint) end;
  v_win := v_outcome = p_prediction;
  v_winnings := case when v_win then v_stake * 2 else 0 end;
  v_final := v_profile.score - v_stake + v_winnings;

  update public.profiles
  set score = v_final,
      pending_game = null,
      next_market_at = (floor(lifetime_scrolls / 100) + 1) * 100,
      updated_at = now()
  where user_id = auth.uid();
  insert into public.game_rounds (user_id, game_type, choice, outcome, stake, payout, won)
  values (auth.uid(), 'market', p_prediction, v_outcome, v_stake, v_winnings, v_win);

  return jsonb_build_object(
    'prediction', p_prediction, 'stake_ratio', p_stake_ratio, 'stake', v_stake,
    'outcome', v_outcome, 'win', v_win, 'winnings', v_winnings,
    'final_score', v_final, 'state', public.get_my_state()
  );
end;
$$;

revoke all on function public.get_my_state() from public;
revoke all on function public.claim_username(text, text) from public;
revoke all on function public.begin_feed(text) from public;
revoke all on function public.record_scroll(uuid, text, text) from public;
revoke all on function public.set_reel_like(text, boolean) from public;
revoke all on function public.resolve_roulette(text) from public;
revoke all on function public.resolve_market(text, numeric) from public;
grant execute on function public.get_my_state() to authenticated;
grant execute on function public.claim_username(text, text) to authenticated;
grant execute on function public.begin_feed(text) to authenticated;
grant execute on function public.record_scroll(uuid, text, text) to authenticated;
grant execute on function public.set_reel_like(text, boolean) to authenticated;
grant execute on function public.resolve_roulette(text) to authenticated;
grant execute on function public.resolve_market(text, numeric) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
