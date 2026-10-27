
import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className='navbar'>
      <Link to='/' className='navbar-logo'>
        ♛ POKER FACE
      </Link>

      <div className='navbar-links'>
        <Link to='/'>Home</Link>
        <Link to='/tutorial'>How to Play</Link>
        <Link to='/about'>About</Link>
        <Link to='/contact'>Contact</Link>
      </div>

      <div className='navbar-auth'>
        <button
          type='button'
          className='login-btn'
          onClick={() =>
            navigate('/account', {
              state: { accountView: 'login' },
            })
          }
        >
          Login
        </button>

        <button
          type='button'
          className='register-btn'
          onClick={() =>
            navigate('/account', {
              state: { accountView: 'register' },
            })
          }
        >
          Register
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
