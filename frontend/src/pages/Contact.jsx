
import { useState } from 'react';
import './Contact.css';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear previous feedback when the user edits the form
    setStatus('');
    setIsError(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setStatus('');
    setIsError(false);

    try {
      const response = await fetch('http://localhost:5000/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Failed to send your message.'
        );
      }

      setStatus(
        data.message || 'Your message has been submitted successfully.'
      );

      // Reset the form after successful submission
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      setIsError(true);
      setStatus(
        error.message || 'Unable to send message. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="contact-page">
      <section className="contact-container">
        <h1>Contact Admin</h1>

        <p>
          Have a question, concern, or issue with Poker Face?
          Send us a message!
        </p>

        <form onSubmit={handleSubmit} className="contact-form">
          <label htmlFor="contact-name">Name</label>
          <input
            id="contact-name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            maxLength={100}
            required
          />

          <label htmlFor="contact-email">Email</label>
          <input
            id="contact-email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            maxLength={254}
            required
          />

          <label htmlFor="contact-subject">Subject</label>
          <input
            id="contact-subject"
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            maxLength={150}
            required
          />

          <label htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            name="message"
            rows={6}
            value={formData.message}
            onChange={handleChange}
            maxLength={2000}
            required
          />

          <div className='contact-character-count'>
            <span>Maximum 2,000 characters</span>
            <span>{formData.message.length} / 2000</span>
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>

        {status && (
          <p
            role={isError ? 'alert' : 'status'}
            style={{
              color: isError ? '#b42318' : '#217a3c',
              marginTop: '16px',
            }}
          >
            {status}
          </p>
        )}
      </section>
    </main>
  );
}
