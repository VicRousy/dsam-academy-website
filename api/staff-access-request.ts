import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const appUrl = process.env.APP_URL || 'https://dsam-academy-website.vercel.app';
const ownerEmail = process.env.STAFF_REQUEST_RECIPIENT || 'dsamacademyofmusic@gmail.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const accessToken = token?.replace(/^Bearer\s+/i, '');
  const requestId = Number(req.body?.requestId);
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!accessToken || !Number.isInteger(requestId) || requestId < 1 || !supabaseUrl || !supabaseKey) {
    return res.status(400).json({ error: 'Invalid staff-access notification request.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) return res.status(401).json({ error: 'Sign-in is required.' });

  const { data: request, error: requestError } = await supabase
    .from('staff_access_requests')
    .select('id,email,status')
    .eq('id', requestId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (requestError || !request || request.status !== 'pending') {
    return res.status(403).json({ error: 'This request cannot be notified.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(202).json({ success: true, notification: 'not_configured' });

  const reviewUrl = `${appUrl}/admin.html?staff-request=${request.id}`;
  const resend = new Resend(apiKey);
  const { error: emailError } = await resend.emails.send({
    from: process.env.FROM_EMAIL || "DSAM'S Academy <onboarding@resend.dev>",
    to: ownerEmail,
    replyTo: request.email,
    subject: 'Staff access request awaiting approval',
    headers: { 'Idempotency-Key': `staff-access-request-${request.id}` },
    html: `<h2>New staff-access request</h2><p><strong>${request.email}</strong> wants read-only access to the DSAM'S Staff Portal.</p><p>Sign in with the owner Admin account before approving or denying access.</p><p><a href="${reviewUrl}" style="display:inline-block;padding:12px 18px;background:#e5a93b;color:#111;text-decoration:none;border-radius:8px;font-weight:700">Review staff request</a></p>`,
    text: `New staff-access request from ${request.email}. Review it securely at ${reviewUrl}`,
  });

  if (emailError) return res.status(500).json({ error: 'Could not send the owner notification.' });
  return res.status(200).json({ success: true });
}
