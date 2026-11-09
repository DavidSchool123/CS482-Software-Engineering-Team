import { useState } from 'react';
import './ForgotPassword.css';

function ForgotPassword() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const email = formData.get('email');

    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounts/forgotPassword`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        },
      );

      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      console.error('Forgot password error:', error);
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className='forgot-password-page'>
      <aside className='forgot-password-ad' aria-label='Advertisement'>
        ADVERTISEMENT
      </aside>

      <div className='forgot-password-content'>
        <section
          className='forgot-password-card'
          aria-labelledby='forgot-password-title'
        >
          <h2 id='forgot-password-title'>Forgot Password?</h2>
          <p className='forgot-password-description'>
            Enter your email address and we’ll send you a link to reset your
            password.
          </p>

          <form onSubmit={handleSubmit}>
            <div className='forgot-password-field'>
              <label htmlFor='forgot-password-email'>Email</label>
              <input
                id='forgot-password-email'
                name='email'
                type='email'
                placeholder='Enter your email'
                autoComplete='email'
                required
              />
            </div>

            <button
              className='forgot-password-submit'
              type='submit'
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            {message && (
              <p className='forgot-password-message' role='status'>
                {message}
              </p>
            )}
          </form>
        </section>
      </div>

      <aside className='forgot-password-ad' aria-label='Advertisement'>
        ADVERTISEMENT
      </aside>
    </main>
  );
}

export default ForgotPassword;
