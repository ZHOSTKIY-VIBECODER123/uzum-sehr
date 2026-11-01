-- Uzum sehr: схема, права и серверная логика.
-- Клиент не работает с таблицами напрямую: всё идёт через RPC-функции ниже.

create schema if not exists app_private;

create type public.wish_status as enum ('free', 'booked', 'fulfilled');
create type public.booking_state as enum ('active', 'fulfilled', 'released', 'expired');
create type public.admin_role as enum ('super_admin', 'admin');

-- ---------------------------------------------------------------- таблицы

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  slack text,
  phone text,
  created_at timestamptz not null default now()
);

-- Роль привязана к почте, поэтому первого администратора можно назначить до его первого входа.
create table public.admins (
  email text primary key check (email = lower(email)),
  role public.admin_role not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  ward_id text not null unique check (length(trim(ward_id)) > 0),
  bulb_no integer not null unique check (bulb_no > 0),
  public_name text not null check (length(trim(public_name)) > 0),
  age integer not null check (age between 0 and 21),
  city text,
  wish_title text not null check (length(trim(wish_title)) > 0),
  description text not null default '',
  photo_path text,
  photo_public boolean not null default false,
  status public.wish_status not null default 'free',
  hidden boolean not null default false,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wish_media (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes (id) on delete cascade,
  path text not null,
  title text,
  mime_type text,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index wish_media_wish_idx on public.wish_media (wish_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  state public.booking_state not null default 'active',
  booked_at timestamptz not null default now(),
  expires_at timestamptz,
  fulfilled_at timestamptz,
  released_at timestamptz,
  release_reason text
);
-- Последняя линия защиты от двойного бронирования: на желание только одна живая бронь.
create unique index bookings_one_live_per_wish on public.bookings (wish_id)
  where state in ('active', 'fulfilled');
create index bookings_user_idx on public.bookings (user_id);
create index bookings_overdue_idx on public.bookings (expires_at) where state = 'active';

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  slack_handle text not null check (length(trim(slack_handle)) > 0),
  label text not null default '',
  slack_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'
);
create index audit_log_at_idx on public.audit_log (at desc);

-- Строка без личных данных. Realtime сообщает только «что-то изменилось», данные клиент запрашивает сам.
create table public.site_pulse (
  id integer primary key default 1 check (id = 1),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.site_pulse (id) values (1);

-- --------------------------------------------------------------- доступы

alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.wishes enable row level security;
alter table public.wish_media enable row level security;
alter table public.bookings enable row level security;
alter table public.settings enable row level security;
alter table public.contacts enable row level security;
alter table public.audit_log enable row level security;
alter table public.site_pulse enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.site_pulse to anon, authenticated;
create policy site_pulse_read on public.site_pulse for select to anon, authenticated using (true);

revoke all on schema app_private from public, anon, authenticated;

-- ------------------------------------------------------- служебные функции

create function public.current_admin_role() returns public.admin_role
language sql stable security definer set search_path = public, auth as $$
  select a.role
  from public.admins a
  join auth.users u on lower(u.email) = a.email
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select public.current_admin_role() is not null
$$;

create function app_private.require_admin(p_super boolean default false) returns public.admin_role
language plpgsql stable security definer set search_path = public, auth as $$
declare v_role public.admin_role := public.current_admin_role();
begin
  if v_role is null or (p_super and v_role <> 'super_admin') then
    raise exception 'forbidden';
  end if;
  return v_role;
end $$;

create function app_private.log(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public, auth as $$
  insert into public.audit_log (actor_email, action, entity, entity_id, details)
  values ((select email from auth.users where id = auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'));
$$;

create function app_private.setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.settings where key = p_key
$$;

create function app_private.bump_pulse() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.site_pulse set version = version + 1, updated_at = now() where id = 1;
  return null;
end $$;

create trigger wishes_pulse after insert or update or delete on public.wishes
  for each statement execute function app_private.bump_pulse();
create trigger settings_pulse after insert or update or delete on public.settings
  for each statement execute function app_private.bump_pulse();
create trigger contacts_pulse after insert or update or delete on public.contacts
  for each statement execute function app_private.bump_pulse();

create function app_private.touch_wish() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger wishes_touch before update on public.wishes
  for each row execute function app_private.touch_wish();

-- Назначает новому желанию первую свободную лампочку.
create function app_private.assign_bulb() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bulb_no is null then
    perform pg_advisory_xact_lock(7316001);
    select min(n) into new.bulb_no
    from generate_series(1, (select count(*) + 1 from public.wishes)::integer) n
    where not exists (select 1 from public.wishes w where w.bulb_no = n);
  end if;
  return new;
end $$;
create trigger wishes_assign_bulb before insert on public.wishes
  for each row execute function app_private.assign_bulb();

create function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
create trigger on_auth_user_created after insert or update of email on auth.users
  for each row execute function app_private.handle_new_user();

-- Просроченные брони снимаются при обращении к сайту, поэтому pg_cron не нужен.
create function app_private.expire_overdue() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not exists (select 1 from public.bookings where state = 'active' and expires_at < now()) then
    return;
  end if;
  for r in
    select id, wish_id from public.bookings
    where state = 'active' and expires_at < now()
    for update skip locked
  loop
    update public.bookings
      set state = 'expired', released_at = now(), release_reason = 'Истёк срок бронирования'
      where id = r.id;
    update public.wishes set status = 'free' where id = r.wish_id and status = 'booked';
    perform app_private.log('booking.expired', 'wish', r.wish_id::text, jsonb_build_object('booking_id', r.id));
  end loop;
end $$;

create function app_private.tree_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (
    select
      count(*)::integer as total,
      (count(*) filter (where status = 'free'))::integer as free,
      (count(*) filter (where status = 'booked'))::integer as booked,
      (count(*) filter (where status = 'fulfilled'))::integer as fulfilled
    from public.wishes where not hidden
  ), t as (
    select greatest(coalesce((app_private.setting('tree') ->> 'target_wishes')::integer, 150), (select total from c), 1) as target
  )
  select jsonb_build_object(
    'target', t.target,
    'total', c.total,
    'free', c.free,
    'booked', c.booked,
    'fulfilled', c.fulfilled,
    'lit', c.booked + c.fulfilled,
    'remaining', greatest(t.target - c.booked - c.fulfilled, 0)
  ) from c, t
$$;

-- ------------------------------------------------------- публичные функции

create function public.get_tree() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_tree jsonb;
begin
  perform app_private.expire_overdue();
  v_tree := app_private.setting('tree');
  return jsonb_build_object(
    'bulbs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'no', w.bulb_no,
        'ward_id', w.ward_id,
        'name', w.public_name,
        'age', w.age,
        'status', w.status,
        'mine', exists (
          select 1 from public.bookings b
          where b.wish_id = w.id and b.user_id = auth.uid() and b.state in ('active', 'fulfilled')
        )
      ) order by w.bulb_no)
      from public.wishes w where not w.hidden
    ), '[]'::jsonb),
    'stats', app_private.tree_stats(),
    'paused', coalesce((v_tree ->> 'booking_paused')::boolean, false),
    'pause_message', v_tree ->> 'pause_message'
  );
end $$;

create function public.get_public_content() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'settings', coalesce((select jsonb_object_agg(key, value) from public.settings), '{}'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'slack_handle', slack_handle, 'label', label, 'slack_url', slack_url, 'sort_order', sort_order
      ) order by sort_order, created_at)
      from public.contacts
    ), '[]'::jsonb)
  )
