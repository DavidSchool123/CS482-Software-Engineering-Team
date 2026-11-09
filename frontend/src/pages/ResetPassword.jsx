import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './ResetPassword.css';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const token = searchParams.get('token');

    if (!token) {
      setMessage('Invalid or missing password-reset link.');
      return;
    }

    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounts/resetPassword`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            password,
            confirmPassword,
          }),
        },
      );

      const data = await response.json();
      setMessage(data.message);

      if (response.ok) {
        event.target.reset();
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className='reset-password-page'>
      <aside className='reset-password-ad' aria-label='Advertisement'>
        ADVERTISEMENT
      </aside>

      <div className='reset-password-content'>
        <section
          className='reset-password-card'
          aria-labelledby='reset-password-title'
        >
          <h2 id='reset-password-title'>Reset Password</h2>
          <p className='reset-password-description'>
            Enter your new password and confirm it below.
          </p>

          <form onSubmit={handleSubmit}>
            <div className='reset-password-field'>
              <label htmlFor='reset-password'>New Password</label>
              <input
                id='reset-password'
                name='password'
                type='password'
                placeholder='Enter your new password'
                autoComplete='new-password'
                minLength={6}
                required
              />
            </div>

            <div className='reset-password-field'>
              <label htmlFor='confirm-password'>Confirm Password</label>
              <input
                id='confirm-password'
                name='confirmPassword'
                type='password'
                placeholder='Confirm your new password'
                autoComplete='new-password'
                minLength={6}
                required
              />
            </div>

            <button
              className='reset-password-submit'
              type='submit'
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            {message && (
              <p className='reset-password-message' role='status'>
                {message}
              </p>
            )}
          </form>
        </section>
      </div>

      <aside className='reset-password-ad' aria-label='Advertisement'>
        ADVERTISEMENT
      </aside>
    </main>
  );
}

export default ResetPassword;
