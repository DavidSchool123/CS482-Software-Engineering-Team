import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './AccountCreation.css';
import Login from './Login';
import Register from './Register';

function AccountCreation() {
  const location = useLocation();
  const accountView = location.state?.accountView || 'register';
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounts`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, email, password, confirmPassword }),
        },
      );

      const data = await response.json();
      setMessage(data.message);

      if (response.ok) {
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');

        navigate('/lobby');
      }
    } catch (error) {
      setMessage('Unable to connect to the server.');
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setMessage('');

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounts/login`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txt_login: formData.get('username'),
            txt_pass: formData.get('password'),
          }),
        },
      );

      const data = await response.json();
      setMessage(data.message);

      if (response.ok) {
        navigate('/lobby');
      }
    } catch (error) {
      setMessage('Unable to connect to the server.');
    }
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
            <Login handleSubmit={handleLoginSubmit} message={message} />
          ) : (
            <Register
              handleSubmit={handleRegisterSubmit}
              message={message}
              username={username}
              setUsername={setUsername}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
            />
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
