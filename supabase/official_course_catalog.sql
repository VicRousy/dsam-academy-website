-- Run once in Supabase SQL Editor before publishing the new programme selector.
-- This keeps existing test enrolments intact and adds only missing official courses.
insert into public.courses (title)
select course.title
from (
  values
    ('Music Theory Grades 1-6'),
    ('Music Practicals 1-4'),
    ('Diploma in Music'),
    ('Sight Reading Courses Grades 1-6'),
    ('Music Compositions and Conduction Grades 1-6'),
    ('Instrumentation Major (Intermediate to Professional)'),
    ('Instrumentations Minor (Intermediate to Professional)'),
    ('Vocal Ensembles'),
    ('Voice/Pitch Training'),
    ('Hymns and Hymnals Arrangements'),
    ('African Dance Phases'),
    ('Western Dance Phrases'),
    ('African Jazz Cruze'),
    ('Western Jazz Cruze'),
    ('Studio Management')
) as course(title)
where not exists (
  select 1 from public.courses existing where existing.title = course.title
);
