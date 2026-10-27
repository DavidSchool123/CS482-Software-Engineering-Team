
import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import './GameNavbar.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function GameNavbar({ tableSearch, setTableSearch }) {
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError('');

    try {
      const response = await fetch(`${API_URL}/api/accounts/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to log out');
      }

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      setLogoutError('Unable to log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className='navbar game-navbar'>
      <Link to='/lobby' className='navbar-logo'>
        ♛ POKER FACE
      </Link>

      <div className='navbar-links'>
        <NavLink to='/lobby'>Lobby</NavLink>
        <NavLink to='/profile'>Profile</NavLink>
        <NavLink to='/friends'>Friends</NavLink>
        <NavLink to='/messages'>Messages</NavLink>
        <NavLink to='/tutorial'>How to Play</NavLink>
      </div>

      <div className='game-navbar-actions'>
        <input
          type='search'
          placeholder='Search tables...'
          aria-label='Search tables'
          value={tableSearch}
          onChange={(event) => setTableSearch(event.target.value)}
        />

        <button
          type='button'
          className='game-logout-btn'
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Logging Out...' : 'Log Out'}
        </button>

        {logoutError && (
          <span role='alert' className='logout-error'>
            {logoutError}
          </span>
        )}
      </div>
    </nav>
  );
}

export default GameNavbar;