$$;

create function public.get_wish(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'id', w.id,
    'no', w.bulb_no,
    'ward_id', w.ward_id,
    'name', w.public_name,
    'age', w.age,
    'city', w.city,
    'wish_title', w.wish_title,
    'description', w.description,
    'status', w.status,
    'photo_path', case when w.photo_public then w.photo_path end,
    'mine', exists (
      select 1 from public.bookings b
      where b.wish_id = w.id and b.user_id = auth.uid() and b.state in ('active', 'fulfilled')
    ),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.path, 'title', m.title, 'mime_type', m.mime_type)
        order by m.sort_order, m.created_at)
      from public.wish_media m where m.wish_id = w.id and m.is_public
    ), '[]'::jsonb)
  ) into v
  from public.wishes w
  where w.id = p_id and not w.hidden;

  if v is null then
    raise exception 'wish_not_found';
  end if;
  return v;
end $$;

-- Атомарное бронирование: условный UPDATE пропустит только один из параллельных запросов.
create function public.book_wish(p_wish_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_tree jsonb;
  v_hours integer;
  v_limit integer;
  v_expires timestamptz;
  v_wish public.wishes;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  perform app_private.expire_overdue();

  v_tree := app_private.setting('tree');
  if coalesce((v_tree ->> 'booking_paused')::boolean, false) then
    raise exception 'booking_paused';
  end if;

  -- Лимит считаем под блокировкой пользователя, иначе параллельные запросы могут его обойти.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 7316002));
  v_limit := coalesce((v_tree ->> 'max_bookings_per_user')::integer, 0);
  if v_limit > 0 and (
    select count(*) from public.bookings where user_id = v_uid and state = 'active'
  ) >= v_limit then
    raise exception 'booking_limit';
  end if;

  update public.wishes set status = 'booked'
    where id = p_wish_id and status = 'free' and not hidden
    returning * into v_wish;
  if v_wish.id is null then
    raise exception 'wish_unavailable';
  end if;

  v_hours := coalesce((v_tree ->> 'booking_hours')::integer, 0);
  if v_hours > 0 then
    v_expires := now() + make_interval(hours => v_hours);
  end if;

  insert into public.bookings (wish_id, user_id, expires_at)
    values (v_wish.id, v_uid, v_expires)
    returning * into v_booking;

  perform app_private.log('booking.created', 'wish', v_wish.id::text,
    jsonb_build_object('ward_id', v_wish.ward_id, 'booking_id', v_booking.id));

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'wish_id', v_wish.id,
    'ward_id', v_wish.ward_id,
    'no', v_wish.bulb_no,
    'booked_at', v_booking.booked_at,
    'expires_at', v_booking.expires_at
  );
