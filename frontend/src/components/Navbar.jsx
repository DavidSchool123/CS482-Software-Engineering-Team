import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className='navbar'>
      <a href='/' className='navbar-logo'>
        ♛ POKER FACE
      </a>

      <div className='navbar-links'>
        <Link to={'/'}>Home</Link>
        <Link to={'/tutorial'}>How to Play</Link>
        <Link to={'/about'}>About</Link>
        <Link to={'/contact'}>Contact</Link>
      </div>

      <div className='navbar-auth'>
        <Link to={'/login'} className='login-btn'>
          Login
        </Link>
        <Link to={'/register'} className='register-btn'>
          Register
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;
