-- fruit for all: first Postgres schema (Oct 2026). Replaces the DynamoDB tables
-- LoquatUsers and LoquatPins. Plan: the "Postgres migration plan" doc.
-- Applied by scripts/migrate.mjs inside one transaction; never edit a migration
-- that has run anywhere: add 002_… instead.

create extension if not exists postgis;

-- People. user_name keeps the case it was typed with (the client compares
-- submittedBy to the signed-in name exactly); uniqueness and sign-in ignore case.
create table users (
  user_name      text primary key,
  email          text not null,
  password_hash  text,                 -- null only for legacy rows with no password
  is_admin       boolean not null default false,
  created_at     timestamptz not null default now(),
  last_login     timestamptz,
  constraint users_name_not_blank check (length(btrim(user_name)) > 0),
  constraint users_email_lower check (email = lower(email))
);
create unique index users_name_ci on users (lower(user_name));
create unique index users_email_ci on users (lower(email));

-- Reset links. Only a SHA-256 of the emailed token is stored; single use.
create table password_resets (
  token_hash  text primary key,
  user_name   text not null references users (user_name) on update cascade on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index password_resets_user on password_resets (user_name);

-- Finds. pin_id is the same v4 UUID as in DynamoDB, so /find/<id> links survive.
create table pins (
  pin_id              uuid primary key,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  location            geography(point, 4326) not null,
  fruit_type          text not null,   -- lower case, a FRUIT_LIST name (checked in code)
  fruit_type_display  text not null,
  notes               text not null default '',
  submitted_by        text not null references users (user_name) on update cascade,
  status              text not null default 'active',
  zone                smallint not null,
  constraint pins_status check (status in ('active', 'removed')),
  constraint pins_fruit_type_lower check (fruit_type = lower(fruit_type)),
  constraint pins_zone_range check (zone between 1 and 13)
);
create index pins_location on pins using gist (location);
create index pins_active_newest on pins (created_at desc, pin_id desc) where status = 'active';
create index pins_by_user on pins (submitted_by, created_at desc);

-- "still good?" taps. Anonymous: the per-IP daily dedup stays in Redis / memory.
create table pin_confirmations (
  id            bigint generated always as identity primary key,
  pin_id        uuid not null references pins (pin_id) on delete cascade,
  confirmed_at  timestamptz not null default now()
);
create index pin_confirmations_pin on pin_confirmations (pin_id, confirmed_at);

-- "report a problem". Reason ids match REPORT_REASONS in client/utils/findLinks.js.
create table pin_reports (
  id          bigint generated always as identity primary key,
  pin_id      uuid not null references pins (pin_id) on delete cascade,
  reason      text not null,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  constraint pin_reports_reason check (reason in ('gone', 'private', 'unsafe', 'wrong-kind', 'other'))
);
create index pin_reports_pin on pin_reports (pin_id, created_at);