end $$;

create function public.my_bookings() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  perform app_private.expire_overdue();
  return jsonb_build_object(
    'profile', (
      select jsonb_build_object('email', p.email, 'display_name', p.display_name, 'slack', p.slack, 'phone', p.phone)
      from public.profiles p where p.id = auth.uid()
    ),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'booking_id', b.id,
        'state', b.state,
        'booked_at', b.booked_at,
        'expires_at', b.expires_at,
        'fulfilled_at', b.fulfilled_at,
        'wish_id', w.id,
        'no', w.bulb_no,
        'ward_id', w.ward_id,
        'name', w.public_name,
        'age', w.age,
        'city', w.city,
        'wish_title', w.wish_title,
        'description', w.description,
        'status', w.status,
        'photo_path', case when w.photo_public then w.photo_path end,
        'media', coalesce((
          select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.path, 'title', m.title, 'mime_type', m.mime_type)
            order by m.sort_order, m.created_at)
          from public.wish_media m where m.wish_id = w.id and m.is_public
        ), '[]'::jsonb)
      ) order by b.booked_at desc)
      from public.bookings b
      join public.wishes w on w.id = b.wish_id
      where b.user_id = auth.uid() and b.state in ('active', 'fulfilled')
    ), '[]'::jsonb)
  );
end $$;

create function public.save_my_profile(p_display_name text, p_slack text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  update public.profiles set
    display_name = nullif(trim(left(p_display_name, 120)), ''),
    slack = nullif(trim(left(p_slack, 80)), ''),
    phone = nullif(trim(left(p_phone, 40)), '')
  where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------- функции администратора

create function public.admin_whoami() returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object('role', public.current_admin_role())
$$;

create function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_target integer;
begin
  perform app_private.require_admin();
  perform app_private.expire_overdue();
  v_target := greatest(coalesce((app_private.setting('tree') ->> 'target_wishes')::integer, 150), 1);
  return (
    select jsonb_build_object(
      'target', v_target,
      'total', count(*),
      'free', count(*) filter (where status = 'free' and not hidden),
      'booked', count(*) filter (where status = 'booked'),
      'fulfilled', count(*) filter (where status = 'fulfilled'),
      'hidden', count(*) filter (where hidden),
      'remaining', greatest(v_target - count(*) filter (where status in ('booked', 'fulfilled')), 0),
      'by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d)
        from (
          select (booked_at at time zone 'Asia/Tashkent')::date as d, count(*) as n
          from public.bookings
          where booked_at > now() - interval '30 days'
          group by 1
        ) s
      ), '[]'::jsonb)
    )
    from public.wishes
  );
