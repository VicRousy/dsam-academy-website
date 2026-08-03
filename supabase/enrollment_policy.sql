drop policy if exists "students create own enrolments" on public.enrollments;
create policy "students create own enrolments"
on public.enrollments for insert
with check (auth.uid() = student_id);
