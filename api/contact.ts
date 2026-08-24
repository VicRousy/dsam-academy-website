import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const MAX_FIELD_LENGTH = 160;

function cleanText(value: unknown, maxLength = MAX_FIELD_LENGTH) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, lastName, email, phone, track, ageGroup, lessonFormat, website } = req.body ?? {};
  const applicant = {
    firstName: cleanText(firstName, 80),
    lastName: cleanText(lastName, 80),
    email: cleanText(email, 254).toLowerCase(),
    phone: cleanText(phone, 40),
    track: cleanText(track),
    ageGroup: cleanText(ageGroup, 30),
    lessonFormat: cleanText(lessonFormat, 30),
  };

  if (cleanText(website)) {
    return res.status(400).json({ error: 'Submission could not be processed.' });
  }

  if (!applicant.firstName || !applicant.lastName || !applicant.email || !applicant.track || !applicant.ageGroup || !applicant.lessonFormat) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(applicant.email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const enrollmentEmail = process.env.ENROLLMENT_EMAIL;
  if (!apiKey || !enrollmentEmail) {
    return res.status(202).json({ success: true, notification: 'not_configured' });
  }

  const safeApplicant = {
    firstName: escapeHtml(applicant.firstName),
    lastName: escapeHtml(applicant.lastName),
    email: escapeHtml(applicant.email),
    phone: escapeHtml(applicant.phone),
    track: escapeHtml(applicant.track),
    ageGroup: escapeHtml(applicant.ageGroup),
    lessonFormat: escapeHtml(applicant.lessonFormat),
  };
  const fullName = `${applicant.firstName} ${applicant.lastName}`;
  const resend = new Resend(apiKey);
  const fromEmail = process.env.FROM_EMAIL || "DSAM'S Academy <onboarding@resend.dev>";

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: enrollmentEmail,
      replyTo: applicant.email,
      subject: `New Enrollment Application - ${fullName}`,
      html: `
        <h2>New Enrollment Application</h2>
        <p><strong>Name:</strong> ${safeApplicant.firstName} ${safeApplicant.lastName}</p>
        <p><strong>Email:</strong> ${safeApplicant.email}</p>
        <p><strong>Phone:</strong> ${safeApplicant.phone || 'Not provided'}</p>
        <p><strong>Study Track:</strong> ${safeApplicant.track}</p>
        <p><strong>Age Group:</strong> ${safeApplicant.ageGroup}</p>
        <p><strong>Preferred Format:</strong> ${safeApplicant.lessonFormat}</p>
        <hr>
        <p><em>Submitted through the DSAM enrolment form.</em></p>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send the application notification.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
}
