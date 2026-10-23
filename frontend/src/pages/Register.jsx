import { useState } from 'react';
import { Link } from 'react-router-dom';
import './AccountCreation.css';

function Register({
  handleSubmit,
  message,
  username,
  setUsername,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
}) {
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <section className='auth-card' aria-labelledby='register-title'>
      <h2 id='register-title'>Register</h2>
      <form onSubmit={handleSubmit}>
        <div className='auth-field'>
          <label htmlFor='register-username'>Username</label>
          <input
            id='register-username'
            name='register-username'
            type='text'
            placeholder='Choose a username'
            autoComplete='username'
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className='auth-field'>
          <label htmlFor='register-email'>Email</label>
          <input
            id='register-email'
            name='email'
            type='email'
            placeholder='Enter your email'
            autoComplete='email'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className='auth-field'>
          <label htmlFor='register-password'>Password</label>
          <div className='password-input'>
            <input
              id='register-password'
              name='register-password'
              type={showRegisterPassword ? 'text' : 'password'}
              placeholder='Create a password'
              autoComplete='new-password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className='password-toggle'
              type='button'
              aria-label={
                showRegisterPassword ? 'Hide password' : 'Show password'
              }
              onClick={() => setShowRegisterPassword((visible) => !visible)}
            >
              {showRegisterPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className='auth-field'>
          <label htmlFor='confirm-password'>Confirm Password</label>
          <div className='password-input'>
            <input
              id='confirm-password'
              name='confirm-password'
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder='Confirm your password'
              autoComplete='new-password'
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              className='password-toggle'
              type='button'
              aria-label={
                showConfirmPassword ? 'Hide password' : 'Show password'
              }
              onClick={() => setShowConfirmPassword((visible) => !visible)}
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button className='auth-submit' type='submit'>
          Create Account
        </button>
        <p>{message}</p>
      </form>
    </section>
  );
}

export default Register;
