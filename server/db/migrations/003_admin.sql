-- The admin command center (Oct 2026). Plan: the "Admin command center plan" doc.
-- Additive only: nothing existing changes shape.

-- A report is open until the admin handles it: kept (the find is fine) or hidden.
alter table pin_reports
  add column handled_at timestamptz,
  add column handled_by text references users (user_name) on update cascade on delete set null,
  add column outcome    text,
  add constraint pin_reports_outcome check (outcome in ('kept', 'hidden')),
  add constraint pin_reports_handled check ((handled_at is null) = (outcome is null));
create index pin_reports_open on pin_reports (created_at desc) where handled_at is null;

-- What happened to finds, for "recent activity". Written in the same transaction
-- as the change it records. pin_id is deliberately not a foreign key, so a
-- deleted find's history stays; fruit_type says what it was.
create table pin_events (
  id          bigint generated always as identity primary key,
  pin_id      uuid not null,
  kind        text not null,
  fields      text[] not null default '{}',  -- edited: which of notes, kind, spot
  by_user     text references users (user_name) on update cascade on delete set null,
  fruit_type  text not null,
  at          timestamptz not null default now(),
  constraint pin_events_kind check (kind in (
    'added', 'edited', 'hidden', 'restored', 'deleted', 'still-there', 'report-handled'))
);
create index pin_events_recent on pin_events (at desc, id desc);
create index pin_events_pin on pin_events (pin_id, at);
