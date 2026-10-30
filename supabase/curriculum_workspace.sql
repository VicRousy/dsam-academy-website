begin;

create table if not exists public.curriculum_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default gen_random_uuid()::text,
  track_name text not null check (char_length(trim(track_name)) between 3 and 160),
  stage_name text not null check (char_length(trim(stage_name)) between 3 and 120),
  stage_order integer not null check (stage_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.curriculum_sessions (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.curriculum_stages(id) on delete cascade,
  session_order integer not null check (session_order > 0),
  session_label text not null check (char_length(trim(session_label)) between 3 and 80),
  topic text not null check (char_length(trim(topic)) between 3 and 3000),
  objectives text not null check (char_length(trim(objectives)) between 3 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (stage_id, session_order)
);

create table if not exists public.application_intake_details (
  enrollment_id uuid primary key references public.enrollments(id) on delete cascade,
  surname text not null check (char_length(trim(surname)) between 1 and 120),
  first_name text not null check (char_length(trim(first_name)) between 1 and 120),
  middle_name text check (middle_name is null or char_length(middle_name) <= 120),
  address text check (address is null or char_length(address) <= 500),
  phone text check (phone is null or char_length(phone) <= 40),
  study_duration text check (study_duration is null or char_length(study_duration) <= 120),
  major_instrument text check (major_instrument is null or char_length(major_instrument) <= 120),
  minor_instrument text check (minor_instrument is null or char_length(minor_instrument) <= 120),
  grade_level text check (grade_level is null or char_length(grade_level) <= 80),
  paper_signed_on date,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.curriculum_stages enable row level security;
alter table public.curriculum_sessions enable row level security;
alter table public.application_intake_details enable row level security;

revoke all on public.curriculum_stages, public.curriculum_sessions, public.application_intake_details from public, anon, authenticated;
grant select, insert, update on public.curriculum_stages, public.curriculum_sessions, public.application_intake_details to authenticated;

drop policy if exists "staff read curriculum stages" on public.curriculum_stages;
create policy "staff read curriculum stages" on public.curriculum_stages
for select to authenticated using ((select public.is_staff()));
drop policy if exists "staff create curriculum stages" on public.curriculum_stages;
create policy "staff create curriculum stages" on public.curriculum_stages
for insert to authenticated with check ((select public.is_staff()));
drop policy if exists "staff update curriculum stages" on public.curriculum_stages;
create policy "staff update curriculum stages" on public.curriculum_stages
for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists "staff read curriculum sessions" on public.curriculum_sessions;
create policy "staff read curriculum sessions" on public.curriculum_sessions
for select to authenticated using ((select public.is_staff()));
drop policy if exists "staff create curriculum sessions" on public.curriculum_sessions;
create policy "staff create curriculum sessions" on public.curriculum_sessions
for insert to authenticated with check ((select public.is_staff()));
drop policy if exists "staff update curriculum sessions" on public.curriculum_sessions;
create policy "staff update curriculum sessions" on public.curriculum_sessions
for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists "staff read application intake" on public.application_intake_details;
create policy "staff read application intake" on public.application_intake_details
for select to authenticated using ((select public.is_staff()));
drop policy if exists "staff create application intake" on public.application_intake_details;
create policy "staff create application intake" on public.application_intake_details
for insert to authenticated with check ((select public.is_staff()));
drop policy if exists "staff update application intake" on public.application_intake_details;
create policy "staff update application intake" on public.application_intake_details
for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

insert into public.curriculum_stages (code, track_name, stage_name, stage_order)
values
  ('practical-ensemble-beginner', 'Woodwind, strings and brass', 'Beginner', 1),
  ('practical-ensemble-intermediate', 'Woodwind, strings and brass', 'Improvement / intermediate', 2),
  ('practical-ensemble-professional', 'Woodwind, strings and brass', 'Professional', 3),
  ('practical-piano-beginner', 'Piano', 'Beginner', 1),
  ('practical-piano-intermediate', 'Piano', 'Intermediate', 2)
on conflict (code) do nothing;

with source (stage_code, session_order, session_label, topic, objectives) as (
  values
    ('practical-ensemble-beginner', 1, 'Session 1', 'Music rudiments; instrument classification; posture, embouchure, fingering and bowing; seven musical letters, accidentals and solfa in the major scale.', 'Use the instrument correctly and relate musical letters to solfa notes.'),
    ('practical-ensemble-beginner', 2, 'Session 2', 'C major scale, fingering exercises, long tones and anthems.', 'Play in the key of C.'),
    ('practical-ensemble-beginner', 3, 'Session 3', 'F and B-flat concert major scales and fingering; introduction to national anthems in C major.', 'Play the F and B-flat concert scales.'),
    ('practical-ensemble-beginner', 4, 'Session 4', 'National and organisational anthems in B-flat, F and C concert.', 'Perform selected anthems in B-flat, F and C concert.'),
    ('practical-ensemble-beginner', 5, 'Session 5', 'Refine anthem performance and introduce selected songs.', 'Play anthems with greater confidence and begin scoring and playing songs.'),
    ('practical-ensemble-beginner', 6, 'Sessions 6–8', 'Sight-reading, scoring and rehearsal of selected songs.', 'Perform selected orchestrations for an occasion.'),
    ('practical-ensemble-intermediate', 1, 'Session 1', 'Sight-reading: notes and values; beat clapping in bars; review of F and B-flat concert scales, anthems and selected songs.', 'Name musical notes and their values.'),
    ('practical-ensemble-intermediate', 2, 'Session 2', 'Sight-reading: clefs, staves and note positions; C and A-flat concert scales; selected songs.', 'Identify clefs and note positions.'),
    ('practical-ensemble-intermediate', 3, 'Session 3', 'Sight-reading: time signatures and application; F-sharp and G concert scales; song rehearsal.', 'Apply time signatures while playing in F-sharp and G concert.'),
    ('practical-ensemble-intermediate', 4, 'Session 4', 'Sight-reading: key signatures, sharps, flats and naturals; E-flat and A concert scales with songs and anthems.', 'Identify the key of a musical piece.'),
    ('practical-ensemble-intermediate', 5, 'Session 5', 'Simple dynamics; notating selected anthems with stem rules; reading and playing simple pieces.', 'Create a short musical piece and present it as an audition exercise.'),
    ('practical-ensemble-intermediate', 6, 'Sessions 6–8', 'Rehearsal and performance of varied pieces.', 'Perform pieces with measurable improvement.'),
    ('practical-ensemble-professional', 1, 'Session 1', 'Sight-reading review and development of tonality.', 'Improve the sense of tonality.'),
    ('practical-ensemble-professional', 2, 'Session 2', 'Sight-reading, pitch matching and special practice songs.', 'Match pitch reliably.'),
    ('practical-ensemble-professional', 3, 'Session 3', 'Rehearsal of A, B, C, D, E, F and G major keys with special anthems and songs.', 'Play in all listed major keys.'),
    ('practical-ensemble-professional', 4, 'Session 4', 'Accidental keys: B-flat and C-sharp; special songs.', 'Play in B-flat and C-sharp.'),
    ('practical-ensemble-professional', 5, 'Session 5', 'E-flat, F-sharp and A-flat keys with special songs.', 'Play in E-flat, F-sharp and A-flat.'),
    ('practical-ensemble-professional', 6, 'Session 6', 'Sight-reading, songs and hymns.', 'Read at sight and improve song and hymn performance.'),
    ('practical-ensemble-professional', 7, 'Session 7', 'Harmonisation and accompaniment.', 'Provide basic harmony and accompany songs.'),
    ('practical-ensemble-professional', 8, 'Session 8', 'Songs and hymns rehearsal.', 'Perform songs and hymns fluently.'),
    ('practical-piano-beginner', 1, 'Session 1', 'Keyboard layout, notes, semitones, octaves and enharmonic keys.', 'Identify the keyboard and its main components.'),
    ('practical-piano-beginner', 2, 'Session 2', 'Black and white keys; introduction to scales; C major.', 'Play the C major scale.'),
    ('practical-piano-beginner', 3, 'Session 3', 'Right- and left-hand fingering for C, D, F, G, A and B-flat; C and G major scales.', 'Use improved fingering and play C and G major scales.'),
    ('practical-piano-beginner', 4, 'Session 4', 'Easy familiar tunes in C and G major.', 'Play familiar tunes in C and G major.'),
    ('practical-piano-beginner', 5, 'Session 5', 'Introduction to chords and the primary I, IV and V triads.', 'Play the primary triads.'),
    ('practical-piano-beginner', 6, 'Session 6', 'Apply primary I, IV and V chords to simple tunes.', 'Accompany simple tunes with primary chords.'),
    ('practical-piano-beginner', 7, 'Session 7', 'D and F major scales with both hands; simple tunes with primary chords.', 'Play in D and F major and apply primary chords.'),
    ('practical-piano-beginner', 8, 'Session 8', 'Song progressions; further practice in C, D, F and G major.', 'Practise common progressions across these keys.'),
    ('practical-piano-beginner', 9, 'Session 9', 'B-flat major and tunes using primary chords.', 'Play simple tunes in B-flat major.'),
    ('practical-piano-beginner', 10, 'Session 10', 'Introduction to accompaniment and simple vamping.', 'Understand and begin accompanying songs.'),
    ('practical-piano-beginner', 11, 'Session 11', 'Accompaniment and vamping practice.', 'Become more fluent with accompaniment patterns.'),
    ('practical-piano-beginner', 12, 'Session 12', 'Repertoire review, clear tones, dynamics and ensemble playing.', 'Perform learned songs confidently with an ensemble.'),
    ('practical-piano-intermediate', 1, 'Session 1', 'Review major keys, scales and tunes from past performances.', 'Play previously taught songs from memory.'),
    ('practical-piano-intermediate', 2, 'Session 2', 'More tunes with primary chords; introduction to secondary chords.', 'Recognise secondary chords and their uses.'),
    ('practical-piano-intermediate', 3, 'Session 3', 'Combine primary and secondary chords in tunes.', 'Use both chord groups harmoniously.'),
    ('practical-piano-intermediate', 4, 'Session 4', 'B-flat, A-flat and F-sharp major keys with additional tunes.', 'Play confidently in the new keys.'),
    ('practical-piano-intermediate', 5, 'Session 5', 'Chord inversions, root positions and their application to tunes.', 'Use inversions and root positions fluently.'),
    ('practical-piano-intermediate', 6, 'Session 6', 'Further accompaniment, vamping and keyboard coordination.', 'Use major and minor chords with greater dexterity.'),
    ('practical-piano-intermediate', 7, 'Session 7', 'E, F-sharp, E-flat and C-sharp major keys with new tunes.', 'Play confidently in the new keys.'),
    ('practical-piano-intermediate', 8, 'Session 8', 'Relative minor keys; tunes in D, A and G minor.', 'Connect minor keys to their related major keys.'),
    ('practical-piano-intermediate', 9, 'Session 9', 'Independent left-hand bass lines, right-hand chords and arpeggios.', 'Play independent hands and smooth arpeggios.'),
    ('practical-piano-intermediate', 10, 'Session 10', 'Voicing, sequencing and dynamics.', 'Apply voicing, sequence and dynamics correctly.'),
    ('practical-piano-intermediate', 11, 'Session 11', 'Advanced ear training, ensemble playing and repertoire.', 'Play independently by ear and expand repertoire.'),
    ('practical-piano-intermediate', 12, 'Session 12', 'Repertoire rehearsal, clear tones, dynamics and ensemble playing.', 'Perform a wider range of songs and pieces confidently.')
)
insert into public.curriculum_sessions (stage_id, session_order, session_label, topic, objectives)
select stages.id, source.session_order, source.session_label, source.topic, source.objectives
from source
join public.curriculum_stages as stages on stages.code = source.stage_code
on conflict (stage_id, session_order) do nothing;

commit;

select
  (select count(*) from public.curriculum_stages) as curriculum_stages,
  (select count(*) from public.curriculum_sessions) as curriculum_session_blocks,
  (select bool_and(c.relrowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('curriculum_stages', 'curriculum_sessions', 'application_intake_details')) as rls_enabled_on_private_tables,
  (has_table_privilege('anon', 'public.curriculum_stages', 'select')
   or has_table_privilege('anon', 'public.curriculum_sessions', 'select')
   or has_table_privilege('anon', 'public.application_intake_details', 'select')) as anonymous_select_granted;