end $$;

create function public.admin_list_wishes() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  perform app_private.expire_overdue();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id,
      'no', w.bulb_no,
      'ward_id', w.ward_id,
      'name', w.public_name,
      'age', w.age,
      'city', w.city,
      'wish_title', w.wish_title,
      'description', w.description,
      'status', w.status,
      'hidden', w.hidden,
      'photo_path', w.photo_path,
      'photo_public', w.photo_public,
      'admin_note', w.admin_note,
      'booked_by', p.email,
      'booked_by_name', p.display_name,
      'booked_at', b.booked_at,
      'expires_at', b.expires_at
    ) order by w.bulb_no)
    from public.wishes w
    left join public.bookings b on b.wish_id = w.id and b.state in ('active', 'fulfilled')
    left join public.profiles p on p.id = b.user_id
  ), '[]'::jsonb);
end $$;

create function public.admin_list_media(p_wish_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(m) order by m.sort_order, m.created_at)
    from public.wish_media m where m.wish_id = p_wish_id
  ), '[]'::jsonb);
end $$;

create function public.admin_save_wish(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_row public.wishes;
begin
  perform app_private.require_admin();

  if coalesce(trim(p ->> 'ward_id'), '') = '' or coalesce(trim(p ->> 'public_name'), '') = ''
     or coalesce(trim(p ->> 'wish_title'), '') = '' or (p ->> 'age') is null then
    raise exception 'validation_failed';
  end if;

  begin
    if v_id is null then
      insert into public.wishes (ward_id, public_name, age, city, wish_title, description, photo_path, photo_public, hidden, admin_note)
      values (
        trim(p ->> 'ward_id'), trim(p ->> 'public_name'), (p ->> 'age')::integer, nullif(trim(p ->> 'city'), ''),
        trim(p ->> 'wish_title'), coalesce(p ->> 'description', ''), nullif(p ->> 'photo_path', ''),
        coalesce((p ->> 'photo_public')::boolean, false), coalesce((p ->> 'hidden')::boolean, false), nullif(p ->> 'admin_note', '')
      ) returning * into v_row;
      perform app_private.log('wish.created', 'wish', v_row.id::text, jsonb_build_object('ward_id', v_row.ward_id));
    else
      update public.wishes set
        ward_id = trim(p ->> 'ward_id'),
        public_name = trim(p ->> 'public_name'),
        age = (p ->> 'age')::integer,
        city = nullif(trim(p ->> 'city'), ''),
        wish_title = trim(p ->> 'wish_title'),
        description = coalesce(p ->> 'description', ''),
        photo_path = nullif(p ->> 'photo_path', ''),
        photo_public = coalesce((p ->> 'photo_public')::boolean, false),
        hidden = coalesce((p ->> 'hidden')::boolean, false),
        admin_note = nullif(p ->> 'admin_note', '')
      where id = v_id returning * into v_row;
      if v_row.id is null then
        raise exception 'wish_not_found';
      end if;
      perform app_private.log('wish.updated', 'wish', v_row.id::text, jsonb_build_object('ward_id', v_row.ward_id));
    end if;
  exception
    when unique_violation then raise exception 'ward_id_taken';
    when check_violation then raise exception 'validation_failed';
  end;

  return jsonb_build_object('id', v_row.id, 'no', v_row.bulb_no);
end $$;

-- Возвращает пути файлов, чтобы клиент удалил их из хранилища.
create function public.admin_delete_wish(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_row public.wishes;
  v_paths jsonb;
begin
  perform app_private.require_admin();
  select coalesce(jsonb_agg(path), '[]'::jsonb) into v_paths from public.wish_media where wish_id = p_id;
  delete from public.wishes where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'wish_not_found';
  end if;
  if v_row.photo_path is not null then
    v_paths := v_paths || to_jsonb(v_row.photo_path);
  end if;
  perform app_private.log('wish.deleted', 'wish', v_row.id::text,
    jsonb_build_object('ward_id', v_row.ward_id, 'name', v_row.public_name, 'status', v_row.status));
  return jsonb_build_object('paths', v_paths);
end $$;

create function public.admin_set_status(p_id uuid, p_status public.wish_status, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_wish public.wishes;
  v_booking public.bookings;
begin
  perform app_private.require_admin();

  select * into v_wish from public.wishes where id = p_id for update;
  if v_wish.id is null then
    raise exception 'wish_not_found';
  end if;
  select * into v_booking from public.bookings where wish_id = p_id and state in ('active', 'fulfilled');

  if p_status = 'free' then
    if v_booking.id is not null and coalesce(trim(p_reason), '') = '' then
      raise exception 'reason_required';
    end if;
    update public.bookings
      set state = 'released', released_at = now(), release_reason = trim(p_reason)
      where id = v_booking.id;
  elsif p_status = 'booked' then
    if v_booking.id is null then
      raise exception 'booking_required';
    end if;
    update public.bookings set state = 'active', fulfilled_at = null where id = v_booking.id;
  else
    update public.bookings set state = 'fulfilled', fulfilled_at = now() where id = v_booking.id;
  end if;

  update public.wishes set status = p_status where id = p_id;
  perform app_private.log('wish.status_changed', 'wish', p_id::text, jsonb_build_object(
    'ward_id', v_wish.ward_id, 'from', v_wish.status, 'to', p_status,
    'reason', nullif(trim(p_reason), ''), 'booking_id', v_booking.id));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_set_hidden(p_id uuid, p_hidden boolean) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_ward text;
begin
  perform app_private.require_admin();
  update public.wishes set hidden = p_hidden where id = p_id returning ward_id into v_ward;
  if v_ward is null then
    raise exception 'wish_not_found';
  end if;
  perform app_private.log(case when p_hidden then 'wish.hidden' else 'wish.shown' end, 'wish', p_id::text,
    jsonb_build_object('ward_id', v_ward));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_add_media(p_wish_id uuid, p_path text, p_title text, p_mime text, p_public boolean) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  perform app_private.require_admin();
  insert into public.wish_media (wish_id, path, title, mime_type, is_public, sort_order)
    values (p_wish_id, p_path, p_title, p_mime, coalesce(p_public, false),
      (select coalesce(max(sort_order), 0) + 1 from public.wish_media where wish_id = p_wish_id))
    returning id into v_id;
  perform app_private.log('media.added', 'wish', p_wish_id::text, jsonb_build_object('path', p_path));
  return jsonb_build_object('id', v_id);
end $$;

create function public.admin_remove_media(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_row public.wish_media;
begin
  perform app_private.require_admin();
  delete from public.wish_media where id = p_id returning * into v_row;
  if v_row.id is null then
    raise exception 'media_not_found';
  end if;
  perform app_private.log('media.removed', 'wish', v_row.wish_id::text, jsonb_build_object('path', v_row.path));
  return jsonb_build_object('path', v_row.path);
end $$;

create function public.admin_check_ward_ids(p_ids jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  return coalesce((
    select jsonb_agg(w.ward_id)
    from public.wishes w
    where w.ward_id in (select jsonb_array_elements_text(p_ids))
  ), '[]'::jsonb);
end $$;

-- Импорт идёт одной транзакцией: при любой ошибке не создаётся ни одной карточки.
create function public.admin_import_wishes(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  r jsonb;
  v_count integer := 0;
begin
  perform app_private.require_admin();
  for r in select * from jsonb_array_elements(p_rows)
  loop
    if coalesce(trim(r ->> 'ward_id'), '') = '' or coalesce(trim(r ->> 'public_name'), '') = ''
       or coalesce(trim(r ->> 'wish_title'), '') = '' or (r ->> 'age') is null then
      raise exception 'validation_failed';
    end if;
    begin
      insert into public.wishes (ward_id, public_name, age, city, wish_title, description, photo_public)
      values (
        trim(r ->> 'ward_id'), trim(r ->> 'public_name'), (r ->> 'age')::integer, nullif(trim(r ->> 'city'), ''),
        trim(r ->> 'wish_title'), coalesce(r ->> 'description', ''), coalesce((r ->> 'photo_public')::boolean, false)
      );
    exception
      when unique_violation then raise exception 'ward_id_taken';
      when check_violation then raise exception 'validation_failed';
    end;
    v_count := v_count + 1;
  end loop;
  perform app_private.log('wish.imported', 'wish', null, jsonb_build_object('count', v_count));
  return jsonb_build_object('created', v_count);
end $$;

create function public.admin_save_setting(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  if p_key not in ('general', 'about', 'how', 'contacts_page', 'tree', 'messages', 'banners') then
    raise exception 'validation_failed';
  end if;
  insert into public.settings (key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform app_private.log('settings.updated', 'settings', p_key, jsonb_build_object('value', p_value));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_save_contact(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform app_private.require_admin();
  if coalesce(trim(p ->> 'slack_handle'), '') = ''
     or coalesce(trim(p ->> 'slack_url'), 'https://') !~* '^(https://|$)' then
    raise exception 'validation_failed';
  end if;
  if v_id is null then
    insert into public.contacts (slack_handle, label, slack_url, sort_order)
      values (trim(p ->> 'slack_handle'), coalesce(trim(p ->> 'label'), ''), nullif(trim(p ->> 'slack_url'), ''),
        (select coalesce(max(sort_order), 0) + 1 from public.contacts))
      returning id into v_id;
    perform app_private.log('contact.created', 'contact', v_id::text, p);
  else
    update public.contacts set
      slack_handle = trim(p ->> 'slack_handle'),
      label = coalesce(trim(p ->> 'label'), ''),
      slack_url = nullif(trim(p ->> 'slack_url'), '')
    where id = v_id;
    perform app_private.log('contact.updated', 'contact', v_id::text, p);
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create function public.admin_delete_contact(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_handle text;
begin
  perform app_private.require_admin();
  delete from public.contacts where id = p_id returning slack_handle into v_handle;
  perform app_private.log('contact.deleted', 'contact', p_id::text, jsonb_build_object('slack_handle', v_handle));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_reorder_contacts(p_ids jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  update public.contacts c set sort_order = o.ord
    from jsonb_array_elements_text(p_ids) with ordinality as o(id, ord)
    where c.id = o.id::uuid;
  perform app_private.log('contact.reordered', 'contact', null, jsonb_build_object('order', p_ids));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_list_users() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin();
  perform app_private.expire_overdue();
  return coalesce((
    select jsonb_agg(u order by (u ->> 'last_booked_at') desc)
    from (
      select jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'display_name', p.display_name,
        'slack', p.slack,
        'phone', p.phone,
        'count', count(*),
        'last_booked_at', max(b.booked_at),
        'wishes', jsonb_agg(jsonb_build_object(
          'wish_id', w.id, 'ward_id', w.ward_id, 'name', w.public_name, 'age', w.age,
          'wish_title', w.wish_title, 'status', w.status, 'booked_at', b.booked_at, 'expires_at', b.expires_at
        ) order by b.booked_at desc)
      ) as u
      from public.profiles p
      join public.bookings b on b.user_id = p.id and b.state in ('active', 'fulfilled')
      join public.wishes w on w.id = b.wish_id
      group by p.id
    ) s
  ), '[]'::jsonb);
end $$;

create function public.admin_list_audit(p_limit integer default 100, p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin(true);
  return jsonb_build_object(
    'total', (select count(*) from public.audit_log),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.at desc, l.id desc)
      from (
        select * from public.audit_log order by at desc, id desc
        limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0)
      ) l
    ), '[]'::jsonb)
  );
end $$;

create function public.admin_list_admins() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin(true);
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.admins a), '[]'::jsonb);
end $$;

-- p_role = null снимает права. Последнего Super Admin снять или понизить нельзя.
create function public.admin_set_admin(p_email text, p_role public.admin_role) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_email text := lower(trim(p_email));
begin
  perform app_private.require_admin(true);
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'validation_failed';
  end if;
  perform pg_advisory_xact_lock(7316003);
  if (p_role is null or p_role <> 'super_admin')
     and exists (select 1 from public.admins where email = v_email and role = 'super_admin')
     and (select count(*) from public.admins where role = 'super_admin') <= 1 then
    raise exception 'last_super_admin';
  end if;
  if p_role is null then
    delete from public.admins where email = v_email;
  else
    insert into public.admins (email, role) values (v_email, p_role)
      on conflict (email) do update set role = excluded.role;
  end if;
  perform app_private.log('admin.changed', 'admin', v_email, jsonb_build_object('role', p_role));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_export() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  perform app_private.require_admin(true);
  perform app_private.log('data.exported', 'database', null, '{}');
  return jsonb_build_object(
    'exported_at', now(),
    'wishes', coalesce((select jsonb_agg(to_jsonb(t)) from public.wishes t), '[]'::jsonb),
    'wish_media', coalesce((select jsonb_agg(to_jsonb(t)) from public.wish_media t), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(t)) from public.bookings t), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t), '[]'::jsonb),
    'settings', coalesce((select jsonb_agg(to_jsonb(t)) from public.settings t), '[]'::jsonb),
    'contacts', coalesce((select jsonb_agg(to_jsonb(t)) from public.contacts t), '[]'::jsonb),
    'admins', coalesce((select jsonb_agg(to_jsonb(t)) from public.admins t), '[]'::jsonb),
    'audit_log', coalesce((select jsonb_agg(to_jsonb(t)) from public.audit_log t), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------ права на функции

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_tree() to anon, authenticated;
grant execute on function public.get_public_content() to anon, authenticated;
grant execute on function public.get_wish(uuid) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

grant execute on function public.book_wish(uuid) to authenticated;
grant execute on function public.my_bookings() to authenticated;
grant execute on function public.save_my_profile(text, text, text) to authenticated;
grant execute on function public.current_admin_role() to authenticated;

grant execute on function public.admin_whoami() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_list_wishes() to authenticated;
grant execute on function public.admin_list_media(uuid) to authenticated;
grant execute on function public.admin_save_wish(jsonb) to authenticated;
grant execute on function public.admin_delete_wish(uuid) to authenticated;
grant execute on function public.admin_set_status(uuid, public.wish_status, text) to authenticated;
grant execute on function public.admin_set_hidden(uuid, boolean) to authenticated;
grant execute on function public.admin_add_media(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_remove_media(uuid) to authenticated;
grant execute on function public.admin_check_ward_ids(jsonb) to authenticated;
grant execute on function public.admin_import_wishes(jsonb) to authenticated;
grant execute on function public.admin_save_setting(text, jsonb) to authenticated;
grant execute on function public.admin_save_contact(jsonb) to authenticated;
grant execute on function public.admin_delete_contact(uuid) to authenticated;
grant execute on function public.admin_reorder_contacts(jsonb) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_list_audit(integer, integer) to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_set_admin(text, public.admin_role) to authenticated;
grant execute on function public.admin_export() to authenticated;

-- ------------------------------------------------------ файлы (Storage)

-- wish-media закрыт: файл ребёнка выдаётся только по подписанной ссылке и только с согласия на публикацию.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('wish-media', 'wish-media', false, 26214400,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']),
  ('site-assets', 'site-assets', true, 8388608,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

create function public.storage_object_is_public(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.wishes w where w.photo_path = p_path and w.photo_public and not w.hidden)
      or exists (
        select 1 from public.wish_media m join public.wishes w on w.id = m.wish_id
        where m.path = p_path and m.is_public and not w.hidden
      )
$$;
revoke execute on function public.storage_object_is_public(text) from public;
grant execute on function public.storage_object_is_public(text) to anon, authenticated;

create policy wish_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'wish-media' and (public.is_admin() or public.storage_object_is_public(name)));
create policy wish_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'wish-media' and public.is_admin());
create policy wish_media_update on storage.objects for update to authenticated
  using (bucket_id = 'wish-media' and public.is_admin());
create policy wish_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'wish-media' and public.is_admin());

create policy site_assets_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'site-assets');
create policy site_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-assets' and public.is_admin());
create policy site_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());
create policy site_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());

-- ------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.site_pulse;

-- ------------------------------------------------------ тексты по умолчанию

insert into public.settings (key, value) values
('general', jsonb_build_object(
  'project_title', 'Uzum sehr',
  'hero_title', E'Исполни мечту!\nЗажги огонь на ёлке',
  'hero_subtitle', 'У каждого ребёнка есть мечта. Давай вместе сделаем так, чтобы в этот Новый год она стала реальностью.'
)),
('about', jsonb_build_object(
  'title', 'О проекте',
  'paragraphs', jsonb_build_array(
    'Новый год — это время, когда даже самые маленькие мечты могут стать реальностью.',
    'В этом году Uzum E-com совместно с благотворительным фондом ONA запускает новогоднюю акцию, чтобы подарить детям немного больше радости, тепла и веры в чудеса.',
    'Мы собрали желания детей, разместили их на нашей новогодней ёлке и предлагаем каждому стать частью этой истории.',
    'Выбери лампочку, исполни желание и зажги ещё один огонёк добра.',
    'Ведь настоящее чудо создаём мы сами.'
  )
)),
('how', jsonb_build_object(
  'title', 'Как зажечь своё доброе дело?',
  'steps', jsonb_build_array(
    jsonb_build_object('title', 'Выбери лампочку', 'body', 'Нажми на любую незажжённую лампочку на новогодней ёлке. За каждой из них скрывается настоящее желание ребёнка.', 'note', ''),
    jsonb_build_object('title', 'Познакомься с мечтой', 'body', 'Открой карточку, прочитай желание и узнай, какой подарок сделает этого ребёнка счастливее.', 'note', ''),
    jsonb_build_object('title', 'Зажги лампочку', 'body', 'Нажми кнопку «Зажечь лампочку». После этого желание закрепится за тобой, а в личном кабинете появится информация о твоём добром деле и уникальный ID подопечного.', 'note', ''),
    jsonb_build_object('title', 'Подготовь подарок', 'body', E'Купи подарок, о котором мечтает ребёнок.\nДополнительно к основному подарку можно положить сладости.\nПросим не добавлять фрукты и другие скоропортящиеся продукты.', 'note', 'Очень важно: обязательно подпиши подарок уникальным ID подопечного! Это необходимо, чтобы подарок точно попал к нужному ребёнку.'),
    jsonb_build_object('title', 'Передай подарок', 'body', 'Готовый подарок можно оставить под главной новогодней ёлкой на первом этаже вашего офиса.', 'note', 'Обязательно убедись, что на подарке хорошо виден ID подопечного.')
  ),
  'finale', 'Спасибо, что помогаешь мечтам сбываться! Благодаря тебе эта зима станет немного теплее.'
)),
('contacts_page', jsonb_build_object(
  'title', 'Есть вопросы? Мы рядом!',
  'subtitle', 'Напиши в Slack — поможем выбрать желание, подскажем, как передать подарок.'
)),
('tree', jsonb_build_object(
  'target_wishes', 150,
  'booking_hours', 336,
  'max_bookings_per_user', 10,
  'booking_paused', false,
  'pause_message', 'Бронирование временно приостановлено. Загляни чуть позже!',
  'counter', jsonb_build_object('label', 'Зажжено желаний', 'show_gifts', true, 'show_free', true, 'show_progress', true)
)),
('messages', jsonb_build_object(
  'booking_success', 'Ты только что зажёг не просто лампочку. Ты помог чьей-то мечте стать реальностью!',
  'all_lit', 'Кажется, мы зажгли все огоньки! Все детские мечты нашли своих добрых волшебников.',
  'drop_off', 'Под главной новогодней ёлкой на первом этаже офиса'
)),
('banners', jsonb_build_object('items', '[]'::jsonb));

insert into public.contacts (slack_handle, label, sort_order) values
  ('a.kupriianova', 'Организатор акции', 1),
  ('a.savina', 'Организатор акции', 2),
  ('u.zhukova', 'Организатор акции', 3);
