import { createClient } from '@supabase/supabase-js';
const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const {data:{session}}=await supabase.auth.getSession();
if(!session) window.location.replace('./auth.html');
const user=session.user;
document.querySelector('#studentName').textContent=`Welcome, ${user.user_metadata.full_name || user.email.split('@')[0]}`;
document.querySelector('#studentEmail').textContent=user.email;
document.querySelector('#signOutButton').onclick=async()=>{await supabase.auth.signOut();window.location.replace('./auth.html')};
const {data:enrolment}=await supabase.from('enrollments').select('status,courses(title)').eq('student_id',user.id).eq('status','active').maybeSingle();
if(enrolment){document.querySelector('#courseName').textContent=enrolment.courses.title;document.querySelector('#courseDetail').textContent='Your enrolment is active.'}
const {data:lessons=[]}=await supabase.from('lesson_sessions').select('starts_at,instructor,location').eq('student_id',user.id).gte('starts_at',new Date().toISOString()).order('starts_at').limit(5);
if(lessons.length){const next=new Date(lessons[0].starts_at);document.querySelector('#lessonDate').textContent=next.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});document.querySelector('#lessonDetail').textContent=`${next.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${lessons[0].location||'DSAM Academy'}`;document.querySelector('#scheduleList').innerHTML=lessons.map(l=>`<p><b>${new Date(l.starts_at).toLocaleDateString()}</b> · ${new Date(l.starts_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${l.instructor||'DSAM Tutor'}</p>`).join('')}
const {data:payment}=await supabase.from('payments').select('status,amount_ngn').eq('student_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
if(payment){document.querySelector('#paymentStatus').textContent=payment.status==='paid'?'Paid':'Payment pending';document.querySelector('#paymentDetail').textContent=`Latest amount: ₦${Number(payment.amount_ngn).toLocaleString()}`}
