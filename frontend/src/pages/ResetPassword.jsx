import './ResetPassword.css';

function ResetPassword({ handleSubmit, message }) {
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
                required
              />
            </div>

            <button className='reset-password-submit' type='submit'>
              Reset Password
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
