import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './AccountCreation.css';
import Login from './Login';
import Register from './Register';

function AccountCreation() {
  const location = useLocation();
  const accountView = location.state?.accountView || 'register';

  function handleSubmit(event, setMessage, message) {
    event.preventDefault();
    setMessage(message);
  }

  return (
    <main className='login-page'>
      <aside className='login-ad' aria-label='Advertisement'>
        <span>ADVERTISEMENT</span>
      </aside>

      <section className='login-content' aria-labelledby='login-page-title'>
        <header className='login-intro'>
          <h1 id='login-page-title'>Welcome Back!</h1>
          <p>Log in to continue playing or create a new account.</p>
        </header>

        <div className='login-panels'>
          {accountView === 'login' ? (
            <Login handleSubmit={handleSubmit} />
          ) : (
            <Register handleSubmit={handleSubmit} />
          )}
        </div>

        <div className='guest-divider' aria-hidden='true'>
          <span>or</span>
        </div>

        <div className='guest-action'>
          <Link to='/lobby?guest=true' className='guest-button'>
            <span aria-hidden='true'>♙</span>
            Continue as Guest
          </Link>
          <p>Play now without an account.</p>
        </div>
      </section>

      <aside className='login-ad' aria-label='Advertisement'>
        <span>ADVERTISEMENT</span>
      </aside>
    </main>
  );
}

export default AccountCreation;
