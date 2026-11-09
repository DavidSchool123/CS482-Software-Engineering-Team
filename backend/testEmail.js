const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { sendEmail } = require('./service/EmailService');

async function testEmail() {
  try {
    const data = await sendEmail({
      to: 'dani.ae277@gmail.com',
      subject: 'Poker Face Email Test',
      html: `
                <h1>Hello!</h1>
                <p>This is a test email from Poker Face.</p>
            `,
    });

    console.log('Email sent successfully!');
    console.log(data);
  } catch (error) {
    console.error('Email failed:', error);
  }
}

testEmail();
