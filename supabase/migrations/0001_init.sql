-- ============================================================================
-- Vocabulary App — initial schema
-- Local-first, single-user. The Next.js server talks to Supabase with the
-- SERVICE ROLE key, so RLS is enabled with NO public policies: the anon key
-- cannot read/write, the service role bypasses RLS. This keeps the DB locked
-- while letting the app work without Supabase Auth.
-- ============================================================================

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- settings: single-row table holding runtime-configurable knobs.
-- request_retention defaults to 0.90 (FSRS target). Daily caps live here too
-- so they can be tuned without a redeploy.
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id                       smallint primary key default 1,
  request_retention        double precision not null default 0.90,
  new_words_cap            smallint not null default 5,    -- base daily new-word cap
  throttle_mid_cap         smallint not null default 2,    -- cap when due reviews in [throttle_low, throttle_high]
  throttle_low             smallint not null default 40,
  throttle_high            smallint not null default 60,   -- above this, cap drops to 0
  conversation_turns       smallint not null default 4,    -- user turns in coaching mode
  maximum_interval         integer  not null default 36500,
  updated_at               timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- words: one row per vocabulary item. Holds Claude-generated content, the
-- production-over-recognition stage, and the current FSRS card scheduling
-- state (Difficulty / Stability + the rest of the ts-fsrs Card).
-- ---------------------------------------------------------------------------
create table if not exists words (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null default 'local',
  text               text not null,
  definition         text,
  part_of_speech     text,
  example_sentence   text,
  notes              text,

  -- Stage progression (0=Encounter, 1=Recognition, 2=Cued Recall,
  -- 3=Production, 4=Conversation/Mastery). See lib/stages.ts.
  current_stage      smallint not null default 0,
  introduced_on      date,                 -- set the first day the word is studied; null = brand new

  -- FSRS card state (mirrors the ts-fsrs Card object).
  due                timestamptz not null default now(),
  stability          double precision not null default 0,
  difficulty         double precision not null default 0,
  elapsed_days       integer not null default 0,
  scheduled_days     integer not null default 0,
  reps               integer not null default 0,
  lapses             integer not null default 0,
  learning_steps     integer not null default 0,
  state              smallint not null default 0,   -- 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review        timestamptz,
  retrievability     double precision,              -- snapshot at last review, for display

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (user_id, text)
);

create index if not exists words_due_idx on words (user_id, due);
create index if not exists words_stage_idx on words (user_id, current_stage);

-- ---------------------------------------------------------------------------
-- morphemes: deduplicated graph of prefixes/roots/suffixes. Claude proposes
-- these per word; the backend upserts them so the graph self-assembles.
-- ---------------------------------------------------------------------------
create table if not exists morphemes (
  id        uuid primary key default gen_random_uuid(),
  type      text not null check (type in ('prefix', 'root', 'suffix', 'infix', 'combining')),
  text      text not null,           -- the morpheme form, e.g. 'bene', 'volent'
  meaning   text,
  created_at timestamptz not null default now(),
  unique (type, text)
);

create index if not exists morphemes_text_idx on morphemes (text);

-- ---------------------------------------------------------------------------
-- word_morphemes: join table connecting words to their morphemes, ordered.
-- ---------------------------------------------------------------------------
create table if not exists word_morphemes (
  word_id     uuid not null references words (id) on delete cascade,
  morpheme_id uuid not null references morphemes (id) on delete cascade,
  position    smallint not null default 0,   -- order within the word
  primary key (word_id, morpheme_id)
);

create index if not exists word_morphemes_morpheme_idx on word_morphemes (morpheme_id);

-- ---------------------------------------------------------------------------
-- reviews: append-only history log. One row per drill answer. Records the
-- rating, the stage tested, and the FSRS state produced by that review so the
-- forgetting curve / interval history is fully reconstructable.
-- ---------------------------------------------------------------------------
create table if not exists reviews (
  id                 uuid primary key default gen_random_uuid(),
  word_id            uuid not null references words (id) on delete cascade,
  user_id            text not null default 'local',
  rating             smallint not null check (rating between 1 and 4), -- ts-fsrs Rating
  stage_before       smallint not null,
  stage_after        smallint not null,
  state              smallint not null,
  due                timestamptz not null,        -- next due assigned by this review
  stability          double precision not null,
  difficulty         double precision not null,
  elapsed_days       integer not null default 0,
  scheduled_days     integer not null default 0,
  last_elapsed_days  integer not null default 0,
  retrievability     double precision,
  reviewed_at        timestamptz not null default now()
);

create index if not exists reviews_word_idx on reviews (word_id);
create index if not exists reviews_reviewed_at_idx on reviews (user_id, reviewed_at);

-- ---------------------------------------------------------------------------
-- conversations: final log of a coaching session. Client manages turns in
-- React state; only the completed transcript + score is persisted here.
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default 'local',
  target_words  text[] not null default '{}',
  words_used    text[] not null default '{}',   -- which targets were used naturally
  transcript    jsonb not null default '[]',     -- [{ role, content }]
  score         integer,                          -- 0-100
  feedback      text,
  created_at    timestamptz not null default now()
);

create index if not exists conversations_created_idx on conversations (user_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger for words / settings
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists words_set_updated_at on words;
create trigger words_set_updated_at before update on words
  for each row execute function set_updated_at();

drop trigger if exists settings_set_updated_at on settings;
create trigger settings_set_updated_at before update on settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Lock everything down: enable RLS with no policies. The service-role key
-- (used only server-side in Next.js API routes) bypasses RLS; the anon key
-- gets nothing. No data is exposed to the browser.
-- ---------------------------------------------------------------------------
alter table settings        enable row level security;
alter table words           enable row level security;
alter table morphemes       enable row level security;
alter table word_morphemes  enable row level security;
alter table reviews         enable row level security;
alter table conversations   enable row level security;
