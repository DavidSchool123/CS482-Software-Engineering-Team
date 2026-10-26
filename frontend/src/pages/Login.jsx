import { useState } from 'react';
import './AccountCreation.css';

function Login({ handleSubmit }) {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');

  return (
    <section className='auth-card' aria-labelledby='sign-in-title'>
      <h2 id='sign-in-title'>Login</h2>
      <form
        onSubmit={(event) =>
          handleSubmit(
            event,
            setLoginMessage,
            'Sign in is not connected yet. Please check back soon.',
          )
        }
      >
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

        <label>Email: </label>
        <input name='email'
          id='email' type='text'
          placeholder='Email' 
        />
            
        <div className='auth-options'>
          <label className='remember-option' htmlFor='remember-me'>
            <input id='remember-me' name='remember-me' type='checkbox' />
            <span>Remember me</span>
          </label>
          <button
            className='text-button'
            type='button'
            onClick={() =>
              setLoginMessage(
                'Password recovery is not available yet. Please check back soon.',
              )
            }
          >
            Forgot password?
          </button>
        </div>

        <button className='auth-submit' type='submit'>
          Log In
        </button>
        {loginMessage && (
          <p className='auth-message' role='status'>
            {loginMessage}
          </p>
        )}
      </form>
    </section>
  );
}

export default Login;
