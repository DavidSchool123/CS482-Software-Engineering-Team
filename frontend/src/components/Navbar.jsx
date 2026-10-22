import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

function Navbar({ setAccountCreate }) {
  const navigate = useNavigate();
  return (
    <nav className='navbar'>
      <Link href='/' className='navbar-logo'>
        ♛ POKER FACE
      </Link>

      <div className='navbar-links'>
        <Link to={'/'}>Home</Link>
        <Link to={'/tutorial'}>How to Play</Link>
        <Link to={'/about'}>About</Link>
        <Link to={'/contact'}>Contact</Link>
      </div>

      <div className='navbar-auth'>
        <button
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
