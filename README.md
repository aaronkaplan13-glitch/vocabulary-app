# Lexicon — a daily vocabulary study

![CI](https://github.com/aaronkaplan13-glitch/vocabulary-app/actions/workflows/ci.yml/badge.svg)

A local-first vocabulary app built on **production over recognition**: active
recall, interleaved practice, FSRS spaced repetition, an auto-assembling
morpheme graph, and a Claude conversation coach.

Stack: **Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
(Postgres) · ts-fsrs · Anthropic Claude (Sonnet 4.6)**.

---

## Setup

You need a free **Supabase** project and an **Anthropic API key**. ~5 minutes.

### 1. Create the Supabase project & schema

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it.
   This creates `words`, `morphemes`, `word_morphemes`, `reviews`,
   `conversations`, and a single-row `settings` table, and locks everything down
   with RLS (the app talks to the DB only via the server-side service-role key).
3. In **Project Settings → API**, copy the **Project URL** and the
   **`service_role`** key.

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
ANTHROPIC_API_KEY=<your Anthropic key>
```

### 3. Run

```bash
npm install      # already done if you scaffolded here
npm run dev
```

Open <http://localhost:3000>, add a few words, and press **Begin session**.

> No keys yet? The app still builds and boots; API calls return a clear
> "Missing …" message until the env vars are set.

---

## How it works

### The stage ladder (production over recognition)

Each word climbs a 5-rung ladder. It only advances when recalled successfully on
a **due** day, so progression is gated by the passage of days (FSRS decides when
a word resurfaces). A lapse demotes one rung (floored at Recognition).

| Stage | Name | The challenge |
|------:|------|---------------|
| 0 | **Encounter** | Meet the word: gloss, definition, example. No test. |
| 1 | **Recognition** | See the word → recall its meaning (self-graded). |
| 2 | **Cued Recall** | Definition + blanked example → produce the word. |
| 3 | **Production** | Write your own correct sentence. |
| 4 | **Conversation** | Use it naturally in the Claude coaching chat (mastery). |

Logic lives in [`lib/stages.ts`](lib/stages.ts).

### Spaced repetition (FSRS)

[`lib/fsrs.ts`](lib/fsrs.ts) wraps **`ts-fsrs`**. Each word stores the full FSRS
card (difficulty, stability, due, state, …); a review applies the chosen grade
(Again / Hard / Good / Easy), reschedules, and appends an immutable row to
`reviews`. Target retention defaults to **90%** and is configurable in `settings`.

### Adaptive new-word cap

[`lib/cap.ts`](lib/cap.ts) protects the daily time budget:

- due reviews **> 60** → **0** new words (clear the backlog first)
- due reviews **40–60** → **2** new words
- due reviews **< 40** → up to **5** new words

### Morpheme graph

When you add a word, Claude returns a structured breakdown (definition, part of
speech, example, **morphemes**). The backend upserts each morpheme into a
deduplicated table and links it via `word_morphemes`, so the graph assembles
itself. Browse it under **Roots** — shared roots reveal word families.

### Conversation coaching

The coach runs **entirely in client React state**
([`components/ConversationCoach.tsx`](components/ConversationCoach.tsx)) for a
snappy 4-turn chat. Claude is given the 3 target words and asked to create
openings without naming them. Only the **final transcript + score** is written
to `conversations` at the end — the single DB write for the whole mode.

---

## Architecture

### Daily session state machine

`app/session/page.tsx`:

```
load /api/session
      │
      ▼
  ┌────────┐  every due/new card, one FSRS review each
  │ DRILL  │  (interleaved; reviews first, new encounters last)
  └────────┘
      │  queue exhausted
      ▼
 ┌──────────────┐  3 target words, 4 turns, client-side state
 │ CONVERSATION │  (skipped if fewer than 2 target words)
 └──────────────┘
      │  Claude scores + saves transcript
      ▼
  ┌─────────┐  reviewed count, stage promotions, conversation score
  │ SUMMARY │
  └─────────┘
```

### API routes (`app/api`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/words` | `GET` | List words with morphemes. |
| `/api/words` | `POST` | Add a word → Claude breakdown → upsert word + morphemes + links. |
| `/api/words/[id]` | `DELETE` | Remove a word (cascades). |
| `/api/session` | `GET` | Assemble today's session: interleaved due cards, adaptive new-word allocation, conversation targets. |
| `/api/reviews` | `POST` | Submit a grade → FSRS reschedule + stage transition + review log. |
| `/api/morphemes` | `GET` | The morpheme graph (each morpheme + its words). |
| `/api/conversation/reply` | `POST` | Stateless: the coach's next turn. |
| `/api/conversation` | `POST` | End of chat: Claude evaluates, transcript + score saved. |
| `/api/conversation` | `GET` | Past coaching sessions. |

### Component tree

```
app/layout.tsx ......... fonts (Newsreader / Geist / Geist Mono), tokens
├ app/page.tsx ......... Today: plan, adaptive-cap reason, AddWordForm
├ app/session/page.tsx . SessionRunner state machine (drill→conversation→summary)
│   ├ components/DrillCard.tsx ......... per-stage challenge + reveal
│   │   ├ MorphemeGloss · StageLadder · RatingButtons
│   └ components/ConversationCoach.tsx . client-state chat + live target chips
├ app/words/page.tsx ... the deck (gloss, stage, due, review stats)
└ app/graph/page.tsx ... the auto-assembled morpheme graph

components/
  MorphemeGloss .. signature: headword as interlinear gloss
  StageLadder .... 0→4 rungs
  RatingButtons .. Again / Hard / Good / Easy
  AddWordForm .... add + preview
  Masthead ....... nav
```

### Code map (`lib`)

- `config.ts` — single-user id, defaults, Claude model.
- `types.ts` — domain types.
- `supabase.ts` — lazy service-role client.
- `anthropic.ts` — `generateWord`, `coachReply`, `evaluateConversation` (tool-forced JSON).
- `fsrs.ts` — ts-fsrs wrapper (card ⇄ DB, `applyReview`, `retrievability`).
- `stages.ts` — the production ladder.
- `cap.ts` — adaptive new-word cap.
- `settings.ts` / `words.ts` — settings loader, word fetch/flatten, interleave shuffle.

---

## Design notes

The interface is set as a **lexicographer's study**: a cool ledger-paper ground,
a fountain-pen **ink-blue** accent, and an oxblood "attention" flag. Headwords
are typeset as an **interlinear gloss** (the signature element) — each morpheme
underlined in its type color with its meaning set in mono beneath. Display face
is **Newsreader**; UI is **Geist**; data/labels are **Geist Mono**. Light theme
only, with visible keyboard focus and reduced-motion support.

## Tests

Core algorithms (FSRS scheduling, stage transitions, adaptive cap) are pure and
were verified with assertions. To re-run, drop a `tsx` script importing from
`lib/` and execute with `npx tsx`.
