import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const TRACK_LABELS: Record<string, string> = {
  vocals: 'Vocal Engineering Track',
  piano: 'Grand Piano Track',
  instruments: 'Strings & Percussion Track',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const enrollmentEmail = process.env.ENROLLMENT_EMAIL;

  if (!apiKey || !enrollmentEmail) {
    // The enrolment itself is already saved in Supabase. During setup, email
    // notifications are optional, so do not make a successful application
    // look like a failure just because Resend is not configured yet.
    return res.status(202).json({ success: true, notification: 'not_configured' });
  }

  const { firstName, lastName, email, phone, track, ageGroup, lessonFormat } = req.body ?? {};

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !track || !ageGroup || !lessonFormat) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.FROM_EMAIL || 'DSAM Academy <onboarding@resend.dev>';
  const trackLabel = TRACK_LABELS[track] || track;
  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: enrollmentEmail,
      replyTo: email.trim(),
      subject: `New Enrollment Application — ${fullName}`,
      html: `
        <h2>New Enrollment Application</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email.trim()}</p>
        <p><strong>Phone:</strong> ${phone?.trim() || 'Not provided'}</p>
        <p><strong>Study Track:</strong> ${trackLabel}</p>
        <p><strong>Age Group:</strong> ${ageGroup}</p>
        <p><strong>Preferred Format:</strong> ${lessonFormat}</p>
        <hr />
        <p><em>Submitted via dsamacademy.com enrollment form</em></p>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send your application. Please try again.' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact API error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
}
