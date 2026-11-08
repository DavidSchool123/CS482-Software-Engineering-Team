const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is missing from .env');
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, html }) {
  const { data, error } = await resend.emails.send({
    from: 'Poker Face <onboarding@resend.dev>',
    to: to,
    subject: subject,
    html: html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

module.exports = { sendEmail };
