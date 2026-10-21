import { NavLink, Link } from 'react-router-dom';
import './GameNavbar.css';

function GameNavbar({ tableSearch, setTableSearch }) {
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

        <Link to='/profile' className='game-profile-icon'>
          ◉
        </Link>
      </div>
    </nav>
  );
}

export default GameNavbar;