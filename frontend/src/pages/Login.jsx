import { useState } from 'react';
import { Link } from 'react-router-dom';
import './AccountCreation.css';

function Login({ handleSubmit, message }) {
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  return (
    <section className='auth-card' aria-labelledby='sign-in-title'>
      <h2 id='sign-in-title'>Login</h2>
      <form onSubmit={handleSubmit}>
        <div className='auth-field'>
          <label htmlFor='login-username'>Username or Email</label>
          <input
            id='login-username'
            name='username'
            type='text'
            placeholder='Enter your username or email'
            autoComplete='username'
            required
          />
        </div>

        <div className='auth-field'>
          <label htmlFor='login-password'>Password</label>
          <div className='password-input'>
            <input
              id='login-password'
              name='password'
              type={showLoginPassword ? 'text' : 'password'}
              placeholder='Enter your password'
              autoComplete='current-password'
              required
            />
            <button
              className='password-toggle'
              type='button'
              aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowLoginPassword((visible) => !visible)}
            >
              {showLoginPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className='auth-options'>
          <label className='remember-option' htmlFor='remember-me'>
            <input id='remember-me' name='remember-me' type='checkbox' />
            <span>Remember me</span>
          </label>
          <Link className='text-button' to='/forgot-password'>
            Forgot password?
          </Link>
        </div>

        <button className='auth-submit' type='submit'>
          Log In
        </button>
      </form>
    </section>
  );
}

export default Login;
