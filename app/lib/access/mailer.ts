import "server-only";
import nodemailer from "nodemailer";

// Sends the access-control system's transactional emails (admin
// notifications, approval/denial decisions) via a real Gmail account
// (SMTP + App Password) rather than Resend's shared resend.dev sender.
//
// WHY: Resend's free/unverified sender (onboarding@resend.dev) can only
// deliver to the single email address that created the Resend account -
// a real limitation discovered in production, not documented anywhere
// obvious. Since this system must email arbitrary mentee addresses and
// BOTH admin addresses, that restriction made it unusable without
// verifying a paid-domain-requiring sender in Resend. Gmail SMTP with an
// App Password is genuinely free, requires no domain, and can send to any
// recipient immediately - the right fit for this project's zero-budget
// constraint. Supabase's own auth emails (magic-link sign-in) are
// configured separately, directly in the Supabase dashboard's SMTP
// settings, using the same Gmail credentials - this file only covers the
// emails this app's own API routes send.
export async function sendMail(opts: { to: string | string[]; subject: string; text: string }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not configured - skipping email send:", opts.subject);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `MetaWorld Research Academy <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}
